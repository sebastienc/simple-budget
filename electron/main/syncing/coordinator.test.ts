import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FirstLinkOffer } from '../sync/plan';
import { notifyBudgetChanged } from './changes';
import { DEFAULT_CHANGE_DELAY_MS, DEFAULT_INTERVAL_MS, SyncCoordinator } from './coordinator';
import type { CoordinatorDeps } from './coordinator';
import type { SyncOutcome, SyncReport } from './engine';
import { DEFAULT_SYNC_SETTINGS } from './settings';
import type { SyncSettings } from './settings';

const report = (overrides: Partial<SyncReport> = {}): SyncReport => ({
  readAt: '2026-11-09T12:00:00Z',
  changes: { added: 1, updated: 2, removed: 3, tombstones: 4 },
  devices: [{ kind: 'merged', deviceId: 'phone', deviceName: 'Pixel 10', writtenAt: '2026-11-09T11:00:00Z' }],
  published: { kind: 'wrote', at: '2026-11-09T12:00:00Z' },
  ...overrides,
});
const done = (r: SyncReport = report()): SyncOutcome => ({ kind: 'done', report: r });
const offer = { deviceId: 'phone', deviceName: 'Pixel 10', writtenAt: '2026-11-09T11:00:00Z' } as FirstLinkOffer;

function setUp(initial: Partial<SyncSettings> = {}, folder: string | null = '/Drive/Budget') {
  let settings: SyncSettings = { ...DEFAULT_SYNC_SETTINGS, ...initial };
  const outcomes: SyncOutcome[] = [];
  const engine = {
    sync: vi.fn(async (): Promise<SyncOutcome> => outcomes.shift() ?? done()),
    resolveFirstLink: vi.fn(async (): Promise<SyncOutcome> => outcomes.shift() ?? done()),
  };
  const deps: CoordinatorDeps = {
    engine,
    settings: {
      read: async () => settings,
      update: async (change) => (settings = { ...settings, ...change(settings) }),
    },
    folderPath: async () => folder,
  };
  const coordinator = new SyncCoordinator(deps);
  return { coordinator, engine, outcomes, settings: () => settings };
}

/** Lets the promises that are ready run, without moving the clock. */
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SyncCoordinator schedule', () => {
  it('syncs at start when sync is on, and not when it is off', async () => {
    const on = setUp({ enabled: true });
    on.coordinator.start();
    await settle();
    expect(on.engine.sync).toHaveBeenCalledTimes(1);
    on.coordinator.stop();

    const off = setUp({ enabled: false });
    off.coordinator.start();
    await settle();
    expect(off.engine.sync).not.toHaveBeenCalled();
    off.coordinator.stop();
  });

  it('syncs every interval, a minute by default', async () => {
    const { coordinator, engine } = setUp({ enabled: true });
    coordinator.start();
    await settle();
    expect(DEFAULT_INTERVAL_MS).toBe(60_000);

    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS - 1);
    expect(engine.sync).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(engine.sync).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS * 3);
    expect(engine.sync).toHaveBeenCalledTimes(5);
    coordinator.stop();
  });

  it('does not pile a new sync on one still running', async () => {
    const { coordinator, engine } = setUp({ enabled: true });
    let finish!: () => void;
    engine.sync.mockImplementationOnce(() => new Promise<SyncOutcome>((resolve) => (finish = () => resolve(done()))));
    coordinator.start();
    await settle();

    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS * 2);
    expect(engine.sync).toHaveBeenCalledTimes(1);
    expect((await coordinator.status()).running).toBe(true);

    finish();
    await settle();
    expect((await coordinator.status()).running).toBe(false);
    coordinator.stop();
  });

  it('syncs soon after the budget changes, once for a burst of changes', async () => {
    const { coordinator, engine } = setUp({ enabled: true });
    coordinator.start();
    await settle();
    engine.sync.mockClear();

    notifyBudgetChanged();
    await vi.advanceTimersByTimeAsync(DEFAULT_CHANGE_DELAY_MS - 500);
    notifyBudgetChanged();
    await vi.advanceTimersByTimeAsync(DEFAULT_CHANGE_DELAY_MS - 1);
    expect(engine.sync).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(engine.sync).toHaveBeenCalledTimes(1);
    coordinator.stop();
  });

  it('does not sync for a change while sync is off', async () => {
    const { coordinator, engine } = setUp({ enabled: false });
    coordinator.start();
    notifyBudgetChanged();
    await vi.advanceTimersByTimeAsync(DEFAULT_CHANGE_DELAY_MS + DEFAULT_INTERVAL_MS);
    expect(engine.sync).not.toHaveBeenCalled();
    coordinator.stop();
  });

  it('stops listening and ticking when stopped', async () => {
    const { coordinator, engine } = setUp({ enabled: true });
    coordinator.start();
    await settle();
    coordinator.stop();
    engine.sync.mockClear();

    notifyBudgetChanged();
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS * 3);
    expect(engine.sync).not.toHaveBeenCalled();
  });

  it('can be started twice without syncing twice as often', async () => {
    const { coordinator, engine } = setUp({ enabled: true });
    coordinator.start();
    coordinator.start();
    await settle();
    engine.sync.mockClear();
    notifyBudgetChanged();
    await vi.advanceTimersByTimeAsync(DEFAULT_CHANGE_DELAY_MS);
    expect(engine.sync).toHaveBeenCalledTimes(1);
    coordinator.stop();
  });

  it('survives an engine that throws, and syncs again next time', async () => {
    const { coordinator, engine } = setUp({ enabled: true });
    engine.sync.mockRejectedValueOnce(new Error('bug'));
    coordinator.start();
    await settle();
    expect((await coordinator.status()).problem).toBe('failed');

    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS);
    expect(engine.sync).toHaveBeenCalledTimes(2);
    expect((await coordinator.status()).problem).toBeNull();
    coordinator.stop();
  });
});

