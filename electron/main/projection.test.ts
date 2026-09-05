import { describe, expect, it } from 'vitest';
import { computeCorrectionAccuracy, computeSinkingFundContribution, mergeCheckpoints, projectBalance, sumProjections, type RecurringItemInput } from './projection';

function item(overrides: Partial<RecurringItemInput> = {}): RecurringItemInput {
  return {
    id: 1,
    name: 'Item',
    amountCents: -10000,
    frequency: 'monthly',
    interval: 1,
    startDate: '2026-01-01',
    endDate: null,
    semiMonthlyDay1: null,
    semiMonthlyDay2: null,
    ...overrides,
  };
}

/** The dates an item actually lands on inside a window. */
function occurrences(input: RecurringItemInput, from: string, to: string): string[] {
  return projectBalance({ checkpoints: [{ date: from, balanceCents: 0 }], items: [input], from, to })
    .filter((day) => day.items.length > 0)
    .map((day) => day.date);
}

describe('occurrence rules', () => {
  it('respects the start date', () => {
    expect(occurrences(item({ frequency: 'daily', startDate: '2026-03-03' }), '2026-03-01', '2026-03-05')).toEqual(['2026-03-03', '2026-03-04', '2026-03-05']);
  });

  it('respects the end date', () => {
    expect(occurrences(item({ frequency: 'daily', startDate: '2026-03-01', endDate: '2026-03-03' }), '2026-03-01', '2026-03-06')).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
    ]);
  });

  it('fires exactly once when the end date equals the start date (a one-time payment)', () => {
    expect(occurrences(item({ frequency: 'daily', startDate: '2026-03-10', endDate: '2026-03-10' }), '2026-03-01', '2026-03-31')).toEqual(['2026-03-10']);
  });

  it('honours the interval', () => {
    expect(occurrences(item({ frequency: 'weekly', interval: 2, startDate: '2026-03-02' }), '2026-03-01', '2026-04-01')).toEqual([
      '2026-03-02',
      '2026-03-16',
      '2026-03-30',
    ]);
  });

  it('clamps a monthly item started on the 31st into shorter months', () => {
    // Not skipped, and not spilling into the 1st of the next month.
    expect(occurrences(item({ frequency: 'monthly', startDate: '2026-01-31' }), '2026-01-01', '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('clamps a Feb 29 yearly item in non-leap years', () => {
    expect(occurrences(item({ frequency: 'yearly', startDate: '2024-02-29' }), '2027-02-01', '2027-03-05')).toEqual(['2027-02-28']);
  });
});

describe('semi-monthly pay dates', () => {
  const pay = item({ frequency: 'semimonthly', amountCents: 250000, startDate: '2026-01-01', semiMonthlyDay1: 15, semiMonthlyDay2: 30 });

  it('shifts a Saturday payday back to the Friday', () => {
    // 2026-08-15 is a Saturday.
    expect(occurrences(pay, '2026-08-10', '2026-08-20')).toEqual(['2026-08-14']);
  });

  it('shifts a Sunday payday back to the Friday', () => {
    // 2026-08-30 is a Sunday.
    expect(occurrences(pay, '2026-08-25', '2026-08-31')).toEqual(['2026-08-28']);
  });

  it('shifts across a month boundary when the 1st falls on a weekend', () => {
    // 2026-08-01 is a Saturday, so the payday belongs to 31 July.
    const firstOfMonth = item({ frequency: 'semimonthly', startDate: '2026-01-01', semiMonthlyDay1: 1, semiMonthlyDay2: 15 });
    expect(occurrences(firstOfMonth, '2026-07-29', '2026-08-03')).toEqual(['2026-07-31']);
  });

  it('clamps day 31 to the end of a shorter month before shifting', () => {
    // November has 30 days and 2026-11-30 is a Monday, so no shift applies.
    const endOfMonth = item({ frequency: 'semimonthly', startDate: '2026-01-01', semiMonthlyDay1: 15, semiMonthlyDay2: 31 });
    expect(occurrences(endOfMonth, '2026-11-25', '2026-12-01')).toEqual(['2026-11-30']);
  });
});

