import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import NetWorthTable from './NetWorthTable';

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function stubFetch(routes: { accounts?: unknown; netWorth?: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.startsWith('/api/accounts')) {
        return Promise.resolve(jsonResponse(routes.accounts ?? []));
      }
      if (url.startsWith('/api/net-worth')) {
        return Promise.resolve(jsonResponse(routes.netWorth ?? { groups: [], excludedAccountIds: [] }));
      }
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );
}

describe('NetWorthTable', () => {
  it('shows the net-worth placeholder hero when there are no groups', async () => {
    stubFetch({});

    render(<NetWorthTable />);

    expect(await screen.findByText('Nothing scheduled yet.')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('lists names of accounts excluded for missing a starting balance', async () => {
    const accounts = [
      { id: 1, name: 'Chequing', currency: 'CAD', startingBalanceCents: 0, startingBalanceDate: '2026-01-01', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 2, name: 'New account', currency: 'CAD', startingBalanceCents: 0, startingBalanceDate: null, createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    stubFetch({ accounts, netWorth: { groups: [], excludedAccountIds: [2] } });

    render(<NetWorthTable />);

    expect(await screen.findByText('Excludes: New account')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('titles a single currency group plainly, without a currency suffix', async () => {
    const accounts = [{ id: 1, name: 'Chequing', currency: 'CAD', startingBalanceCents: 100_000, startingBalanceDate: '2026-01-01', createdAt: '2026-01-01T00:00:00.000Z' }];
    const netWorth = {
      groups: [{ currency: 'CAD', includedAccountIds: [1], days: [{ date: '2026-01-01', totalCents: 100_000 }] }],
      excludedAccountIds: [],
    };
    stubFetch({ accounts, netWorth });

    render(<NetWorthTable />);

    await waitFor(() => expect(screen.getAllByText(/^Net worth ·/).length).toBeGreaterThan(0));
    expect(screen.queryByText(/Net worth \(/)).not.toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('qualifies each heading with its currency when there is more than one group', async () => {
    const accounts = [
      { id: 1, name: 'CAD account', currency: 'CAD', startingBalanceCents: 100_000, startingBalanceDate: '2026-01-01', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 2, name: 'USD account', currency: 'USD', startingBalanceCents: 50_000, startingBalanceDate: '2026-01-01', createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    const netWorth = {
      groups: [
        { currency: 'CAD', includedAccountIds: [1], days: [{ date: '2026-01-01', totalCents: 100_000 }] },
        { currency: 'USD', includedAccountIds: [2], days: [{ date: '2026-01-01', totalCents: 50_000 }] },
      ],
      excludedAccountIds: [],
    };
    stubFetch({ accounts, netWorth });

    render(<NetWorthTable />);

    expect(await screen.findByText(/Net worth \(CAD\)/)).toBeInTheDocument();
    expect(screen.getByText(/Net worth \(USD\)/)).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
