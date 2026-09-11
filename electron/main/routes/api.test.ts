import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Selectable } from 'kysely';
import type { RecurringItemsTable } from '../db/schema';
import { withTestApp } from '../../../test/dbFixture';
import {
  groupByCurrency,
  isValidDateString,
  isValidDayOfMonth,
  looksLikeBudgetDatabase,
  parseId,
  validateRecurringItemFields,
  withSinkingFundContribution,
} from './api';

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

describe('isValidDateString', () => {
  it('accepts a real YYYY-MM-DD calendar date', () => {
    expect(isValidDateString('2026-09-04')).toBe(true);
  });

  it('rejects a non-string and a malformed shape', () => {
    expect(isValidDateString(20260904)).toBe(false);
    expect(isValidDateString('2026/09/04')).toBe(false);
  });

  it('does not catch a calendar date that does not exist — JS Date silently rolls it over', () => {
    // Feb 30 becomes Mar 2, which parses fine, so this is accepted. Documented
    // here as existing behavior, not asserted as correct.
    expect(isValidDateString('2026-02-30')).toBe(true);
  });
});

describe('isValidDayOfMonth', () => {
  it('accepts integers from 1 to 31', () => {
    expect(isValidDayOfMonth(1)).toBe(true);
    expect(isValidDayOfMonth(31)).toBe(true);
  });

  it('rejects 0, 32, and non-integers', () => {
    expect(isValidDayOfMonth(0)).toBe(false);
    expect(isValidDayOfMonth(32)).toBe(false);
    expect(isValidDayOfMonth(15.5)).toBe(false);
    expect(isValidDayOfMonth('15')).toBe(false);
  });
});

describe('parseId', () => {
  it('parses a numeric route param', () => {
    expect(parseId('42')).toBe(42);
  });

  it('returns null for anything non-integer, so callers fall through to a 404', () => {
    expect(parseId('abc')).toBeNull();
    expect(parseId('4.5')).toBeNull();
  });
});

describe('validateRecurringItemFields', () => {
  const valid = {
    name: 'Rent',
    amountCents: -150_000,
    frequency: 'monthly',
    interval: 1,
    startDate: '2026-01-01',
  };

  it('accepts a minimal valid payload, defaulting endDate/semiMonthlyDay*/sinkingFund to null/undefined', () => {
    const result = validateRecurringItemFields(valid);
    expect(result).toEqual({
      value: {
        name: 'Rent',
        amountCents: -150_000,
        frequency: 'monthly',
        interval: 1,
        startDate: '2026-01-01',
        endDate: null,
        semiMonthlyDay1: null,
        semiMonthlyDay2: null,
        sinkingFund: undefined,
      },
    });
  });

  it('rejects a blank name', () => {
    expect(validateRecurringItemFields({ ...valid, name: '  ' })).toEqual({ error: 'name is required' });
  });

  it('rejects an unknown frequency', () => {
    expect(validateRecurringItemFields({ ...valid, frequency: 'fortnightly' })).toEqual({
      error: 'frequency must be one of daily, weekly, monthly, yearly, semimonthly',
    });
  });

  it('requires both semi-monthly days when frequency is semimonthly', () => {
    expect(validateRecurringItemFields({ ...valid, frequency: 'semimonthly', semiMonthlyDay1: 1 })).toEqual({
      error: 'semiMonthlyDay1 and semiMonthlyDay2 are required (1-31) for semimonthly frequency',
    });
  });

  it('accepts a semi-monthly item once both days are present', () => {
    const result = validateRecurringItemFields({ ...valid, frequency: 'semimonthly', semiMonthlyDay1: 1, semiMonthlyDay2: 15 });
    expect('value' in result && result.value.semiMonthlyDay1).toBe(1);
  });
});

describe('withSinkingFundContribution', () => {
  it('returns nulls for a non-sinking-fund item', () => {
    const result = withSinkingFundContribution(recurringItemRow(), '2026-01-01');
    expect(result.nextOccurrenceDate).toBeNull();
    expect(result.suggestedMonthlySetAsideCents).toBeNull();
  });

  it('computes the next occurrence and monthly set-aside for a sinking-fund item', () => {
    const result = withSinkingFundContribution(recurringItemRow({ sinking_fund: 1, amount_cents: -1200, start_date: '2026-06-01' }), '2026-01-01');
    expect(result.sinkingFund).toBe(true);
    expect(result.nextOccurrenceDate).toBe('2026-06-01');
    expect(result.suggestedMonthlySetAsideCents).toBe(-1200);
  });
});

