import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBackup } from './useBackup';

describe('useBackup', () => {
  it('exportBackup navigates the window to the export endpoint', () => {
    const { result } = renderHook(() => useBackup());
    const location = { href: '' };
    vi.stubGlobal('location', location);

    result.current.exportBackup();

    expect(location.href).toBe('/api/backup/export');

    vi.unstubAllGlobals();
  });

  it('importBackup posts the file as octet-stream and reports ok on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useBackup());
    const file = new File(['SQLite format 3'], 'backup.db');
    const outcome = await result.current.importBackup(file);

    expect(outcome).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/backup/import');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/octet-stream');
    expect(init.body).toBe(file);

    vi.unstubAllGlobals();
  });

  it('importBackup surfaces the server error on a failed response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'invalid_backup_file' }) } as Response),
    );

    const { result } = renderHook(() => useBackup());
    const outcome = await result.current.importBackup(new File([], 'bad.db'));

    expect(outcome).toEqual({ ok: false, error: 'invalid_backup_file' });

    vi.unstubAllGlobals();
  });

  it('importBackup falls back to "unknown" when the error body cannot be parsed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('not json');
        },
      } as unknown as Response),
    );

    const { result } = renderHook(() => useBackup());
    const outcome = await result.current.importBackup(new File([], 'bad.db'));

    expect(outcome).toEqual({ ok: false, error: 'unknown' });

    vi.unstubAllGlobals();
  });

  it('wipeAllData posts to /api/wipe and returns the parsed body on success', async () => {
    const body = { ok: true, backupPath: '/tmp/backup.db' };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useBackup());
    const outcome = await result.current.wipeAllData();

    expect(outcome).toEqual(body);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/wipe');
    expect(init.method).toBe('POST');

    vi.unstubAllGlobals();
  });

  it('wipeAllData reports not-ok without reading the body on a failed response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response));

    const { result } = renderHook(() => useBackup());
    const outcome = await result.current.wipeAllData();

    expect(outcome).toEqual({ ok: false });

    vi.unstubAllGlobals();
  });
});
