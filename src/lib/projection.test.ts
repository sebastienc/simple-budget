import { describe, expect, it } from 'vitest';
import { summarizeProjection } from './projection';
import type { ProjectionDay } from '@/data/useProjection';

function day(date: string, balanceCents: number, items: ProjectionDay['items'] = []): ProjectionDay {
  return { date, items, dailyTotalCents: items.reduce((sum, i) => sum + i.amountCents, 0), balanceCents, correctionApplied: false };
}

describe('summarizeProjection', () => {
  it('returns nothing for an empty projection', () => {
    expect(summarizeProjection([])).toBeNull();
  });

  it('finds the lowest balance and the day it happens', () => {
    const summary = summarizeProjection([day('2026-01-01', 500), day('2026-01-02', 100), day('2026-01-03', 300)]);
    expect(summary?.lowest).toEqual({ cents: 100, date: '2026-01-02' });
  });

  it('keeps the first of several equally low days', () => {
    const summary = summarizeProjection([day('2026-01-01', 100), day('2026-01-02', 100)]);
    expect(summary?.lowest.date).toBe('2026-01-01');
  });

  it('reports the first day the balance goes negative, not the lowest one', () => {
    const summary = summarizeProjection([day('2026-01-01', 50), day('2026-01-02', -10), day('2026-01-03', -900)]);
    expect(summary?.firstNegativeDate).toBe('2026-01-02');
    expect(summary?.lowest.date).toBe('2026-01-03');
  });

  it('leaves firstNegativeDate null when the balance never dips', () => {
    expect(summarizeProjection([day('2026-01-01', 1), day('2026-01-02', 0)])?.firstNegativeDate).toBeNull();
  });

  it('collects only the days that carry items', () => {
    const summary = summarizeProjection([day('2026-01-01', 500), day('2026-01-02', 400, [{ id: 7, name: 'Rent', amountCents: -100 }]), day('2026-01-03', 400)]);
    expect(summary?.events).toEqual([{ date: '2026-01-02', items: [{ id: 7, name: 'Rent', amountCents: -100 }], dailyTotalCents: -100 }]);
  });

  it('reports the opening, closing and last date of the window', () => {
    const summary = summarizeProjection([day('2026-01-01', 500), day('2026-01-02', 400), day('2026-01-03', 450)]);
    expect(summary?.openingCents).toBe(500);
    expect(summary?.closingCents).toBe(450);
    expect(summary?.lastDate).toBe('2026-01-03');
  });
});