describe('projectBalance', () => {
  it('carries the balance forward and applies items on their day', () => {
    const days = projectBalance({
      checkpoints: [{ date: '2026-01-01', balanceCents: 100000 }],
      items: [item({ frequency: 'daily', startDate: '2026-01-02', endDate: '2026-01-02', amountCents: -25000 })],
      from: '2026-01-01',
      to: '2026-01-03',
    });
    expect(days.map((day) => day.balanceCents)).toEqual([100000, 75000, 75000]);
  });

  it('accumulates from the anchor even when the window starts later', () => {
    const days = projectBalance({
      checkpoints: [{ date: '2026-01-01', balanceCents: 0 }],
      items: [item({ frequency: 'daily', startDate: '2026-01-01', amountCents: 1000 })],
      from: '2026-01-10',
      to: '2026-01-10',
    });
    // Ten daily occurrences have already happened by the 10th.
    expect(days).toHaveLength(1);
    expect(days[0].balanceCents).toBe(10000);
  });

  it('snaps to a later checkpoint and flags only that day', () => {
    const days = projectBalance({
      checkpoints: [
        { date: '2026-01-01', balanceCents: 100000 },
        { date: '2026-01-03', balanceCents: 500 },
      ],
      items: [],
      from: '2026-01-01',
      to: '2026-01-04',
    });
    expect(days.map((day) => day.balanceCents)).toEqual([100000, 100000, 500, 500]);
    expect(days.map((day) => day.correctionApplied)).toEqual([false, false, true, false]);
  });

  it('clamps a window that starts before the anchor', () => {
    const days = projectBalance({ checkpoints: [{ date: '2026-01-05', balanceCents: 0 }], items: [], from: '2026-01-01', to: '2026-01-06' });
    expect(days[0].date).toBe('2026-01-05');
  });

  it('returns nothing when the window ends before it starts', () => {
    expect(projectBalance({ checkpoints: [{ date: '2026-01-01', balanceCents: 0 }], items: [], from: '2026-02-01', to: '2026-01-01' })).toEqual([]);
  });
});

describe('mergeCheckpoints', () => {
  it('lets an explicit correction win over the starting balance on the same date', () => {
    const merged = mergeCheckpoints({ date: '2026-01-01', balanceCents: 100 }, [{ date: '2026-01-01', balanceCents: 999 }]);
    expect(merged).toEqual([{ date: '2026-01-01', balanceCents: 999 }]);
  });

  it('keeps corrections on other dates', () => {
    const merged = mergeCheckpoints({ date: '2026-01-01', balanceCents: 100 }, [{ date: '2026-02-01', balanceCents: 999 }]);
    expect(merged).toHaveLength(2);
  });
});

describe('sumProjections', () => {
  it('adds balances positionally across accounts', () => {
    const a = projectBalance({ checkpoints: [{ date: '2026-01-01', balanceCents: 100 }], items: [], from: '2026-01-01', to: '2026-01-02' });
    const b = projectBalance({ checkpoints: [{ date: '2026-01-01', balanceCents: 25 }], items: [], from: '2026-01-01', to: '2026-01-02' });
    expect(sumProjections([a, b])).toEqual([
      { date: '2026-01-01', totalCents: 125 },
      { date: '2026-01-02', totalCents: 125 },
    ]);
  });

  it('returns nothing for no accounts', () => {
    expect(sumProjections([])).toEqual([]);
  });
});

describe('computeSinkingFundContribution', () => {
  const today = '2026-09-04';

  it('amortizes a yearly bill over twelve months', () => {
    const result = computeSinkingFundContribution(item({ frequency: 'yearly', amountCents: -120000, startDate: '2026-12-01' }), today);
    expect(result.suggestedMonthlySetAsideCents).toBe(-10000);
    expect(result.nextOccurrenceDate).toBe('2026-12-01');
  });

  it('amortizes over the interval, not just the frequency', () => {
    expect(computeSinkingFundContribution(item({ frequency: 'yearly', interval: 2, amountCents: -240000, startDate: '2027-05-01' }), today).suggestedMonthlySetAsideCents).toBe(
      -10000,
    );
    expect(computeSinkingFundContribution(item({ frequency: 'monthly', interval: 3, amountCents: -30000, startDate: '2026-10-01' }), today).suggestedMonthlySetAsideCents).toBe(
      -10000,
    );
  });

  it('gives the monthly cost of a sub-monthly item, which exceeds one occurrence', () => {
    expect(computeSinkingFundContribution(item({ frequency: 'semimonthly', amountCents: -50000, semiMonthlyDay1: 15, semiMonthlyDay2: 30 }), today).suggestedMonthlySetAsideCents).toBe(
      -100000,
    );
    expect(computeSinkingFundContribution(item({ frequency: 'weekly', amountCents: -10000, startDate: '2026-09-07' }), today).suggestedMonthlySetAsideCents).toBe(-43481);
  });

  it('stays the same as the due date approaches', () => {
    // The regression that motivated deriving the period from the recurrence
    // rule: measuring the gap to the next occurrence made this figure climb
    // every day, and compress the whole bill into whatever time was left.
    const bill = item({ frequency: 'yearly', amountCents: -120000, startDate: '2026-12-01' });
    const readings = ['2026-01-15', '2026-09-04', '2026-11-25', '2026-11-30'].map((day) => computeSinkingFundContribution(bill, day).suggestedMonthlySetAsideCents);
    expect(new Set(readings)).toEqual(new Set([-10000]));
  });

  it('reports nothing once the item has no future occurrence', () => {
    const expired = item({ frequency: 'yearly', amountCents: -120000, startDate: '2020-01-01', endDate: '2021-01-01' });
    expect(computeSinkingFundContribution(expired, today)).toEqual({ nextOccurrenceDate: null, suggestedMonthlySetAsideCents: null });
  });
});

