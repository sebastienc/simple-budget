import type { Transaction } from 'kysely';
import { getDb } from './index';
import type { Database } from './schema';
import { accountColumns, accountToSyncRow, balanceCheckpointColumns, balanceCheckpointToSyncRow, recurringItemColumns, recurringItemToSyncRow } from './syncMapping';
import { merge } from '../sync/merge';
import { SYNC_TABLES } from '../sync/model';
import type { DeviceState, MergedState, SyncRow, SyncTable, Tombstone } from '../sync/model';
import { formatStamp, parseStamp } from '../sync/stamp';

// The database side of sync (ADR-0008 in simple-budget-mobile): this computer's state read out as sync rows and
// tombstones, and a merged state written back. Reading, merging and writing happen in one transaction, so an edit made
// meanwhile is never overwritten with an older copy. The rows keep the stamps they were merged with (a merge never
// restamps), and the `deleted_rows` table ends up holding exactly the merged tombstones.
//
// With queries.ts this is the only place that writes rows. It deletes rows the merge no longer wants without writing
// tombstones of its own: the merged tombstones are what the merge decided, and written as they are.

/** What a merge changed in the database. `tombstones` counts records added, dropped or changed. */
export interface SyncChanges {
  added: number;
  updated: number;
  removed: number;
  tombstones: number;
}

export const anyChange = (changes: SyncChanges) => changes.added + changes.updated + changes.removed + changes.tombstones > 0;

/** What a merge did: this computer's state before it, the merged state, and what changed in the database. */
export interface MergeOutcome {
  before: DeviceState;
  merged: MergedState;
  changes: SyncChanges;
}

type Trx = Transaction<Database>;

async function readState(trx: Trx, deviceId: string): Promise<DeviceState> {
  const accounts = await trx.selectFrom('accounts').selectAll().orderBy('id').execute();
  const uuidOf = new Map(accounts.map((account) => [account.id, account.uuid]));
  const parent = (accountId: number) => uuidOf.get(accountId) ?? failOrphan(accountId);
  const items = await trx.selectFrom('recurring_items').selectAll().orderBy('id').execute();
  const corrections = await trx.selectFrom('balance_checkpoints').selectAll().orderBy('id').execute();
  const deleted = await trx.selectFrom('deleted_rows').selectAll().execute();
  return {
    deviceId,
    rows: [
      ...accounts.map(accountToSyncRow),
      ...items.map((item) => recurringItemToSyncRow(item, parent(item.account_id))),
      ...corrections.map((correction) => balanceCheckpointToSyncRow(correction, parent(correction.account_id))),
    ],
    tombstones: deleted.map((row): Tombstone => {
      if (!(SYNC_TABLES as readonly string[]).includes(row.table_name)) throw new Error(`deleted_rows names an unknown table '${row.table_name}'`);
      const nanos = parseStamp(row.deleted_at);
      if (nanos === null) throw new Error(`a tombstone for ${row.uuid} has a time that is not a time: '${row.deleted_at}'`);
      return { table: row.table_name as SyncTable, uuid: row.uuid, deletedAt: formatStamp(nanos) };
    }),
  };
}

function failOrphan(accountId: number): never {
  throw new Error(`a row belongs to account ${accountId}, which does not exist`);
}

const sameColumns = (wanted: Record<string, unknown>, existing: Record<string, unknown>) => Object.entries(wanted).every(([name, value]) => existing[name] === value);

const CHUNK = 500;

