import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../test/providers';
import AccountMenu from './AccountMenu';

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Settings' }));
}

describe('AccountMenu', () => {
  it('does not wipe data when the confirmation dialog is dismissed', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderWithProviders(<AccountMenu />);
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Erase all data' }));

    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('wipes data, alerts the backup path, and reloads on success', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: true, backupPath: '/tmp/backup.db' })));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const reloadSpy = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload: reloadSpy });

    renderWithProviders(<AccountMenu />);
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Erase all data' }));

    await vi.waitFor(() => expect(reloadSpy).toHaveBeenCalled());
    // i18next escapes interpolated values (escapeValue: true), so "/" becomes "&#x2F;".
    expect(alertSpy.mock.calls[0][0]).toContain('tmp&#x2F;backup.db');

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not reload when the wipe request fails', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const reloadSpy = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload: reloadSpy });

    renderWithProviders(<AccountMenu />);
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Erase all data' }));

    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/wipe', expect.objectContaining({ method: 'POST' })));
    expect(reloadSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('navigates the window to the export endpoint', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn());
    const location = { ...window.location, href: '' };
    vi.stubGlobal('location', location);

    renderWithProviders(<AccountMenu />);
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Export backup' }));

    expect(location.href).toBe('/api/backup/export');

    vi.unstubAllGlobals();
  });

  it('imports the selected file after confirming, then reloads', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 200)));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const reloadSpy = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload: reloadSpy });

    const { container } = renderWithProviders(<AccountMenu />);
    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Import backup' }));

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['SQLite format 3'], 'backup.db');
    await user.upload(fileInput, file);

    await vi.waitFor(() => expect(reloadSpy).toHaveBeenCalled());
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/backup/import');
    expect(init?.body).toBe(file);

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
