import type { ColumnType, Generated } from 'kysely';

export interface AccountsTable {
  id: Generated<number>;
  name: string;
  starting_balance_cents: ColumnType<number, number | undefined, number>;
  starting_balance_date: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface RecurringItemsTable {
  id: Generated<number>;
  account_id: number;
  name: string;
  amount_cents: number;
  frequency: string;
  interval: ColumnType<number, number | undefined, number>;
  start_date: string;
  end_date: string | null;
  semi_monthly_day1: number | null;
  semi_monthly_day2: number | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface BalanceCheckpointsTable {
  id: Generated<number>;
  account_id: number;
  date: string;
  balance_cents: number;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface Database {
  accounts: AccountsTable;
  recurring_items: RecurringItemsTable;
  balance_checkpoints: BalanceCheckpointsTable;
}
