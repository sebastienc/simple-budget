import { describe, expect, it } from 'vitest';
import type { Selectable } from 'kysely';
import type { AccountsTable, BalanceCheckpointsTable, RecurringItemsTable } from '../db/schema';
import { toAccountJson, toBalanceCheckpointJson, toRecurringItemInput, toRecurringItemJson } from './mappers';

function accountRow(overrides: Partial<Selectable<AccountsTable>> = {}): Selectable<AccountsTable> {
  return {
    id: 1,
    name: 'Chequing',
    currency: 'CAD',
    starting_balance_cents: 150_000,
    starting_balance_date: '2026-01-01',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function recurringItemRow(overrides: Partial<Selectable<RecurringItemsTable>> = {}): Selectable<RecurringItemsTable> {
  return {
    id: 1,
    account_id: 1,
    name: 'Rent',
    amount_cents: -150_000,
    frequency: 'monthly',
    interval: 1,
    start_date: '2026-01-01',
    end_date: null,
    semi_monthly_day1: null,
    semi_monthly_day2: null,
    sinking_fund: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function checkpointRow(overrides: Partial<Selectable<BalanceCheckpointsTable>> = {}): Selectable<BalanceCheckpointsTable> {
  return {
    id: 1,
    account_id: 1,
    date: '2026-01-01',
    balance_cents: 150_000,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('toAccountJson', () => {
  it('maps snake_case columns to camelCase fields', () => {
    expect(toAccountJson(accountRow())).toEqual({
      id: 1,
      name: 'Chequing',
      currency: 'CAD',
      startingBalanceCents: 150_000,
      startingBalanceDate: '2026-01-01',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('carries a null starting balance date through untouched', () => {
    expect(toAccountJson(accountRow({ starting_balance_date: null })).startingBalanceDate).toBeNull();
  });
});

describe('toRecurringItemJson', () => {
  it('maps snake_case columns to camelCase fields', () => {
    expect(toRecurringItemJson(recurringItemRow())).toEqual({
      id: 1,
      accountId: 1,
      name: 'Rent',
      amountCents: -150_000,
      frequency: 'monthly',
      interval: 1,
      startDate: '2026-01-01',
      endDate: null,
      semiMonthlyDay1: null,
      semiMonthlyDay2: null,
      sinkingFund: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('coerces the sinking_fund integer column to a boolean', () => {
    expect(toRecurringItemJson(recurringItemRow({ sinking_fund: 1 })).sinkingFund).toBe(true);
    expect(toRecurringItemJson(recurringItemRow({ sinking_fund: 0 })).sinkingFund).toBe(false);
  });

  it('carries semi-monthly day fields through when set', () => {
    const json = toRecurringItemJson(recurringItemRow({ semi_monthly_day1: 1, semi_monthly_day2: 15 }));
    expect(json.semiMonthlyDay1).toBe(1);
    expect(json.semiMonthlyDay2).toBe(15);
  });
});

describe('toRecurringItemInput', () => {
  it('maps a row down to exactly the fields projection.ts needs, dropping account_id/created_at/sinking_fund', () => {
    expect(toRecurringItemInput(recurringItemRow())).toEqual({
      id: 1,
      name: 'Rent',
      amountCents: -150_000,
      frequency: 'monthly',
      interval: 1,
      startDate: '2026-01-01',
      endDate: null,
      semiMonthlyDay1: null,
      semiMonthlyDay2: null,
    });
  });
});

describe('toBalanceCheckpointJson', () => {
  it('maps snake_case columns to camelCase fields', () => {
    expect(toBalanceCheckpointJson(checkpointRow())).toEqual({
      id: 1,
      accountId: 1,
      date: '2026-01-01',
      balanceCents: 150_000,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });
});