describe('SyncCoordinator status', () => {
  it('starts out off and empty', async () => {
    const { coordinator } = setUp();
    expect(await coordinator.status()).toEqual({ enabled: false, folder: '/Drive/Budget', running: false, devices: [], problem: null, changesBroughtIn: null, lastRead: null, lastWrite: null });
  });

  it('shows what the last sync found and did', async () => {
    const { coordinator, outcomes } = setUp({ enabled: true, lastRead: '2026-11-09T12:00:00Z', lastWrite: '2026-11-09T11:59:00Z' });
    outcomes.push(done());
    await coordinator.syncNow();
    expect(await coordinator.status()).toMatchObject({
      enabled: true,
      devices: [{ kind: 'merged', deviceId: 'phone' }],
      problem: null,
      changesBroughtIn: 6,
      lastRead: '2026-11-09T12:00:00Z',
      lastWrite: '2026-11-09T11:59:00Z',
    });
  });

  it('shows running while a sync runs', async () => {
    const { coordinator, engine } = setUp({ enabled: true });
    let finish!: () => void;
    engine.sync.mockImplementationOnce(() => new Promise<SyncOutcome>((resolve) => (finish = () => resolve(done()))));
    const running = coordinator.syncNow();
    await settle();
    expect((await coordinator.status()).running).toBe(true);
    finish();
    await running;
    expect((await coordinator.status()).running).toBe(false);
  });

  it.each([
    [{ kind: 'folder-unreachable', cause: new Error('x') } as SyncOutcome, 'folder-unreachable'],
    [{ kind: 'failed', cause: new Error('x') } as SyncOutcome, 'failed'],
    [done(report({ published: { kind: 'failed', cause: new Error('x') } })), 'publish-failed'],
  ])('shows a problem for %j', async (outcome, problem) => {
    const { coordinator, outcomes } = setUp({ enabled: true });
    outcomes.push(outcome);
    await coordinator.syncNow();
    expect((await coordinator.status()).problem).toBe(problem);
  });

  it('keeps the devices it found when a later sync has a problem, and clears the problem when one goes through', async () => {
    const { coordinator, outcomes } = setUp({ enabled: true });
    outcomes.push(done(), { kind: 'folder-unreachable', cause: new Error('x') }, done(report({ changes: { added: 0, updated: 0, removed: 0, tombstones: 0 } })));
    await coordinator.syncNow();
    await coordinator.syncNow();
    expect(await coordinator.status()).toMatchObject({ problem: 'folder-unreachable', devices: [{ deviceId: 'phone' }], changesBroughtIn: 6 });
    await coordinator.syncNow();
    expect(await coordinator.status()).toMatchObject({ problem: null, changesBroughtIn: 0 });
  });

  it('shows nothing when sync turns out not to be set up', async () => {
    const { coordinator, outcomes } = setUp({ enabled: true });
    outcomes.push(done(), { kind: 'not-set-up' });
    await coordinator.syncNow();
    await coordinator.syncNow();
    expect(await coordinator.status()).toMatchObject({ devices: [], problem: null, changesBroughtIn: null });
  });
});

