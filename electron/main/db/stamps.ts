import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database } from './schema';
import { nextStamp } from '../sync/merge';
import { parseStamp, stampOf } from '../sync/stamp';

// What every write does for sync (ADR-0008 in simple-budget-mobile): it is stamped, and a delete leaves a tombstone.
// All of it happens inside the write's own transaction.

export type Executor = Kysely<Database> | Transaction<Database>;

/** The tables whose rows are synced, as they are named in `deleted_rows` and in the sync files. */
export type SyncedTable = 'accounts' | 'recurring_items' | 'balance_checkpoints';

let clock: () => Date = () => new Date();

/** Lets a test fix "now". Pass null to put the real clock back. */
export function setClockForTests(fixed: (() => Date) | null): void {
  clock = fixed ?? (() => new Date());
}

/**
 * The stamp for a write: the later of the clock and the newest stamp anywhere in the database, in whole seconds, so a
 * computer whose clock runs slow still wins over an edit it has already received from another device.
 *
 * The newest is found as text. Stamps this app writes are whole seconds, so text order is time order; only a stamp
 * with a fraction of a second, which another device could write, can sort a little wrong, and then only within the
 * same second.
 */
export async function nextWriteStamp(db: Executor): Promise<string> {
  const { rows } = await sql<{ newest: string | null }>`
    select max(stamp) as newest from (
      select max(updated_at) as stamp from accounts
      union all select max(updated_at) from recurring_items
      union all select max(updated_at) from balance_checkpoints
      union all select max(deleted_at) from deleted_rows
    )`.execute(db);
  const newest = rows[0]?.newest ?? null;
  // Text that is not a stamp (nothing this app writes) must not stop every later write.
  return nextStamp(stampOf(clock()), newest !== null && parseStamp(newest) !== null ? newest : null);
}

/** Records that these rows were deleted at `stamp`. Call it in the transaction that deletes them. */
export async function recordDeletions(trx: Transaction<Database>, table: SyncedTable, uuids: string[], stamp: string): Promise<void> {
  const CHUNK = 500;
  for (let i = 0; i < uuids.length; i += CHUNK) {
    await trx
      .insertInto('deleted_rows')
      .values(uuids.slice(i, i + CHUNK).map((uuid) => ({ table_name: table, uuid, deleted_at: stamp })))
      .onConflict((oc) => oc.columns(['table_name', 'uuid']).doUpdateSet({ deleted_at: stamp }))
      .execute();
  }
}
