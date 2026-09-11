import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProjectionTable, { toLedgerRows } from './ProjectionTable';
import type { ProjectionDay } from '@/data/useProjection';
import type { ProjectionSummary } from '@/lib/projection';

function day(overrides: Partial<ProjectionDay> = {}): ProjectionDay {
  return {
    date: '2026-01-01',
    items: [],
    dailyTotalCents: 0,
    balanceCents: 1000,
    correctionApplied: false,
    ...overrides,
  };
}

describe('toLedgerRows', () => {
  it('collapses a run of quiet days into a single row', () => {
    const rows = toLedgerRows([day({ date: '2026-01-01' }), day({ date: '2026-01-02' }), day({ date: '2026-01-03' })]);
    expect(rows).toEqual([{ kind: 'quiet', from: '2026-01-01', to: '2026-01-03', balanceCents: 1000 }]);
  });

  it('keeps a single quiet day as a `day` row rather than a one-day `quiet` range', () => {
    const rows = toLedgerRows([day({ date: '2026-01-01' })]);
    expect(rows).toEqual([{ kind: 'day', day: day({ date: '2026-01-01' }) }]);
  });

  it('breaks a quiet run whenever a day has items or a correction', () => {
    const withItem = day({ date: '2026-01-02', items: [{ id: 1, name: 'Rent', amountCents: -1000 }] });
    const rows = toLedgerRows([day({ date: '2026-01-01' }), withItem, day({ date: '2026-01-03' })]);

    // Each quiet side of the break is only one day long, so it surfaces as a
    // `day` row (a one-day `quiet` range would say nothing a `day` row doesn't).
    expect(rows).toEqual([
      { kind: 'day', day: day({ date: '2026-01-01' }) },
      { kind: 'day', day: withItem },
      { kind: 'day', day: day({ date: '2026-01-03' }) },
    ]);
  });

  it('collapses a quiet run of two or more days on either side of a break', () => {
    const withItem = day({ date: '2026-01-03', items: [{ id: 1, name: 'Rent', amountCents: -1000 }] });
    const rows = toLedgerRows([day({ date: '2026-01-01' }), day({ date: '2026-01-02' }), withItem, day({ date: '2026-01-04' }), day({ date: '2026-01-05' })]);

    expect(rows).toEqual([
      { kind: 'quiet', from: '2026-01-01', to: '2026-01-02', balanceCents: 1000 },
      { kind: 'day', day: withItem },
      { kind: 'quiet', from: '2026-01-04', to: '2026-01-05', balanceCents: 1000 },
    ]);
  });

  it('treats a day with correctionApplied as active even with no items', () => {
    const corrected = day({ date: '2026-01-02', correctionApplied: true });
    const rows = toLedgerRows([day({ date: '2026-01-01' }), corrected]);
    expect(rows[1]).toEqual({ kind: 'day', day: corrected });
  });

  it('returns an empty array for an empty projection', () => {
    expect(toLedgerRows([])).toEqual([]);
  });
});

describe('ProjectionTable', () => {
  const summary: ProjectionSummary = {
    openingCents: 1000,
    closingCents: 1000,
    lowest: { cents: 1000, date: '2026-01-01' },
    firstNegativeDate: null,
    lastDate: '2026-01-01',
    events: [],
  };

  it('renders nothing when there are no days', () => {
    const { container } = render(<ProjectionTable days={[]} currency="CAD" summary={summary} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when summary is null, even with days present', () => {
    const { container } = render(<ProjectionTable days={[day()]} currency="CAD" summary={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the lowest-point row for a non-empty projection', () => {
    render(<ProjectionTable days={[day()]} currency="CAD" summary={summary} />);
    expect(screen.getByText('Lowest point')).toBeInTheDocument();
  });
});
