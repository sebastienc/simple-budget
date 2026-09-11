import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProjectionPreview } from './useProjectionPreview';
import type { ScratchItem } from './useProjectionPreview';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function scratchItem(overrides: Partial<ScratchItem> = {}): ScratchItem {
  return {
    id: -1,
    name: 'Scratch',
    amountCents: -1000,
    frequency: 'monthly',
    interval: 1,
    startDate: '2026-01-01',
    endDate: null,
    semiMonthlyDay1: null,
    semiMonthlyDay2: null,
    ...overrides,
  };
}

describe('useProjectionPreview', () => {
  it('short-circuits to empty with no fetch when there are no scratch items', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // A stable empty-array reference — see the note below on why a fresh
    // literal per render would loop forever.
    const items: ScratchItem[] = [];
    const { result } = renderHook(() => useProjectionPreview(1, '2026-01-01', '2026-01-31', items));

    expect(result.current.days).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('posts the scratch items and returns the resulting projection', async () => {
    const days = [{ date: '2026-01-01', items: [], dailyTotalCents: -1000, balanceCents: 4000, correctionApplied: false }];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(days));
    vi.stubGlobal('fetch', fetchMock);

    // A stable array reference, matching how Home.tsx holds scratchItems in
    // useState — a fresh literal on every render would re-trigger the effect
    // forever, since the hook deliberately depends on the array itself.
    const items = [scratchItem()];
    const { result } = renderHook(() => useProjectionPreview(1, '2026-01-01', '2026-01-31', items));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.days).toEqual(days);

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body).scratchItems).toHaveLength(1);

    vi.unstubAllGlobals();
  });

  it('clears the days on a failed response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'bad' }, 400)));

    const items = [scratchItem()];
    const { result } = renderHook(() => useProjectionPreview(1, '2026-01-01', '2026-01-31', items));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.days).toEqual([]);

    vi.unstubAllGlobals();
  });
});
