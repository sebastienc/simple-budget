import { getDb } from './index';

export const accountsQueries = {
  list: () => getDb().selectFrom('accounts').selectAll().orderBy('id').execute(),
  create: (input: { name: string }) =>
    getDb().insertInto('accounts').values({ name: input.name }).returningAll().executeTakeFirstOrThrow(),
};

export const categoriesQueries = {
  list: () => getDb().selectFrom('categories').selectAll().orderBy('id').execute(),
  create: (input: { name: string }) =>
    getDb().insertInto('categories').values({ name: input.name }).returningAll().executeTakeFirstOrThrow(),
};

export interface CreateTransactionInput {
  accountId: number;
  categoryId?: number | null;
  amountCents: number;
  description?: string | null;
  occurredOn: string;
}

export const transactionsQueries = {
  list: () => getDb().selectFrom('transactions').selectAll().orderBy('occurred_on', 'desc').execute(),
  create: (input: CreateTransactionInput) =>
    getDb()
      .insertInto('transactions')
      .values({
        account_id: input.accountId,
        category_id: input.categoryId ?? null,
        amount_cents: input.amountCents,
        description: input.description ?? null,
        occurred_on: input.occurredOn,
      })
      .returningAll()
      .executeTakeFirstOrThrow(),
};
