import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useNetWorth } from './useNetWorth';

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('useNetWorth', () => {
  it('fetches groups and excludedAccountIds for the given range', async () => {
    const body = {
      groups: [{ currency: 'CAD', includedAccountIds: [1], days: [{ date: '2026-01-01', totalCents: 1000 }] }],
      excludedAccountIds: [2],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(body)));

    const { result } = renderHook(() => useNetWorth('2026-01-01', '2026-01-31'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.groups).toEqual(body.groups);
    expect(result.current.excludedAccountIds).toEqual([2]);

    vi.unstubAllGlobals();
  });

  it('returns empty with no fetch when from or to is blank', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useNetWorth('', '2026-01-31'));

    expect(result.current.groups).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('discards a stale response once a newer request has started', async () => {
    let resolveStale: (value: Response) => void;
    const stale = new Promise<Response>((resolvePromise) => {
      resolveStale = resolvePromise;
    });
    const fresh = jsonResponse({ groups: [{ currency: 'CAD', includedAccountIds: [1], days: [] }], excludedAccountIds: [] });

    const fetchMock = vi.fn().mockReturnValueOnce(stale).mockResolvedValueOnce(fresh);
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(({ to }: { to: string }) => useNetWorth('2026-01-01', to), {
      initialProps: { to: '2026-01-31' },
    });

    rerender({ to: '2026-02-28' });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    resolveStale!(jsonResponse({ groups: [{ currency: 'USD', includedAccountIds: [9], days: [] }], excludedAccountIds: [] }));
    await Promise.resolve();

    expect(result.current.groups[0]?.currency).toBe('CAD');

    vi.unstubAllGlobals();
  });
});
