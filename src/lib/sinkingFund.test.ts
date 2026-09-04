import { describe, expect, it } from 'vitest';
import { summarizeSinkingFunds, type SinkingFundItem } from './sinkingFund';

const TODAY = '2026-09-01';

function bill(overrides: Partial<SinkingFundItem> = {}): SinkingFundItem {
  return {
    sinkingFund: true,
    amountCents: -120000,
    nextOccurrenceDate: '2026-12-01',
    suggestedMonthlySetAsideCents: -10000,
    ...overrides,
  };
}

describe('summarizeSinkingFunds', () => {
  it('returns nothing when no item is a sinking fund', () => {
    expect(summarizeSinkingFunds([bill({ sinkingFund: false })], TODAY)).toBeNull();
    expect(summarizeSinkingFunds([], TODAY)).toBeNull();
  });

  it('ignores sinking-fund items with no upcoming occurrence', () => {
    expect(summarizeSinkingFunds([bill({ nextOccurrenceDate: null, suggestedMonthlySetAsideCents: null })], TODAY)).toBeNull();
  });

  it('reports the ongoing cost as a positive magnitude', () => {
    expect(summarizeSinkingFunds([bill()], TODAY)?.ongoingCents).toBe(10000);
  });

  it('sums both figures across bills', () => {
    const summary = summarizeSinkingFunds([bill(), bill({ amountCents: -240000, suggestedMonthlySetAsideCents: -20000 })], TODAY);
    expect(summary?.ongoingCents).toBe(30000);
    // 1,200 and 2,400 both due about 3 months out, so catching up costs
    // roughly four times the twelve-month rate.
    expect(summary?.catchUpCents).toBeGreaterThan(119000);
    expect(summary?.catchUpCents).toBeLessThan(122000);
  });

  it('catches each bill up against its own due date', () => {
    // One bill 3 months out, one 12 months out: they catch up at different rates.
    const summary = summarizeSinkingFunds(
      [bill(), bill({ amountCents: -120000, nextOccurrenceDate: '2027-09-01', suggestedMonthlySetAsideCents: -10000 })],
      TODAY,
    );
    expect(summary?.ongoingCents).toBe(20000);
    // ~40,000 for the near bill plus ~10,000 for the far one.
    expect(summary?.catchUpCents).toBeGreaterThan(48000);
    expect(summary?.catchUpCents).toBeLessThan(51000);
  });

  it('flags being behind when the bill lands sooner than it amortizes', () => {
    expect(summarizeSinkingFunds([bill()], TODAY)?.isBehind).toBe(true);
  });

  it('is not behind once a bill is a full period away', () => {
    // A year measured in real days is 11.99 average months, so catch-up lands a
    // few cents above ongoing. That drift must not read as being behind.
    const summary = summarizeSinkingFunds([bill({ nextOccurrenceDate: '2027-09-01' })], TODAY);
    expect(summary?.isBehind).toBe(false);
    expect(summary?.catchUpCents).toBeCloseTo(summary!.ongoingCents, -2);
  });

  it('asks for the whole amount when the bill is nearly due', () => {
    // Floored at one month, so it reads "you need all of it now" rather than
    // an inflated multiple of the bill.
    const summary = summarizeSinkingFunds([bill({ nextOccurrenceDate: '2026-09-03' })], TODAY);
    expect(summary?.catchUpCents).toBe(120000);
  });
});
