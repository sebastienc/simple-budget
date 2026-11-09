import { randomUUID } from 'crypto';
import { getDb } from './index';
import { nextWriteStamp, recordDeletions } from './stamps';

// The single place of writes. Every write is stamped (`updated_at`, ADR-0008 in simple-budget-mobile), every insert
// gets a `uuid`, and every delete leaves a tombstone in `deleted_rows`, all in the write's own transaction, so that
// sync can tell what changed and what was removed. `stamps.test.ts` lists the write paths and fails on a new one.

export interface UpdateAccountInput {
  name?: string;
  currency?: string;
  startingBalanceCents?: number;
  startingBalanceDate?: string | null;
}

export const accountsQueries = {
  list: () => getDb().selectFrom('accounts').selectAll().orderBy('id').execute(),
  get: (id: number) => getDb().selectFrom('accounts').selectAll().where('id', '=', id).executeTakeFirst(),
  create: (input: { name: string; currency: string }) =>
    getDb()
      .transaction()
      .execute(async (trx) =>
        trx
          .insertInto('accounts')
          .values({ name: input.name, currency: input.currency, uuid: randomUUID(), updated_at: await nextWriteStamp(trx) })
          .returningAll()
          .executeTakeFirstOrThrow(),
      ),
  update: (id: number, input: UpdateAccountInput) =>
    getDb()
      .transaction()
      .execute(async (trx) =>
        trx
          .updateTable('accounts')
          .set({
            ...(input.name !== undefined && { name: input.name }),
            ...(input.currency !== undefined && { currency: input.currency }),
            ...(input.startingBalanceCents !== undefined && { starting_balance_cents: input.startingBalanceCents }),
            ...(input.startingBalanceDate !== undefined && { starting_balance_date: input.startingBalanceDate }),
            updated_at: await nextWriteStamp(trx),
          })
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirstOrThrow(),
      ),
  /** Deletes the account and, with it, its items and corrections; each leaves a tombstone, all at the same stamp. */
  delete: (id: number) =>
    getDb()
      .transaction()
      .execute(async (trx) => {
        const account = await trx.selectFrom('accounts').select('uuid').where('id', '=', id).executeTakeFirst();
        if (account === undefined) return;
        const stamp = await nextWriteStamp(trx);
        const items = await trx.selectFrom('recurring_items').select('uuid').where('account_id', '=', id).execute();
        const checkpoints = await trx.selectFrom('balance_checkpoints').select('uuid').where('account_id', '=', id).execute();
        await recordDeletions(
          trx,
          'recurring_items',
          items.map((row) => row.uuid),
          stamp,
        );
        await recordDeletions(
          trx,
          'balance_checkpoints',
          checkpoints.map((row) => row.uuid),
          stamp,
        );
        await recordDeletions(trx, 'accounts', [account.uuid], stamp);
        await trx.deleteFrom('recurring_items').where('account_id', '=', id).execute();
        await trx.deleteFrom('balance_checkpoints').where('account_id', '=', id).execute();
        await trx.deleteFrom('accounts').where('id', '=', id).execute();
      }),
};

export interface CreateRecurringItemInput {
  accountId: number;
  name: string;
  amountCents: number;
  frequency: string;
  interval: number;
  startDate: string;
  endDate?: string | null;
  semiMonthlyDay1?: number | null;
  semiMonthlyDay2?: number | null;
  sinkingFund?: boolean;
}

export interface UpdateRecurringItemInput {
  name?: string;
  amountCents?: number;
  frequency?: string;
  interval?: number;
  startDate?: string;
  endDate?: string | null;
  semiMonthlyDay1?: number | null;
  semiMonthlyDay2?: number | null;
  sinkingFund?: boolean;
}

