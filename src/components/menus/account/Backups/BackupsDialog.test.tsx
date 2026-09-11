import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithToaster } from '../../../../../test/providers';
import BackupsDialog from './BackupsDialog';

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const EMPTY_FOLDER = { folder: null, keep: 10, folderAvailable: true, detected: [], snapshots: [] };

describe('BackupsDialog', () => {
  it('fetches nothing while closed', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderWithToaster(<BackupsDialog isOpen={false} onOpenChange={vi.fn()} />);

    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('fetches folder settings once opened, and seeds the form from the response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ...EMPTY_FOLDER, folder: '/Users/me/Dropbox/budget', keep: 5 })));

    renderWithToaster(<BackupsDialog isOpen onOpenChange={vi.fn()} />);

    await waitFor(() => expect(screen.getByLabelText('Backup folder')).toHaveValue('/Users/me/Dropbox/budget'));
    expect(screen.getByLabelText('Keep')).toHaveValue(5);

    vi.unstubAllGlobals();
  });

  it('offers each detected folder as a quick-fill button', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ ...EMPTY_FOLDER, detected: [{ path: '/Users/me/Dropbox', label: 'Dropbox', provider: 'dropbox' }] })),
    );

    renderWithToaster(<BackupsDialog isOpen onOpenChange={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Dropbox' }));

    expect(screen.getByLabelText('Backup folder')).toHaveValue('/Users/me/Dropbox');

    vi.unstubAllGlobals();
  });

  it('saves the typed folder path via PUT', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(EMPTY_FOLDER)) // initial GET
      .mockResolvedValueOnce(jsonResponse({ folder: '/backups', keep: 10, snapshotFailed: false })); // PUT
    vi.stubGlobal('fetch', fetchMock);

    renderWithToaster(<BackupsDialog isOpen onOpenChange={vi.fn()} />);
    await screen.findByLabelText('Backup folder');

    await user.type(screen.getByLabelText('Backup folder'), '/backups');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Just GET then PUT — the PUT response body already carries the updated
    // settings/snapshots, so the hook merges it in rather than refetching.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [putUrl, putInit] = fetchMock.mock.calls[1];
    expect(putUrl).toBe('/api/backup/folder');
    expect(JSON.parse(putInit.body)).toEqual({ folder: '/backups', keep: 10 });

    vi.unstubAllGlobals();
  });

  it('restores a snapshot only after confirming the native dialog', async () => {
    const user = userEvent.setup();
    const snapshot = { name: 'a.db', path: '/backups/a.db', host: 'laptop', takenAt: '2026-01-01T00:00:00.000Z', sizeBytes: 2048, isThisMachine: true };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ...EMPTY_FOLDER, folder: '/backups', snapshots: [snapshot] }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderWithToaster(<BackupsDialog isOpen onOpenChange={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Restore' }));

    // Only the initial GET happened — no POST to /api/backup/restore.
    expect(fetchMock.mock.calls.every(([url]) => url !== '/api/backup/restore')).toBe(true);

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
