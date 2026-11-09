import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithToaster } from '../../../../../test/providers';
import type { FirstLinkOffer, SyncDevice, SyncStatus } from '@/data/useSync';
import { SYNC_POLL_MS } from '@/data/useSync';
import SyncSection from './SyncSection';

// The toast region is only mounted in the real app, so what would be toasted is what the test looks at.
const addToast = vi.hoisted(() => vi.fn());
vi.mock('@/toast/useToaster', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/toast/useToaster')>()), useToaster: () => ({ addToast }) }));

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const status = (overrides: Partial<SyncStatus> = {}): SyncStatus => ({
  enabled: true,
  folder: '/Drive/Budget',
  running: false,
  devices: [],
  problem: null,
  changesBroughtIn: null,
  lastRead: null,
  lastWrite: null,
  ...overrides,
});

const offer = (overrides: Partial<FirstLinkOffer> = {}): FirstLinkOffer => ({
  deviceId: 'phone-1234',
  deviceName: "Sebastien's Pixel & co",
  writtenAt: '2026-11-09T11:00:00Z',
  remote: { accounts: 2, items: 5, corrections: 1, lastChange: '2026-11-08T10:00:00Z' },
  local: { accounts: 1, items: 0, corrections: 0, lastChange: '2026-11-01T10:00:00Z' },
  suggested: 'REMOTE',
  ...overrides,
});

interface Call {
  method: string;
  url: string;
  body: unknown;
}

/** A server that answers GET /api/sync with the current status and POSTs with the given responses. */
function server(initial: SyncStatus | unknown, posts: Record<string, () => Response> = {}) {
  const calls: Call[] = [];
  let current = initial;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ method: init?.method ?? 'GET', url, body: init?.body ? JSON.parse(init.body as string) : undefined });
    if ((init?.method ?? 'GET') === 'GET') return jsonResponse(current);
    const answer = posts[url]?.();
    if (!answer) throw new Error(`unexpected POST ${url}`);
    return answer;
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, setStatus: (next: SyncStatus) => (current = next), posts: () => calls.filter((call) => call.method === 'POST') };
}

const reload = vi.fn();

beforeEach(() => {
  vi.stubGlobal('location', { ...window.location, reload });
});

afterEach(() => {
  addToast.mockClear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  reload.mockClear();
});

describe('SyncSection without a folder', () => {
  it('asks for a backup folder first, and asks the server nothing', () => {
    const { calls } = server(status());
    renderWithToaster(<SyncSection isOpen folder={null} />);
    expect(screen.getByText(/Choose and save a backup folder above first/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Turn on sync' })).not.toBeInTheDocument();
    expect(calls).toEqual([]);
  });

  it('asks nothing while the dialog is closed', () => {
    const { calls } = server(status());
    renderWithToaster(<SyncSection isOpen={false} folder="/Drive/Budget" />);
    expect(calls).toEqual([]);
  });
});

describe('SyncSection when sync is off', () => {
  it('explains, and turns sync on', async () => {
    const user = userEvent.setup();
    const { posts } = server(status({ enabled: false }), { '/api/sync/enable': () => jsonResponse(status({ lastRead: '2026-11-09T12:00:00Z' })) });
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);

    expect(await screen.findByText(/Keep this computer and your phone in step/)).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Turn on sync' }));

    expect(await screen.findByRole('button', { name: 'Sync now' })).toBeInTheDocument();
    expect(posts()).toHaveLength(1);
    await waitFor(() => expect(addToast).toHaveBeenCalledWith('Sync is on'));
  });

  it('says so when sync could not be turned on', async () => {
    const user = userEvent.setup();
    server(status({ enabled: false }), { '/api/sync/enable': () => jsonResponse({ error: 'no_backup_folder' }, 400) });
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);

    await user.click(await screen.findByRole('button', { name: 'Turn on sync' }));

    await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.stringMatching(/Sync could not be changed/)));
    expect(screen.getByRole('button', { name: 'Turn on sync' })).toBeInTheDocument();
  });

  it('does not offer to turn on until it knows how things stand', async () => {
    // an answer that is not a sync status (a different resource, an error body) is "not available", never a crash
    server({ folder: '/Drive/Budget', keep: 10, snapshots: [] });
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);
    expect(await screen.findByRole('button', { name: 'Turn on sync' })).toBeDisabled();
  });
});