describe('computeCorrectionAccuracy', () => {
  // A mortgage on the 15th, and a correction recorded on the 15th. A correction
  // is the balance at the START of its day, so the forecast it should be
  // compared against is the close of the 14th — before the mortgage lands.
  const mortgage = item({ frequency: 'monthly', startDate: '2026-01-15', amountCents: -124000 });

  it('compares against the day before the correction, not the correction day', () => {
    const [accuracy] = computeCorrectionAccuracy(
      [
        { date: '2026-01-01', balanceCents: 100000 },
        { date: '2026-01-15', balanceCents: 100000 },
      ],
      [mortgage],
    );
    // Nothing lands between the 1st and the 14th, so the forecast was exactly
    // right. Comparing against the 15th's close instead would apply the
    // mortgage and report a drift of -124000 — wrong, but plausible enough to
    // ship unnoticed.
    expect(accuracy.projectedCents).toBe(100000);
    expect(accuracy.driftCents).toBe(0);
  });

  it('reports a positive drift when the forecast ran high', () => {
    // Forecast says 100000, reality was 95000: 5000 less than promised.
    const [accuracy] = computeCorrectionAccuracy(
      [
        { date: '2026-01-01', balanceCents: 100000 },
        { date: '2026-01-10', balanceCents: 95000 },
      ],
      [],
    );
    expect(accuracy.driftCents).toBe(5000);
  });

  it('reports a negative drift when the forecast ran low', () => {
    const [accuracy] = computeCorrectionAccuracy(
      [
        { date: '2026-01-01', balanceCents: 100000 },
        { date: '2026-01-10', balanceCents: 108000 },
      ],
      [],
    );
    expect(accuracy.driftCents).toBe(-8000);
  });

  it('accounts for items landing between the two corrections', () => {
    const groceries = item({ frequency: 'weekly', startDate: '2026-01-05', amountCents: -10000 });
    const [accuracy] = computeCorrectionAccuracy(
      [
        { date: '2026-01-01', balanceCents: 100000 },
        { date: '2026-01-20', balanceCents: 70000 },
      ],
      [groceries],
    );
    // Groceries on the 5th, 12th and 19th — all before the 20th.
    expect(accuracy.projectedCents).toBe(70000);
    expect(accuracy.driftCents).toBe(0);
  });

  it('skips the earliest checkpoint rather than reporting it as zero drift', () => {
    const accuracy = computeCorrectionAccuracy(
      [
        { date: '2026-01-01', balanceCents: 100000 },
        { date: '2026-01-10', balanceCents: 95000 },
      ],
      [],
    );
    expect(accuracy).toHaveLength(1);
    expect(accuracy[0].date).toBe('2026-01-10');
  });

  it('measures each correction from the previous one, not from the origin', () => {
    const accuracy = computeCorrectionAccuracy(
      [
        { date: '2026-01-01', balanceCents: 100000 },
        { date: '2026-01-10', balanceCents: 90000 },
        { date: '2026-01-20', balanceCents: 85000 },
      ],
      [],
    );
    // Second drift is 90000 (carried from the first correction) − 85000, not
    // 100000 − 85000, which is what measuring from the origin would give.
    expect(accuracy.map((a) => a.driftCents)).toEqual([10000, 5000]);
    expect(accuracy.map((a) => a.daysSincePrevious)).toEqual([9, 10]);
  });

  it('returns nothing when there is only an origin', () => {
    expect(computeCorrectionAccuracy([{ date: '2026-01-01', balanceCents: 100000 }], [])).toEqual([]);
    expect(computeCorrectionAccuracy([], [])).toEqual([]);
  });

  it('handles corrections on consecutive days', () => {
    const [accuracy] = computeCorrectionAccuracy(
      [
        { date: '2026-01-01', balanceCents: 100000 },
        { date: '2026-01-02', balanceCents: 100000 },
      ],
      [],
    );
    expect(accuracy.driftCents).toBe(0);
    expect(accuracy.daysSincePrevious).toBe(1);
  });
});
