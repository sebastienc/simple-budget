import type { ColumnType, Generated } from 'kysely';

export interface AccountsTable {
  id: Generated<number>;
  name: string;
  currency: ColumnType<string, string | undefined, string>;
  starting_balance_cents: ColumnType<number, number | undefined, number>;
  starting_balance_date: string | null;
  created_at: ColumnType<string, string | undefined, never>;
  /** Identity across devices (sync). Set once, when the row is created. */
  uuid: ColumnType<string, string, never>;
  /** When the row last changed, an ISO-8601 UTC instant (sync). Set on every insert and update. */
  updated_at: ColumnType<string, string, string>;
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
  sinking_fund: ColumnType<number, number | undefined, number>;
  created_at: ColumnType<string, string | undefined, never>;
  /** Identity across devices (sync). Set once, when the row is created. */
  uuid: ColumnType<string, string, never>;
  /** When the row last changed, an ISO-8601 UTC instant (sync). Set on every insert and update. */
  updated_at: ColumnType<string, string, string>;
}

export interface BalanceCheckpointsTable {
  id: Generated<number>;
  account_id: number;
  date: string;
  balance_cents: number;
  created_at: ColumnType<string, string | undefined, never>;
  /** Identity across devices (sync). Set once, when the row is created. */
  uuid: ColumnType<string, string, never>;
  /** When the row last changed, an ISO-8601 UTC instant (sync). Set on every insert and update. */
  updated_at: ColumnType<string, string, string>;
}

/** Rows that were deleted and when, kept for good (sync). */
export interface DeletedRowsTable {
  table_name: string;
  uuid: string;
  deleted_at: string;
}

export interface Database {
  accounts: AccountsTable;
  recurring_items: RecurringItemsTable;
  balance_checkpoints: BalanceCheckpointsTable;
  deleted_rows: DeletedRowsTable;
}