describe('SyncSection when sync is on', () => {
  it('shows when the folder was last read and the file last written, and what was brought in', async () => {
    server(status({ lastRead: '2026-11-09T12:00:00Z', lastWrite: '2026-11-09T11:00:00Z', changesBroughtIn: 3 }));
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);

    expect(await screen.findByText(/Folder last read: 9 Nov 2026/)).toBeInTheDocument();
    expect(screen.getByText(/This computer's file last written: 9 Nov 2026/)).toBeInTheDocument();
    expect(screen.getByText('Brought in 3 changes from the other devices')).toBeInTheDocument();
    expect(screen.getByText(/This only says what this computer did/)).toBeInTheDocument();
    expect(screen.getByText('No other device has used this folder yet.')).toBeInTheDocument();
  });

  it.each([
    [0, 'Nothing new from the other devices'],
    [1, 'Brought in 1 change from the other devices'],
  ])('says it plainly when %i changes were brought in', async (count, text) => {
    server(status({ changesBroughtIn: count }));
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('says what has not happened yet', async () => {
    server(status());
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);
    expect(await screen.findByText('Folder not read yet')).toBeInTheDocument();
    expect(screen.getByText("This computer's file not written yet")).toBeInTheDocument();
  });

  it.each([
    ['folder-unreachable', /The folder could not be reached/],
    ['failed', /The changes could not be applied, so nothing was changed/],
    ['publish-failed', /this computer's file could not be written/],
  ] as const)('shows the problem %s', async (problem, text) => {
    server(status({ problem }));
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
  });

  it('shows each kind of other device, with the name exactly as its owner wrote it', async () => {
    const devices: SyncDevice[] = [
      { kind: 'merged', deviceId: 'a', deviceName: "Sebastien's Pixel & co", writtenAt: '2026-11-09T11:00:00Z' },
      { kind: 'waiting', deviceId: 'b', deviceName: 'Tablet', writtenAt: '2026-11-09T11:00:00Z' },
      { kind: 'offer', deviceId: 'c', offer: offer({ deviceId: 'c', deviceName: 'Old laptop' }) },
      { kind: 'skipped', deviceId: '0123456789abcdef', reason: 'CHECKSUM' },
    ];
    server(status({ devices }));
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);

    expect(await screen.findByText(/^Sebastien's Pixel & co · file written 9 Nov 2026/)).toBeInTheDocument();
    expect(screen.getByText(/^Tablet · holds a different budget\. This computer keeps its data/)).toBeInTheDocument();
    expect(within(screen.getByTestId('sync-device-c')).getByText('Old laptop · holds a different budget')).toBeInTheDocument();
    expect(within(screen.getByTestId('sync-device-c')).getByRole('button', { name: 'Review' })).toBeInTheDocument();
    expect(screen.getByText('Device 01234567 · its file looks damaged or only half written; this computer will try again')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Review' })).toHaveLength(1);
  });

  it.each([
    ['UNREADABLE', /could not be read just now/],
    ['CHECKSUM', /damaged or only half written/],
    ['NEWER_FORMAT', /newer version of the app/],
    ['NEWER_SCHEMA', /newer version of the app/],
    ['TOO_LARGE', /too large to read/],
    ['INVALID', /something this version cannot read/],
    ['FUTURE_STAMP', /far in the future/],
  ] as const)('says why a file was skipped: %s', async (reason, text) => {
    server(status({ devices: [{ kind: 'skipped', deviceId: 'abcdefgh1', reason }] }));
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('syncs now, and shows what that found', async () => {
    const user = userEvent.setup();
    const { posts } = server(status(), {
      '/api/sync/now': () => jsonResponse(status({ changesBroughtIn: 2, lastRead: '2026-11-09T12:30:00Z' })),
    });
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);

    await user.click(await screen.findByRole('button', { name: 'Sync now' }));

    expect(await screen.findByText('Brought in 2 changes from the other devices')).toBeInTheDocument();
    expect(posts().map((call) => call.url)).toEqual(['/api/sync/now']);
  });

  it('shows that it is syncing, and cannot be asked twice', async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    server(status(), {});
    const fetchMock = vi.mocked(fetch);
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url, init) => {
      if (url === '/api/sync/now') {
        await new Promise<void>((resolve) => (finish = resolve));
        return jsonResponse(status());
      }
      return original(url, init);
    });
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);

    await user.click(await screen.findByRole('button', { name: 'Sync now' }));
    const busy = await screen.findByRole('button', { name: 'Syncing…' });
    expect(busy).toBeDisabled();

    finish();
    expect(await screen.findByRole('button', { name: 'Sync now' })).toBeEnabled();
  });

  it('shows a sync that is running in the background', async () => {
    server(status({ running: true }));
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);
    expect(await screen.findByRole('button', { name: 'Syncing…' })).toBeDisabled();
  });

  it('turns sync off, saying that nothing in the folder is deleted', async () => {
    const user = userEvent.setup();
    const { posts } = server(status(), { '/api/sync/disable': () => jsonResponse(status({ enabled: false })) });
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);

    expect(await screen.findByText(/Nothing in the folder is deleted/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Turn off sync' }));

    expect(await screen.findByRole('button', { name: 'Turn on sync' })).toBeInTheDocument();
    expect(posts().map((call) => call.url)).toEqual(['/api/sync/disable']);
    await waitFor(() => expect(addToast).toHaveBeenCalledWith('Sync is off'));
  });

  it('looks again every few seconds so that a sync in the background shows, and stops when closed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { calls, setStatus } = server(status());
    const { rerender } = renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);
    await screen.findByText('Folder not read yet');
    const gets = () => calls.filter((call) => call.method === 'GET').length;
    expect(gets()).toBe(1);

    setStatus(status({ lastRead: '2026-11-09T12:00:00Z' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SYNC_POLL_MS);
    });
    expect(await screen.findByText(/Folder last read: 9 Nov 2026/)).toBeInTheDocument();
    expect(gets()).toBe(2);

    rerender(<SyncSection isOpen={false} folder="/Drive/Budget" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SYNC_POLL_MS * 3);
    });
    expect(gets()).toBe(2);
  });

  it('does not look again while sync is off', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { calls } = server(status({ enabled: false }));
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);
    await screen.findByRole('button', { name: 'Turn on sync' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SYNC_POLL_MS * 3);
    });
    expect(calls).toHaveLength(1);
  });

  it('keeps showing what it had when a look fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server(status({ lastRead: '2026-11-09T12:00:00Z' }));
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);
    await screen.findByText(/Folder last read/);
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SYNC_POLL_MS * 2);
    });
    expect(screen.getByText(/Folder last read: 9 Nov 2026/)).toBeInTheDocument();
  });
});

