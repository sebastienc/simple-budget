import { getDb } from './index';

export interface UpdateAccountInput {
  name?: string;
  startingBalanceCents?: number;
  startingBalanceDate?: string | null;
}

export const accountsQueries = {
  list: () => getDb().selectFrom('accounts').selectAll().orderBy('id').execute(),
  get: (id: number) => getDb().selectFrom('accounts').selectAll().where('id', '=', id).executeTakeFirst(),
  create: (input: { name: string }) =>
    getDb().insertInto('accounts').values({ name: input.name }).returningAll().executeTakeFirstOrThrow(),
  update: (id: number, input: UpdateAccountInput) =>
    getDb()
      .updateTable('accounts')
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.startingBalanceCents !== undefined && { starting_balance_cents: input.startingBalanceCents }),
        ...(input.startingBalanceDate !== undefined && { starting_balance_date: input.startingBalanceDate }),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow(),
  delete: (id: number) =>
    getDb()
      .transaction()
      .execute(async (trx) => {
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
  list: (accountId: number) =>
    getDb().selectFrom('recurring_items').selectAll().where('account_id', '=', accountId).orderBy('id').execute(),
  get: (id: number) => getDb().selectFrom('recurring_items').selectAll().where('id', '=', id).executeTakeFirst(),
  create: (input: CreateRecurringItemInput) =>
    getDb()
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
      })
      .returningAll()
      .executeTakeFirstOrThrow(),
  update: (id: number, input: UpdateRecurringItemInput) =>
    getDb()
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
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow(),
  delete: (id: number) => getDb().deleteFrom('recurring_items').where('id', '=', id).execute(),
};

export const balanceCheckpointsQueries = {
  list: (accountId: number) =>
    getDb().selectFrom('balance_checkpoints').selectAll().where('account_id', '=', accountId).orderBy('date').execute(),
  get: (id: number) => getDb().selectFrom('balance_checkpoints').selectAll().where('id', '=', id).executeTakeFirst(),
  upsert: (accountId: number, date: string, balanceCents: number) =>
    getDb()
      .insertInto('balance_checkpoints')
      .values({ account_id: accountId, date, balance_cents: balanceCents })
      .onConflict((oc) => oc.columns(['account_id', 'date']).doUpdateSet({ balance_cents: balanceCents }))
      .returningAll()
      .executeTakeFirstOrThrow(),
  delete: (id: number) => getDb().deleteFrom('balance_checkpoints').where('id', '=', id).execute(),
};