async function write(trx: Trx, merged: MergedState): Promise<SyncChanges> {
  const wanted = (table: SyncTable): SyncRow[] => merged.rows.filter((row) => row.table === table);
  const wantedUuids = (table: SyncTable) => new Set(wanted(table).map((row) => row.uuid));

  const localAccounts = await trx.selectFrom('accounts').selectAll().execute();
  const localItems = await trx.selectFrom('recurring_items').selectAll().execute();
  const localCorrections = await trx.selectFrom('balance_checkpoints').selectAll().execute();
  let added = 0;
  let updated = 0;
  let removed = 0;

  // What the merge no longer wants goes first, children before accounts (the database enforces its keys), so a
  // correction that lost its day to another is gone before the winner is written (one correction per account and day).
  const keepCorrections = wantedUuids('balance_checkpoints');
  for (const row of localCorrections.filter((r) => !keepCorrections.has(r.uuid))) {
    await trx.deleteFrom('balance_checkpoints').where('id', '=', row.id).execute();
    removed++;
  }
  const keepItems = wantedUuids('recurring_items');
  for (const row of localItems.filter((r) => !keepItems.has(r.uuid))) {
    await trx.deleteFrom('recurring_items').where('id', '=', row.id).execute();
    removed++;
  }
  const keepAccounts = wantedUuids('accounts');
  for (const row of localAccounts.filter((r) => !keepAccounts.has(r.uuid))) {
    await trx.deleteFrom('accounts').where('id', '=', row.id).execute();
    removed++;
  }

  const accountIdOf = new Map<string, number>();
  const accountByUuid = new Map(localAccounts.map((row) => [row.uuid, row]));
  for (const row of wanted('accounts')) {
    const columns = accountColumns(row);
    const existing = accountByUuid.get(row.uuid);
    if (existing === undefined) {
      const inserted = await trx
        .insertInto('accounts')
        .values({ ...columns, uuid: row.uuid })
        .returning('id')
        .executeTakeFirstOrThrow();
      accountIdOf.set(row.uuid, inserted.id);
      added++;
    } else {
      accountIdOf.set(row.uuid, existing.id);
      if (!sameColumns(columns, existing)) {
        await trx.updateTable('accounts').set(columns).where('id', '=', existing.id).execute();
        updated++;
      }
    }
  }

  const itemByUuid = new Map(localItems.map((row) => [row.uuid, row]));
  for (const row of wanted('recurring_items')) {
    const columns = recurringItemColumns(row);
    const accountId = accountIdOf.get(row.parentUuid ?? '') ?? failMissingParent(row);
    const existing = itemByUuid.get(row.uuid);
    if (existing === undefined) {
      await trx
        .insertInto('recurring_items')
        .values({ ...columns, uuid: row.uuid, account_id: accountId })
        .execute();
      added++;
    } else if (!sameColumns({ ...columns, account_id: accountId }, existing)) {
      await trx
        .updateTable('recurring_items')
        .set({ ...columns, account_id: accountId })
        .where('id', '=', existing.id)
        .execute();
      updated++;
    }
  }

  const correctionByUuid = new Map(localCorrections.map((row) => [row.uuid, row]));
  for (const row of wanted('balance_checkpoints')) {
    const columns = balanceCheckpointColumns(row);
    const accountId = accountIdOf.get(row.parentUuid ?? '') ?? failMissingParent(row);
    const existing = correctionByUuid.get(row.uuid);
    if (existing === undefined) {
      await trx
        .insertInto('balance_checkpoints')
        .values({ ...columns, uuid: row.uuid, account_id: accountId })
        .execute();
      added++;
    } else if (!sameColumns({ ...columns, account_id: accountId }, existing)) {
      await trx
        .updateTable('balance_checkpoints')
        .set({ ...columns, account_id: accountId })
        .where('id', '=', existing.id)
        .execute();
      updated++;
    }
  }

  // The tombstone table ends up holding exactly the merged tombstones.
  const present = await trx.selectFrom('deleted_rows').selectAll().execute();
  const key = (table: string, uuid: string) => `${table}|${uuid}`;
  const wantedTombstones = new Map(merged.tombstones.map((t) => [key(t.table, t.uuid), t]));
  const presentByKey = new Map(present.map((row) => [key(row.table_name, row.uuid), row]));
  const toDrop = present.filter((row) => wantedTombstones.get(key(row.table_name, row.uuid))?.deletedAt !== row.deleted_at);
  const toAdd = merged.tombstones.filter((t) => presentByKey.get(key(t.table, t.uuid))?.deleted_at !== t.deletedAt);
  for (const table of SYNC_TABLES) {
    const uuids = toDrop.filter((row) => row.table_name === table).map((row) => row.uuid);
    for (let i = 0; i < uuids.length; i += CHUNK) {
      await trx
        .deleteFrom('deleted_rows')
        .where('table_name', '=', table)
        .where('uuid', 'in', uuids.slice(i, i + CHUNK))
        .execute();
    }
  }
  for (let i = 0; i < toAdd.length; i += CHUNK) {
    await trx
      .insertInto('deleted_rows')
      .values(toAdd.slice(i, i + CHUNK).map((t) => ({ table_name: t.table, uuid: t.uuid, deleted_at: t.deletedAt })))
      .execute();
  }

  return { added, updated, removed, tombstones: toDrop.length + toAdd.length };
}

function failMissingParent(row: SyncRow): never {
  throw new Error(`${row.uuid} belongs to an account that is not in the merged state`);
}

export const syncStore = {
  /** This computer's state, held under `deviceId`. */
  localState: (deviceId: string): Promise<DeviceState> =>
    getDb()
      .transaction()
      .execute((trx) => readState(trx, deviceId)),

  /**
   * Reads this computer's state, lets `choose` pick which of the other devices' states to merge with it, merges, and
   * writes the result, in one transaction. `choose` runs inside the transaction: keep it quick and pure.
   */
  mergeInto: (deviceId: string, choose: (local: DeviceState) => DeviceState[]): Promise<MergeOutcome> =>
    getDb()
      .transaction()
      .execute(async (trx) => {
        const before = await readState(trx, deviceId);
        const merged = merge([...choose(before), before]);
        return { before, merged, changes: await write(trx, merged) };
      }),

  /** Replaces everything with `state`, as the winner of a first link does (ADR-0008): what it lacks is deleted. */
  replaceWith: (state: DeviceState): Promise<SyncChanges> =>
    getDb()
      .transaction()
      .execute((trx) => write(trx, merge([state]))),
};