describe('SyncSection, a first link', () => {
  const offered = (suggested: 'LOCAL' | 'REMOTE' = 'REMOTE') => status({ devices: [{ kind: 'offer', deviceId: 'phone-1234', offer: offer({ suggested }) }] });

  async function review(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Review' }));
    return screen.findByRole('dialog', { name: /holds a different budget/ });
  }

  it("shows both sides, the suggested one marked, and the device's name as written", async () => {
    const user = userEvent.setup();
    server(offered());
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);

    const dialog = await review(user);

    expect(within(dialog).getByRole('heading', { name: "Sebastien's Pixel & co holds a different budget" })).toBeInTheDocument();
    const [mine, theirs] = within(dialog).getAllByTestId('first-link-side');
    expect(within(mine).getByText('This computer')).toBeInTheDocument();
    expect(within(mine).getByText('Accounts 1 · items 0 · corrections 0')).toBeInTheDocument();
    expect(within(mine).getByText(/Last change: 1 Nov 2026/)).toBeInTheDocument();
    expect(within(mine).queryByText('Suggested')).not.toBeInTheDocument();
    expect(within(theirs).getByText("Sebastien's Pixel & co")).toBeInTheDocument();
    expect(within(theirs).getByText('Accounts 2 · items 5 · corrections 1')).toBeInTheDocument();
    expect(within(theirs).getByText('Suggested')).toBeInTheDocument();
    expect(within(dialog).getByText(/A copy of this computer's data is saved first/)).toBeInTheDocument();
  });

  it('suggests this computer when it changed more recently', async () => {
    const user = userEvent.setup();
    server(offered('LOCAL'));
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);
    const dialog = await review(user);
    const [mine, theirs] = within(dialog).getAllByTestId('first-link-side');
    expect(within(mine).getByText('Suggested')).toBeInTheDocument();
    expect(within(theirs).queryByText('Suggested')).not.toBeInTheDocument();
  });

  it('says "nothing in it" for a side that holds nothing', async () => {
    const user = userEvent.setup();
    server(status({ devices: [{ kind: 'offer', deviceId: 'phone-1234', offer: offer({ local: { accounts: 0, items: 0, corrections: 0, lastChange: null } }) }] }));
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);
    const dialog = await review(user);
    expect(within(within(dialog).getAllByTestId('first-link-side')[0]).getByText('Nothing in it')).toBeInTheDocument();
  });

  it('changes nothing when the person decides later, by the button or by closing', async () => {
    const user = userEvent.setup();
    const { posts } = server(offered());
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);

    const dialog = await review(user);
    await user.click(within(dialog).getByRole('button', { name: 'Decide later' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const again = await review(user);
    await user.click(within(again).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(posts()).toEqual([]);
    expect(screen.getByRole('button', { name: 'Review' })).toBeInTheDocument();
  });

  it("keeps this computer's data without reloading, and sends the offer that was seen", async () => {
    const user = userEvent.setup();
    const waiting = status({ devices: [{ kind: 'waiting', deviceId: 'phone-1234', deviceName: 'Pixel', writtenAt: '2026-11-09T11:00:00Z' }] });
    const { posts } = server(offered(), { '/api/sync/resolve': () => jsonResponse(waiting) });
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);

    const dialog = await review(user);
    await user.click(within(dialog).getByRole('button', { name: "Keep this computer's data" }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(posts()).toEqual([{ method: 'POST', url: '/api/sync/resolve', body: { deviceId: 'phone-1234', writtenAt: '2026-11-09T11:00:00Z', winner: 'LOCAL' } }]);
    expect(reload).not.toHaveBeenCalled();
    expect(await screen.findByText(/Pixel · holds a different budget\. This computer keeps its data/)).toBeInTheDocument();
  });

  it("takes the other device's data and reloads the app, since everything on screen is now out of date", async () => {
    const user = userEvent.setup();
    const { posts } = server(offered(), { '/api/sync/resolve': () => jsonResponse(status()) });
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);

    const dialog = await review(user);
    await user.click(within(dialog).getByRole('button', { name: "Use Sebastien's Pixel & co's data" }));

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(posts()[0].body).toEqual({ deviceId: 'phone-1234', writtenAt: '2026-11-09T11:00:00Z', winner: 'REMOTE' });
  });

  it('does not reload, and says so, when the device wrote again since the person looked', async () => {
    const user = userEvent.setup();
    const { calls, setStatus } = server(offered(), { '/api/sync/resolve': () => jsonResponse({ error: 'offer_expired' }, 409) });
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);

    const dialog = await review(user);
    // by now the device has written again, so there is a newer offer to look at
    setStatus(status({ devices: [{ kind: 'offer', deviceId: 'phone-1234', offer: offer({ writtenAt: '2026-11-09T11:45:00Z' }) }] }));
    await user.click(within(dialog).getByRole('button', { name: "Use Sebastien's Pixel & co's data" }));

    await waitFor(() => expect(addToast).toHaveBeenCalledWith('That device has written since you looked. Review it again.'));
    expect(reload).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // and what is shown is looked up again, so the next Review is about the newer offer
    expect(calls.filter((call) => call.method === 'GET')).toHaveLength(2);
    await user.click(await screen.findByRole('button', { name: 'Review' }));
    expect(await screen.findByRole('dialog', { name: /holds a different budget/ })).toBeInTheDocument();
  });

  it('does not reload when it fails for another reason', async () => {
    const user = userEvent.setup();
    server(offered(), { '/api/sync/resolve': () => jsonResponse({}, 500) });
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);

    const dialog = await review(user);
    await user.click(within(dialog).getByRole('button', { name: "Use Sebastien's Pixel & co's data" }));

    await waitFor(() => expect(addToast).toHaveBeenCalledWith('That could not be done, so nothing was changed.'));
    expect(reload).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it("closes by itself when the offer is gone, such as after the other device took this computer's data", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { setStatus } = server(offered());
    renderWithToaster(<SyncSection isOpen folder="/Drive/Budget" />);
    await review(user);

    setStatus(status({ devices: [{ kind: 'merged', deviceId: 'phone-1234', deviceName: 'Pixel', writtenAt: '2026-11-09T11:30:00Z' }] }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SYNC_POLL_MS);
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