describe('groupByCurrency', () => {
  it('groups items sharing a currency together, in first-seen order', () => {
    const groups = groupByCurrency([{ currency: 'CAD', id: 1 }, { currency: 'USD', id: 2 }, { currency: 'CAD', id: 3 }]);
    expect(groups).toEqual([
      [{ currency: 'CAD', id: 1 }, { currency: 'CAD', id: 3 }],
      [{ currency: 'USD', id: 2 }],
    ]);
  });
});

describe('looksLikeBudgetDatabase', () => {
  it('returns false for a file that is not a SQLite database at all', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'simple-budget-test-'));
    const path = join(dir, 'garbage.db');
    await writeFile(path, 'not a database');
    try {
      expect(looksLikeBudgetDatabase(path)).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('returns false for a path that does not exist', () => {
    expect(looksLikeBudgetDatabase('/nonexistent/path.db')).toBe(false);
  });
});

describe('routes', () => {
  it('POST /accounts creates an account, GET /accounts lists it', async () => {
    await withTestApp(async (app) => {
      const created = await request(app).post('/api/accounts').send({ name: 'Chequing', currency: 'CAD' });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ name: 'Chequing', currency: 'CAD' });

      const listed = await request(app).get('/api/accounts');
      expect(listed.body).toEqual([created.body]);
    });
  });

  it('POST /accounts rejects an unsupported currency', async () => {
    await withTestApp(async (app) => {
      const res = await request(app).post('/api/accounts').send({ name: 'Chequing', currency: 'JPY' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/currency must be one of/);
    });
  });

  it('POST /accounts/:id/recurring-items rejects an invalid payload with 400', async () => {
    await withTestApp(async (app) => {
      const account = await request(app).post('/api/accounts').send({ name: 'Chequing', currency: 'CAD' });
      const res = await request(app)
        .post(`/api/accounts/${account.body.id}/recurring-items`)
        .send({ name: '', amountCents: -100, frequency: 'monthly', interval: 1, startDate: '2026-01-01' });
      expect(res.status).toBe(400);
    });
  });

  it('GET /accounts/:id/projection returns 422 when no starting balance is set', async () => {
    await withTestApp(async (app) => {
      const account = await request(app).post('/api/accounts').send({ name: 'Chequing', currency: 'CAD' });
      const res = await request(app).get(`/api/accounts/${account.body.id}/projection?from=2026-01-01&to=2026-01-31`);
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('starting_balance_not_set');
    });
  });

  it('GET /accounts/:id/projection projects a day-by-day balance once a starting balance is set', async () => {
    await withTestApp(async (app) => {
      const account = await request(app).post('/api/accounts').send({ name: 'Chequing', currency: 'CAD' });
      await request(app)
        .patch(`/api/accounts/${account.body.id}`)
        .send({ startingBalanceCents: 100_000, startingBalanceDate: '2026-01-01' });

      const res = await request(app).get(`/api/accounts/${account.body.id}/projection?from=2026-01-01&to=2026-01-03`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      expect(res.body[0].balanceCents).toBe(100_000);
    });
  });

  it('GET /accounts/:id/projection rejects a `to` before `from`', async () => {
    await withTestApp(async (app) => {
      const account = await request(app).post('/api/accounts').send({ name: 'Chequing', currency: 'CAD' });
      const res = await request(app).get(`/api/accounts/${account.body.id}/projection?from=2026-01-31&to=2026-01-01`);
      expect(res.status).toBe(400);
    });
  });

  it('POST /accounts/:id/projection/preview blends a scratch item into the real projection without persisting it', async () => {
    await withTestApp(async (app) => {
      const account = await request(app).post('/api/accounts').send({ name: 'Chequing', currency: 'CAD' });
      await request(app)
        .patch(`/api/accounts/${account.body.id}`)
        .send({ startingBalanceCents: 100_000, startingBalanceDate: '2026-01-01' });

      const res = await request(app)
        .post(`/api/accounts/${account.body.id}/projection/preview`)
        .send({
          from: '2026-01-01',
          to: '2026-01-02',
          scratchItems: [
            { id: -1, name: 'Scratch', amountCents: -5_000, frequency: 'daily', interval: 1, startDate: '2026-01-02' },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body[1].balanceCents).toBe(95_000);
      // Never written: the account's real recurring items are still empty.
      const items = await request(app).get(`/api/accounts/${account.body.id}/recurring-items`);
      expect(items.body).toEqual([]);
    });
  });

  it('POST /wipe backs up the database first, then empties every account', async () => {
    await withTestApp(async (app) => {
      await request(app).post('/api/accounts').send({ name: 'Chequing', currency: 'CAD' });

      const res = await request(app).post('/api/wipe');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(typeof res.body.backupPath).toBe('string');

      const accounts = await request(app).get('/api/accounts');
      expect(accounts.body).toEqual([]);
    });
  });
});
