import { describe, expect, it } from 'vitest';
import { summarizeAccuracy } from './accuracy';

describe('summarizeAccuracy', () => {
  it('says nothing when there are no corrections', () => {
    expect(summarizeAccuracy([])).toBeNull();
  });

  it('says nothing when the only correction is an origin', () => {
    expect(summarizeAccuracy([{ driftCents: null, daysSincePrevious: null }])).toBeNull();
  });

  it('reports a monthly rate from a single measured correction', () => {
    // 1,000 of drift accumulated over ~one month.
    const summary = summarizeAccuracy([{ driftCents: 100000, daysSincePrevious: 30 }]);
    expect(summary?.measuredCount).toBe(1);
    expect(summary?.runsHigh).toBe(true);
    expect(summary?.driftPerMonthCents).toBeCloseTo(101456, -3);
  });

  it('is a rate, not a total — twice the span at the same rate reads the same', () => {
    const oneMonth = summarizeAccuracy([{ driftCents: 100000, daysSincePrevious: 30 }]);
    const twoMonths = summarizeAccuracy([{ driftCents: 200000, daysSincePrevious: 60 }]);
    expect(oneMonth?.driftPerMonthCents).toBe(twoMonths?.driftPerMonthCents);
    // ...even though the totals differ.
    expect(oneMonth?.totalDriftCents).not.toBe(twoMonths?.totalDriftCents);
  });

  it('pools drift and days across corrections rather than averaging the rates', () => {
    const summary = summarizeAccuracy([
      { driftCents: 10000, daysSincePrevious: 10 },
      { driftCents: 20000, daysSincePrevious: 50 },
    ]);
    expect(summary?.measuredCount).toBe(2);
    expect(summary?.totalDriftCents).toBe(30000);
    // 30000 over 60 days, not the mean of the two per-correction rates.
    expect(summary?.driftPerMonthCents).toBe(Math.round((30000 / 60) * 30.4368));
  });

  it('flags a forecast that runs low', () => {
    const summary = summarizeAccuracy([{ driftCents: -50000, daysSincePrevious: 30 }]);
    expect(summary?.runsHigh).toBe(false);
    expect(summary?.driftPerMonthCents).toBeLessThan(0);
  });

  it('ignores corrections with no measurement behind them', () => {
    const summary = summarizeAccuracy([
      { driftCents: null, daysSincePrevious: null },
      { driftCents: 10000, daysSincePrevious: 30 },
    ]);
    expect(summary?.measuredCount).toBe(1);
  });

  it('ignores a zero-day span rather than dividing by zero', () => {
    expect(summarizeAccuracy([{ driftCents: 5000, daysSincePrevious: 0 }])).toBeNull();
  });
});