describe('SyncCoordinator turning on and off', () => {
  it('turns sync on and syncs', async () => {
    const { coordinator, engine, settings } = setUp();
    expect(await coordinator.turnOn()).toBe('on');
    expect(settings().enabled).toBe(true);
    expect(engine.sync).toHaveBeenCalledTimes(1);
  });

  it('does not turn on without a folder', async () => {
    const { coordinator, engine, settings } = setUp({}, null);
    expect(await coordinator.turnOn()).toBe('no-folder');
    expect(settings().enabled).toBe(false);
    expect(engine.sync).not.toHaveBeenCalled();
  });

  it('turns sync off and forgets what it showed, leaving the identity and decisions alone', async () => {
    const { coordinator, settings } = setUp({ enabled: true, deviceId: 'me', keptAgainst: ['phone'] });
    await coordinator.syncNow();
    await coordinator.turnOff();
    expect(settings()).toMatchObject({ enabled: false, deviceId: 'me', keptAgainst: ['phone'] });
    expect(await coordinator.status()).toMatchObject({ enabled: false, devices: [], changesBroughtIn: null });
  });

  it('a change pending when sync is turned off does not sync', async () => {
    const { coordinator, engine } = setUp({ enabled: true });
    coordinator.start();
    await settle();
    engine.sync.mockClear();
    notifyBudgetChanged();
    await coordinator.turnOff();
    await vi.advanceTimersByTimeAsync(DEFAULT_CHANGE_DELAY_MS * 2);
    expect(engine.sync).not.toHaveBeenCalled();
    coordinator.stop();
  });
});

describe('SyncCoordinator first links', () => {
  it("hands the person's choice to the engine and shows the result", async () => {
    const { coordinator, engine, outcomes } = setUp({ enabled: true });
    outcomes.push(done(report({ devices: [{ kind: 'waiting', deviceId: 'phone', deviceName: 'Pixel 10', writtenAt: 'x' }] })));
    await coordinator.resolve(offer, 'LOCAL');
    expect(engine.resolveFirstLink).toHaveBeenCalledWith(offer, 'LOCAL');
    expect((await coordinator.status()).devices).toMatchObject([{ kind: 'waiting' }]);
  });

  it('looks again when the offer has expired', async () => {
    const { coordinator, engine, outcomes } = setUp({ enabled: true });
    outcomes.push({ kind: 'offer-expired' }, done());
    await coordinator.resolve(offer, 'REMOTE');
    expect(engine.resolveFirstLink).toHaveBeenCalledTimes(1);
    expect(engine.sync).toHaveBeenCalledTimes(1);
    expect((await coordinator.status()).devices).toHaveLength(1);
  });
});

describe('SyncCoordinator on quit', () => {
  it('publishes what changed since the last sync', async () => {
    const { coordinator, engine } = setUp({ enabled: true });
    coordinator.start();
    await settle();
    engine.sync.mockClear();
    notifyBudgetChanged();

    await coordinator.syncOnQuit();

    expect(engine.sync).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(DEFAULT_CHANGE_DELAY_MS * 2); // and the delayed one is gone
    expect(engine.sync).toHaveBeenCalledTimes(1);
    coordinator.stop();
  });

  it('does nothing when nothing changed since the last sync', async () => {
    const { coordinator, engine } = setUp({ enabled: true });
    coordinator.start();
    await settle();
    engine.sync.mockClear();
    await coordinator.syncOnQuit();
    expect(engine.sync).not.toHaveBeenCalled();
    coordinator.stop();
  });

  it('does nothing when the change has already been published by a sync that went through', async () => {
    const { coordinator, engine } = setUp({ enabled: true });
    coordinator.start();
    await settle();
    notifyBudgetChanged();
    await vi.advanceTimersByTimeAsync(DEFAULT_CHANGE_DELAY_MS); // the sync that follows the change
    engine.sync.mockClear();

    await coordinator.syncOnQuit();

    expect(engine.sync).not.toHaveBeenCalled();
    coordinator.stop();
  });

  it('does nothing when sync is off', async () => {
    const { coordinator, engine } = setUp({ enabled: false });
    coordinator.start();
    notifyBudgetChanged();
    await coordinator.syncOnQuit();
    expect(engine.sync).not.toHaveBeenCalled();
    coordinator.stop();
  });

  it('tries again at the next opportunity when the sync it started did not go through', async () => {
    const { coordinator, engine, outcomes } = setUp({ enabled: true });
    coordinator.start();
    await settle();
    engine.sync.mockClear();
    outcomes.push({ kind: 'folder-unreachable', cause: new Error('x') });
    notifyBudgetChanged();
    await coordinator.syncOnQuit();
    engine.sync.mockClear();
    await coordinator.syncOnQuit();
    expect(engine.sync).toHaveBeenCalledTimes(1);
    coordinator.stop();
  });
});
