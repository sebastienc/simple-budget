import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import AccountHero from './AccountHero';
import type { ProjectionSummary } from '@/lib/projection';

describe('AccountHero', () => {
  it('shows the no-data state when summary is null', () => {
    render(<AccountHero accountName="Chequing" currency="CAD" summary={null} sinkingFund={null} accuracy={null} />);
    expect(screen.getByText('Nothing scheduled yet.')).toBeInTheDocument();
  });

  it('states the lowest point plainly when the account never goes negative', () => {
    const summary: ProjectionSummary = {
      openingCents: 100_000,
      closingCents: 80_000,
      lowest: { cents: 50_000, date: '2026-01-15' },
      firstNegativeDate: null,
      lastDate: '2026-01-31',
      events: [],
    };
    render(<AccountHero accountName="Chequing" currency="CAD" summary={summary} sinkingFund={null} accuracy={null} />);
    expect(screen.getByText(/Lowest point/)).toBeInTheDocument();
    expect(screen.getByText(/Stays above zero/)).toBeInTheDocument();
  });

  it('names the triggering items when the account goes negative', () => {
    const summary: ProjectionSummary = {
      openingCents: 10_000,
      closingCents: -5_000,
      lowest: { cents: -5_000, date: '2026-01-20' },
      firstNegativeDate: '2026-01-20',
      lastDate: '2026-01-31',
      events: [
        {
          date: '2026-01-20',
          items: [
            { id: 1, name: 'Rent', amountCents: -150_00 },
            { id: 2, name: 'Car payment', amountCents: -30_00 },
          ],
          dailyTotalCents: -180_00,
        },
      ],
    };
    render(<AccountHero accountName="Chequing" currency="CAD" summary={summary} sinkingFund={null} accuracy={null} />);
    expect(screen.getByText(/Short by/)).toBeInTheDocument();
    expect(screen.getByText(/Rent · Car payment lands/)).toBeInTheDocument();
    expect(screen.getByText(/It doesn't recover on its own/)).toBeInTheDocument();
  });

  it('shows both sinking-fund badges when behind, and only the ongoing one otherwise', () => {
    const summary: ProjectionSummary = {
      openingCents: 100_000,
      closingCents: 100_000,
      lowest: { cents: 100_000, date: '2026-01-01' },
      firstNegativeDate: null,
      lastDate: '2026-01-31',
      events: [],
    };

    const { rerender } = render(
      <AccountHero accountName="Chequing" currency="CAD" summary={summary} sinkingFund={{ ongoingCents: 5000, catchUpCents: 0, isBehind: false }} accuracy={null} />,
    );
    expect(screen.getByText(/ongoing/)).toBeInTheDocument();
    expect(screen.queryByText(/catch up/)).not.toBeInTheDocument();

    rerender(
      <AccountHero accountName="Chequing" currency="CAD" summary={summary} sinkingFund={{ ongoingCents: 5000, catchUpCents: 2000, isBehind: true }} accuracy={null} />,
    );
    expect(screen.getByText(/ongoing/)).toBeInTheDocument();
    expect(screen.getByText(/catch up/)).toBeInTheDocument();
  });

  it('shows the accuracy drift note when accuracy data is present', () => {
    const summary: ProjectionSummary = {
      openingCents: 100_000,
      closingCents: 100_000,
      lowest: { cents: 100_000, date: '2026-01-01' },
      firstNegativeDate: null,
      lastDate: '2026-01-31',
      events: [],
    };
    render(
      <AccountHero
        accountName="Chequing"
        currency="CAD"
        summary={summary}
        sinkingFund={null}
        accuracy={{ runsHigh: true, driftPerMonthCents: 1500, totalDriftCents: 4500, measuredCount: 3 }}
      />,
    );
    expect(screen.getByText(/running .* high over 3 corrections/)).toBeInTheDocument();
  });
});
