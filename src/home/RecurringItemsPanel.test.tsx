import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithToaster } from '../../test/providers';
import RecurringItemsPanel, { capitalize, sortItems } from './RecurringItemsPanel';
import type { RecurringItem } from '@/data/useRecurringItems';

function item(overrides: Partial<RecurringItem> = {}): RecurringItem {
  return {
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
    nextOccurrenceDate: null,
    suggestedMonthlySetAsideCents: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('sortItems', () => {
  const items = [item({ id: 1, name: 'Rent', amountCents: -150_000, frequency: 'monthly' }), item({ id: 2, name: 'Internet', amountCents: -8_000, frequency: 'weekly' })];

  it('sorts by name', () => {
    expect(sortItems(items, 'name').map((i) => i.name)).toEqual(['Internet', 'Rent']);
  });

  it('sorts by amount (ascending — most negative first)', () => {
    expect(sortItems(items, 'amount').map((i) => i.name)).toEqual(['Rent', 'Internet']);
  });

  it('sorts by frequency alphabetically', () => {
    expect(sortItems(items, 'frequency').map((i) => i.frequency)).toEqual(['monthly', 'weekly']);
  });

  it('does not mutate the input array', () => {
    const original = [...items];
    sortItems(items, 'name');
    expect(items).toEqual(original);
  });
});

describe('capitalize', () => {
  it('uppercases the first letter and leaves the rest untouched', () => {
    expect(capitalize('amount')).toBe('Amount');
    expect(capitalize('frequency')).toBe('Frequency');
  });
});

describe('RecurringItemsPanel', () => {
  it('shows the empty state when there are no items', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([])));

    renderWithToaster(<RecurringItemsPanel accountId={1} currency="CAD" />);

    expect(await screen.findByText('No recurring items yet')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('filters the visible list as the user types in the search field', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([item({ id: 1, name: 'Rent' }), item({ id: 2, name: 'Internet' })])));

    renderWithToaster(<RecurringItemsPanel accountId={1} currency="CAD" />);
    await screen.findByText('Rent');
    expect(screen.getByText('Internet')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search recurring items…'), 'Rent');

    expect(screen.getByText('Rent')).toBeInTheDocument();
    expect(screen.queryByText('Internet')).not.toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('shows the no-match state when a search filters everything out', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([item({ name: 'Rent' })])));

    renderWithToaster(<RecurringItemsPanel accountId={1} currency="CAD" />);
    await screen.findByText('Rent');

    await user.type(screen.getByPlaceholderText('Search recurring items…'), 'zzz');

    expect(await screen.findByText('No recurring items match your search')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('sums the suggested monthly set-aside across sinking-fund items', async () => {
    const items = [
      item({ id: 1, name: 'Vacation', sinkingFund: true, suggestedMonthlySetAsideCents: -5_000 }),
      item({ id: 2, name: 'Car repair', sinkingFund: true, suggestedMonthlySetAsideCents: -2_500 }),
      item({ id: 3, name: 'Rent', sinkingFund: false }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(items)));

    renderWithToaster(<RecurringItemsPanel accountId={1} currency="CAD" />);

    // $50.00 + $25.00, summed as magnitudes — a set-aside isn't a signed flow.
    await waitFor(() => expect(screen.getByText(/\$75\.00/)).toBeInTheDocument());

    vi.unstubAllGlobals();
  });

  it('deletes an item only after confirming the native dialog', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse([item({ name: 'Rent' })])).mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderWithToaster(<RecurringItemsPanel accountId={1} currency="CAD" />);
    await screen.findByText('Rent');

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/recurring-items/1' && init?.method === 'DELETE')).toBe(true));

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
