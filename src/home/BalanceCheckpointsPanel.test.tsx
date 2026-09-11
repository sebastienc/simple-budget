import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithToaster } from '../../test/providers';
import BalanceCheckpointsPanel from './BalanceCheckpointsPanel';

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('BalanceCheckpointsPanel', () => {
  it('shows the empty state when there are no checkpoints', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([])));

    renderWithToaster(<BalanceCheckpointsPanel accountId={1} currency="CAD" />);

    expect(await screen.findByText('No corrections recorded yet')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('lists checkpoints newest first, with a drift label per row', async () => {
    const checkpoints = [
      { id: 1, accountId: 1, date: '2026-01-01', balanceCents: 1000, projectedCents: null, driftCents: null, daysSincePrevious: null, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 2, accountId: 1, date: '2026-02-01', balanceCents: 900, projectedCents: 1000, driftCents: 100, daysSincePrevious: 31, createdAt: '2026-02-01T00:00:00.000Z' },
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(checkpoints)));

    renderWithToaster(<BalanceCheckpointsPanel accountId={1} currency="CAD" />);

    await waitFor(() => expect(screen.queryByText('No corrections recorded yet')).not.toBeInTheDocument());
    const dates = screen.getAllByText(/2026/).map((el) => el.textContent);
    expect(dates[0]).toContain('February');
    expect(dates[1]).toContain('January');

    vi.unstubAllGlobals();
  });

  it('posts a new correction and closes the form on submit', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([])) // initial fetch
      .mockResolvedValueOnce(jsonResponse({})) // POST
      .mockResolvedValueOnce(jsonResponse([])); // refetch
    vi.stubGlobal('fetch', fetchMock);

    renderWithToaster(<BalanceCheckpointsPanel accountId={1} currency="CAD" />);
    await screen.findByText('No corrections recorded yet');

    await user.click(screen.getByRole('button', { name: 'Add correction' }));
    await user.type(screen.getByLabelText('Balance'), '10');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument());
    const [postUrl, postInit] = fetchMock.mock.calls[1];
    expect(postUrl).toBe('/api/accounts/1/checkpoints');
    expect(JSON.parse(postInit.body).balanceCents).toBe(1000);

    vi.unstubAllGlobals();
  });

  it('deletes a checkpoint only after confirming the native dialog', async () => {
    const user = userEvent.setup();
    const checkpoints = [
      { id: 1, accountId: 1, date: '2026-01-01', balanceCents: 1000, projectedCents: null, driftCents: null, daysSincePrevious: null, createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    // Every call after the initial GET (the DELETE itself, then its refetch)
    // gets an empty array — realistic for a refetch after the only checkpoint
    // was removed, and keeps the DELETE response body's shape irrelevant.
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(checkpoints)).mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderWithToaster(<BalanceCheckpointsPanel accountId={1} currency="CAD" />);
    await screen.findByRole('button', { name: 'Delete' });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(fetchMock).toHaveBeenCalledTimes(1); // still just the initial fetch

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url === '/api/checkpoints/1')).toBe(true));

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
