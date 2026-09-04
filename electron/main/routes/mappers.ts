import type { Selectable } from 'kysely';
import type { AccountsTable, RecurringItemsTable } from '../db/schema';

export function toAccountJson(row: Selectable<AccountsTable>) {
  return {
    id: row.id,
    name: row.name,
    startingBalanceCents: row.starting_balance_cents,
    startingBalanceDate: row.starting_balance_date,
    createdAt: row.created_at,
  };
}

export function toRecurringItemJson(row: Selectable<RecurringItemsTable>) {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    amountCents: row.amount_cents,
    frequency: row.frequency,
    interval: row.interval,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
  };
}
