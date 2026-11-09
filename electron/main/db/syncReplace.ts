import { sql } from 'kysely';
import { getDb, replaceDbWith } from './index';
import { nextWriteStamp } from './stamps';
import { SYNC_TABLES } from '../sync/model';
import type { Tombstone } from '../sync/model';
import { compareStamps, parseStamp } from '../sync/stamp';

// Replacing the whole database (restoring a snapshot, importing a file) while sync is on (ADR-0009 in
// simple-budget-mobile, "Import while sync is on"). "This replaces everything" has to win on every device, not only here:
// a plain replacement gives new rows and no record of the old ones being deleted, so this computer would share no row
// with the other devices, and the next sync would find two budgets that never met (a first link) with the other device
// neither following nor being told. So the replacement also writes what a sync needs to carry it, around the swap:
//
// - before, it notes which rows exist and which deletions are recorded, and settles on the replacement's stamp: the
//   later of the clock and the newest stamp in the database (the rule for every write), so the new rows are newer than
//   anything this computer has seen;
// - after, it gives every row that stamp, so they beat the other devices' copies; it records as deleted every row the
//   replacement took away; it keeps the deletions that were already recorded and the ones the file carries; and it drops
//   the record of any row the replacement brought back.
//
// A row another device made that this computer has not read yet is not known here, so it is not removed: it comes back
// after the next sync. That is the one thing a replacement cannot undo.
//
// Rows from a snapshot older than the sync columns get new uuids when the database is upgraded, so none of them matches a
// row the other devices hold: all the old ones are recorded as deleted, and the new ones win.

export interface BeforeReplace {
  /** `table|uuid` of every row there was. */
  identities: Set<string>;
  /** The deletions there were, by `table|uuid`. */
  tombstones: Map<string, Tombstone>;
  /** The stamp of the replacement. */
  stamp: string;
}

const key = (table: string, uuid: string) => `${table}|${uuid}`;

/** The later of two stamps; the first if either is not a time, or there is no first. */
function later(a: string | undefined, b: string): string {
  if (a === undefined) return b;
  if (parseStamp(a) === null || parseStamp(b) === null) return a;
  return compareStamps(b, a) > 0 ? b : a;
}

/** Reads what the replacement has to know about the database it is about to replace. */
export async function captureBeforeReplace(): Promise<BeforeReplace> {
  return getDb()
    .transaction()
    .execute(async (trx) => {
      const identities = new Set<string>();
      for (const table of SYNC_TABLES) {
        for (const row of (await sql<{ uuid: string }>`select uuid from ${sql.table(table)}`.execute(trx)).rows) {
          identities.add(key(table, row.uuid));
        }
      }
      const tombstones = new Map<string, Tombstone>();
      for (const row of await trx.selectFrom('deleted_rows').selectAll().execute()) {
        tombstones.set(key(row.table_name, row.uuid), { table: row.table_name as Tombstone['table'], uuid: row.uuid, deletedAt: row.deleted_at });
      }
      return { identities, tombstones, stamp: await nextWriteStamp(trx) };
    });
}

/** Gives the replaced database what a sync needs to carry the replacement to the other devices. One transaction. */
export async function applyAfterReplace(before: BeforeReplace): Promise<void> {
  await getDb()
    .transaction()
    .execute(async (trx) => {
      for (const table of SYNC_TABLES) {
        await sql`update ${sql.table(table)} set updated_at = ${before.stamp}`.execute(trx);
      }

      const imported = new Set<string>();
      for (const table of SYNC_TABLES) {
        for (const row of (await sql<{ uuid: string }>`select uuid from ${sql.table(table)}`.execute(trx)).rows) {
          imported.add(key(table, row.uuid));
        }
      }

      const kept = new Map<string, Tombstone>();
      // the file's own deletions, then the ones this computer already recorded (the later stamp of the two wins)
      const fromFile = await trx.selectFrom('deleted_rows').selectAll().execute();
      for (const row of fromFile) {
        kept.set(key(row.table_name, row.uuid), { table: row.table_name as Tombstone['table'], uuid: row.uuid, deletedAt: row.deleted_at });
      }
      for (const [id, tombstone] of before.tombstones) {
        kept.set(id, { ...tombstone, deletedAt: later(kept.get(id)?.deletedAt, tombstone.deletedAt) });
      }
      // every row the replacement took away
      for (const id of before.identities) {
        if (imported.has(id)) continue;
        const separator = id.indexOf('|');
        const table = id.slice(0, separator) as Tombstone['table'];
        const uuid = id.slice(separator + 1);
        kept.set(id, { table, uuid, deletedAt: later(kept.get(id)?.deletedAt, before.stamp) });
      }
      // and not the ones it brought back
      for (const id of imported) kept.delete(id);

      await trx.deleteFrom('deleted_rows').execute();
      const rows = [...kept.values()].map((t) => ({ table_name: t.table, uuid: t.uuid, deleted_at: t.deletedAt }));
      for (let i = 0; i < rows.length; i += 500) {
        await trx
          .insertInto('deleted_rows')
          .values(rows.slice(i, i + 500))
          .execute();
      }
    });
}

export interface ReplaceOptions {
  /** Whether other devices follow this computer (sync is on): if so, the replacement must win on all of them. */
  keepSyncHistory: boolean;
  /** For tests: what is done after the swap when `keepSyncHistory` is set. */
  apply?: (before: BeforeReplace) => Promise<void>;
}

/**
 * Replaces the database with the file at `sourcePath`, and either all of it happens or none: if the swap or what goes with
 * it fails, the database at `undoPath` (the safety copy taken just before) is put back and the error is passed on.
 */
export async function replaceDb(sourcePath: string, undoPath: string, options: ReplaceOptions): Promise<void> {
  const before = options.keepSyncHistory ? await captureBeforeReplace() : undefined;
  try {
    await replaceDbWith(sourcePath);
    if (before) {
      await (options.apply ?? applyAfterReplace)(before);
    }
  } catch (error) {
    await replaceDbWith(undoPath);
    throw error;
  }
}
