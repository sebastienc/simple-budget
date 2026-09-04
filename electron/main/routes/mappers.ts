import type { Selectable } from 'kysely';
import type { AccountsTable, BalanceCheckpointsTable, RecurringItemsTable } from '../db/schema';
import type { Frequency, RecurringItemInput } from '../projection';

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
    semiMonthlyDay1: row.semi_monthly_day1,
    semiMonthlyDay2: row.semi_monthly_day2,
    sinkingFund: row.sinking_fund === 1,
    createdAt: row.created_at,
  };
}

export function toRecurringItemInput(row: Selectable<RecurringItemsTable>): RecurringItemInput {
  return {
    id: row.id,
    name: row.name,
    amountCents: row.amount_cents,
    frequency: row.frequency as Frequency,
    interval: row.interval,
    startDate: row.start_date,
    endDate: row.end_date,
    semiMonthlyDay1: row.semi_monthly_day1,
    semiMonthlyDay2: row.semi_monthly_day2,
  };
}

export function toBalanceCheckpointJson(row: Selectable<BalanceCheckpointsTable>) {
  return {
    id: row.id,
    accountId: row.account_id,
    date: row.date,
    balanceCents: row.balance_cents,
    createdAt: row.created_at,
  };
}
