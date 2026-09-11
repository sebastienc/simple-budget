import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useRecurringItems } from './useRecurringItems';
import type { RecurringItem, RecurringItemInput } from './useRecurringItems';

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function recurringItem(overrides: Partial<RecurringItem> = {}): RecurringItem {
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

describe('useRecurringItems', () => {
  it('returns empty with no fetch when accountId is null', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useRecurringItems(null));

    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('fetches the account\'s recurring items on mount', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([recurringItem()])));

    const { result } = renderHook(() => useRecurringItems(1));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual([recurringItem()]);

    vi.unstubAllGlobals();
  });

  it('createItem posts to the account\'s collection, then refetches', async () => {
    const input: RecurringItemInput = {
      name: 'Internet',
      amountCents: -8000,
      frequency: 'monthly',
      interval: 1,
      startDate: '2026-01-01',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(recurringItem({ name: 'Internet' })))
      .mockResolvedValueOnce(jsonResponse([recurringItem({ name: 'Internet' })]));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useRecurringItems(1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.createItem(input);
    });

    expect(result.current.items).toEqual([recurringItem({ name: 'Internet' })]);
    const [postUrl, postInit] = fetchMock.mock.calls[1];
    expect(postUrl).toBe('/api/accounts/1/recurring-items');
    expect(JSON.parse(postInit.body)).toEqual(input);

    vi.unstubAllGlobals();
  });

  it('updateItem patches /api/recurring-items/:id, then refetches', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([recurringItem()]))
      .mockResolvedValueOnce(jsonResponse(recurringItem({ amountCents: -1000 })))
      .mockResolvedValueOnce(jsonResponse([recurringItem({ amountCents: -1000 })]));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useRecurringItems(1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateItem(1, { amountCents: -1000 });
    });

    const [patchUrl] = fetchMock.mock.calls[1];
    expect(patchUrl).toBe('/api/recurring-items/1');
    expect(result.current.items[0].amountCents).toBe(-1000);

    vi.unstubAllGlobals();
  });

  it('re-fetches when refreshToken changes, even though accountId did not', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse([])).mockResolvedValueOnce(jsonResponse([recurringItem()]));
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(({ token }: { token: number }) => useRecurringItems(1, token), {
      initialProps: { token: 0 },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rerender({ token: 1 });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.items).toEqual([recurringItem()]));

    vi.unstubAllGlobals();
  });
});
