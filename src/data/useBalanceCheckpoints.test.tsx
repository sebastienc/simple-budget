import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useBalanceCheckpoints } from './useBalanceCheckpoints';
import type { BalanceCheckpoint } from './useBalanceCheckpoints';

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function checkpoint(overrides: Partial<BalanceCheckpoint> = {}): BalanceCheckpoint {
  return {
    id: 1,
    accountId: 1,
    date: '2026-01-01',
    balanceCents: 1000,
    projectedCents: null,
    driftCents: null,
    daysSincePrevious: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('useBalanceCheckpoints', () => {
  it('returns empty with no fetch when accountId is null', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useBalanceCheckpoints(null));

    expect(result.current.checkpoints).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('fetches checkpoints for the given account on mount', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([checkpoint()])));

    const { result } = renderHook(() => useBalanceCheckpoints(1));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.checkpoints).toEqual([checkpoint()]);

    vi.unstubAllGlobals();
  });

  it('createOrUpdateCheckpoint posts date/balanceCents, then refetches', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(checkpoint()))
      .mockResolvedValueOnce(jsonResponse([checkpoint()]));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useBalanceCheckpoints(1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.createOrUpdateCheckpoint('2026-01-01', 1000);
    });

    const [postUrl, postInit] = fetchMock.mock.calls[1];
    expect(postUrl).toBe('/api/accounts/1/checkpoints');
    expect(JSON.parse(postInit.body)).toEqual({ date: '2026-01-01', balanceCents: 1000 });
    expect(result.current.checkpoints).toEqual([checkpoint()]);

    vi.unstubAllGlobals();
  });

  it('deleteCheckpoint sends a DELETE for the checkpoint id, then refetches', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([checkpoint()]))
      .mockResolvedValueOnce({ ok: true, status: 204 } as Response)
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useBalanceCheckpoints(1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.deleteCheckpoint(1);
    });

    const [deleteUrl] = fetchMock.mock.calls[1];
    expect(deleteUrl).toBe('/api/checkpoints/1');
    expect(result.current.checkpoints).toEqual([]);

    vi.unstubAllGlobals();
  });
});
