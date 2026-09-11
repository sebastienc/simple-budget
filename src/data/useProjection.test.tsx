import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProjection } from './useProjection';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('useProjection', () => {
  it('fetches and returns the projected days on the happy path', async () => {
    const days = [{ date: '2026-01-01', items: [], dailyTotalCents: 0, balanceCents: 1000, correctionApplied: false }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(days)));

    const { result } = renderHook(() => useProjection(1, '2026-01-01', '2026-01-31'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.days).toEqual(days);
    expect(result.current.error).toBeNull();

    vi.unstubAllGlobals();
  });

  it('reports starting_balance_not_set on a 422 with that error body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'starting_balance_not_set' }, 422)));

    const { result } = renderHook(() => useProjection(1, '2026-01-01', '2026-01-31'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('starting_balance_not_set');
    expect(result.current.days).toEqual([]);

    vi.unstubAllGlobals();
  });

  it('falls back to unknown for a 422 with a different error, or any other failed status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'something_else' }, 422)));
    const { result: a } = renderHook(() => useProjection(1, '2026-01-01', '2026-01-31'));
    await waitFor(() => expect(a.current.isLoading).toBe(false));
    expect(a.current.error).toBe('unknown');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    const { result: b } = renderHook(() => useProjection(1, '2026-01-01', '2026-01-31'));
    await waitFor(() => expect(b.current.isLoading).toBe(false));
    expect(b.current.error).toBe('unknown');

    vi.unstubAllGlobals();
  });

  it('does not apply a stale response once a newer request has started', async () => {
    let resolveStale: (value: Response) => void;
    const stale = new Promise<Response>((resolvePromise) => {
      resolveStale = resolvePromise;
    });
    const fresh = jsonResponse([{ date: '2026-02-01', items: [], dailyTotalCents: 0, balanceCents: 2000, correctionApplied: false }]);

    const fetchMock = vi.fn().mockReturnValueOnce(stale).mockResolvedValueOnce(fresh);
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(({ to }: { to: string }) => useProjection(1, '2026-01-01', to), {
      initialProps: { to: '2026-01-31' },
    });

    // A newer request (different `to`, so a new effect run) starts before the
    // first one resolves — its cleanup must mark the first as cancelled.
    rerender({ to: '2026-02-28' });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Now let the stale request resolve — it must be discarded, not clobber
    // the fresh result that already landed.
    resolveStale!(jsonResponse([{ date: '1999-01-01', items: [], dailyTotalCents: 0, balanceCents: -1, correctionApplied: false }]));
    await Promise.resolve();

    expect(result.current.days[0]?.date).toBe('2026-02-01');

    vi.unstubAllGlobals();
  });

  it('returns immediately with no fetch when accountId is null', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useProjection(null, '2026-01-01', '2026-01-31'));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.days).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
