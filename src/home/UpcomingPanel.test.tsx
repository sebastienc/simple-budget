import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18next from 'i18next';
import UpcomingPanel, { dayLabel } from './UpcomingPanel';
import type { ProjectionEvent, ProjectionSummary } from '@/lib/projection';

function event(overrides: Partial<ProjectionEvent> = {}): ProjectionEvent {
  return {
    date: '2026-01-15',
    items: [{ id: 1, name: 'Paycheck', amountCents: 300_000 }],
    dailyTotalCents: 300_000,
    ...overrides,
  };
}

describe('dayLabel', () => {
  it('uses the single item\'s own name when there is only one', () => {
    expect(dayLabel(event(), i18next.t)).toBe('Paycheck');
  });

  it('leads with the largest item by magnitude and singularizes "1 other"', () => {
    const label = dayLabel(
      event({
        items: [
          { id: 1, name: 'Paycheck', amountCents: 300_000 },
          { id: 2, name: 'Loan payment', amountCents: -50_000 },
        ],
      }),
      i18next.t,
    );
    expect(label).toBe('Paycheck and 1 other');
  });

  it('pluralizes "others" for more than one other item', () => {
    const label = dayLabel(
      event({
        items: [
          { id: 1, name: 'Groceries', amountCents: -10_000 },
          { id: 2, name: 'Car fuel', amountCents: -5_000 },
          { id: 3, name: 'Cleaning', amountCents: -3_000 },
        ],
      }),
      i18next.t,
    );
    expect(label).toBe('Groceries and 2 others');
  });
});

describe('UpcomingPanel', () => {
  const baseSummary: ProjectionSummary = {
    openingCents: 0,
    closingCents: 0,
    lowest: { cents: 0, date: '2026-01-01' },
    firstNegativeDate: null,
    lastDate: '2026-01-31',
    events: [],
  };

  it('renders nothing when summary is null', () => {
    const { container } = render(<UpcomingPanel currency="CAD" summary={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the empty state when there are no events', () => {
    render(<UpcomingPanel currency="CAD" summary={baseSummary} />);
    expect(screen.getByText('Nothing scheduled in this range')).toBeInTheDocument();
  });

  it('titles the panel "What\'s coming" for a future-looking window', () => {
    render(<UpcomingPanel currency="CAD" summary={{ ...baseSummary, events: [event({ date: '2999-01-15' })] }} />);
    expect(screen.getByText("What's coming")).toBeInTheDocument();
  });

  it('shows the negative-balance warning when the projection goes negative', () => {
    render(<UpcomingPanel currency="CAD" summary={{ ...baseSummary, firstNegativeDate: '2026-01-20', events: [event({ date: '2999-01-15' })] }} />);
    expect(screen.getByText(/Balance goes negative/)).toBeInTheDocument();
  });
});
