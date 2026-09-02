import type { ColumnType, Generated } from 'kysely';

export interface AccountsTable {
  id: Generated<number>;
  name: string;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface CategoriesTable {
  id: Generated<number>;
  name: string;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface TransactionsTable {
  id: Generated<number>;
  account_id: number;
  category_id: number | null;
  amount_cents: number;
  description: string | null;
  occurred_on: string;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface Database {
  accounts: AccountsTable;
  categories: CategoriesTable;
  transactions: TransactionsTable;
}