export const recurringItemsQueries = {
  list: (accountId: number) => getDb().selectFrom('recurring_items').selectAll().where('account_id', '=', accountId).orderBy('id').execute(),
  get: (id: number) => getDb().selectFrom('recurring_items').selectAll().where('id', '=', id).executeTakeFirst(),
  create: (input: CreateRecurringItemInput) =>
    getDb()
      .transaction()
      .execute(async (trx) =>
        trx
          .insertInto('recurring_items')
          .values({
            account_id: input.accountId,
            name: input.name,
            amount_cents: input.amountCents,
            frequency: input.frequency,
            interval: input.interval,
            start_date: input.startDate,
            end_date: input.endDate ?? null,
            semi_monthly_day1: input.semiMonthlyDay1 ?? null,
            semi_monthly_day2: input.semiMonthlyDay2 ?? null,
            sinking_fund: input.sinkingFund ? 1 : 0,
            uuid: randomUUID(),
            updated_at: await nextWriteStamp(trx),
          })
          .returningAll()
          .executeTakeFirstOrThrow(),
      ),
  update: (id: number, input: UpdateRecurringItemInput) =>
    getDb()
      .transaction()
      .execute(async (trx) =>
        trx
          .updateTable('recurring_items')
          .set({
            ...(input.name !== undefined && { name: input.name }),
            ...(input.amountCents !== undefined && { amount_cents: input.amountCents }),
            ...(input.frequency !== undefined && { frequency: input.frequency }),
            ...(input.interval !== undefined && { interval: input.interval }),
            ...(input.startDate !== undefined && { start_date: input.startDate }),
            ...(input.endDate !== undefined && { end_date: input.endDate }),
            ...(input.semiMonthlyDay1 !== undefined && { semi_monthly_day1: input.semiMonthlyDay1 }),
            ...(input.semiMonthlyDay2 !== undefined && { semi_monthly_day2: input.semiMonthlyDay2 }),
            ...(input.sinkingFund !== undefined && { sinking_fund: input.sinkingFund ? 1 : 0 }),
            updated_at: await nextWriteStamp(trx),
          })
          .where('id', '=', id)
          .returningAll()
          .executeTakeFirstOrThrow(),
      ),
  delete: (id: number) =>
    getDb()
      .transaction()
      .execute(async (trx) => {
        const item = await trx.selectFrom('recurring_items').select('uuid').where('id', '=', id).executeTakeFirst();
        if (item === undefined) return;
        await recordDeletions(trx, 'recurring_items', [item.uuid], await nextWriteStamp(trx));
        await trx.deleteFrom('recurring_items').where('id', '=', id).execute();
      }),
};

export const balanceCheckpointsQueries = {
  list: (accountId: number) => getDb().selectFrom('balance_checkpoints').selectAll().where('account_id', '=', accountId).orderBy('date').execute(),
  get: (id: number) => getDb().selectFrom('balance_checkpoints').selectAll().where('id', '=', id).executeTakeFirst(),
  upsert: (accountId: number, date: string, balanceCents: number) =>
    getDb()
      .transaction()
      .execute(async (trx) => {
        const stamp = await nextWriteStamp(trx);
        return trx
          .insertInto('balance_checkpoints')
          .values({ account_id: accountId, date, balance_cents: balanceCents, uuid: randomUUID(), updated_at: stamp })
          .onConflict((oc) => oc.columns(['account_id', 'date']).doUpdateSet({ balance_cents: balanceCents, updated_at: stamp }))
          .returningAll()
          .executeTakeFirstOrThrow();
      }),
  delete: (id: number) =>
    getDb()
      .transaction()
      .execute(async (trx) => {
        const checkpoint = await trx.selectFrom('balance_checkpoints').select('uuid').where('id', '=', id).executeTakeFirst();
        if (checkpoint === undefined) return;
        await recordDeletions(trx, 'balance_checkpoints', [checkpoint.uuid], await nextWriteStamp(trx));
        await trx.deleteFrom('balance_checkpoints').where('id', '=', id).execute();
      }),
};

/**
 * Deletes every row the user owns, in dependency order inside one transaction —
 * either the whole thing is gone or none of it is. Schema and migration history
 * are left alone, so the app carries on against an empty database rather than
 * needing to re-migrate. Every row leaves a tombstone, so with sync on the other
 * devices follow; tombstones from earlier deletions are kept.
 */
export const wipeAllData = () =>
  getDb()
    .transaction()
    .execute(async (trx) => {
      const stamp = await nextWriteStamp(trx);
      for (const table of ['balance_checkpoints', 'recurring_items', 'accounts'] as const) {
        const rows = await trx.selectFrom(table).select('uuid').execute();
        await recordDeletions(
          trx,
          table,
          rows.map((row) => row.uuid),
          stamp,
        );
      }
      await trx.deleteFrom('balance_checkpoints').execute();
      await trx.deleteFrom('recurring_items').execute();
      await trx.deleteFrom('accounts').execute();
    });
