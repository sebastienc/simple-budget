import type { DeviceStatus, FirstLinkOffer, Winner } from '../sync/plan';
import type { SyncOutcome } from './engine';
import type { SyncSettings } from './settings';
import { onBudgetChanged } from './changes';

// Runs the syncs and keeps what the screen shows: when the app starts, every minute, soon after the budget changed
// through the app, and when the person asks (ADR-0009 in simple-budget-mobile). The screens only ever talk to this. A
// port of the mobile app's `SyncCoordinator`, with a clock instead of the app's foreground and background.

/** Why the last sync did not go through, in terms the screen turns into a message. */
export type SyncProblem =
  /** The folder could not be listed: the drive is not mounted, the cloud client is signed out, the folder is gone. */
  | 'folder-unreachable'
  /** The database refused the merge; nothing was changed. */
  | 'failed'
  /** The merge was applied, but this computer's own file could not be written. */
  | 'publish-failed';

/** What the screen shows. */
export interface SyncStatus {
  enabled: boolean;
  /** The folder in use (the backup folder), or null when there is none. */
  folder: string | null;
  running: boolean;
  /** One entry per other device that has a file in the folder, as of the last sync. */
  devices: DeviceStatus[];
  problem: SyncProblem | null;
  /** How many rows the last sync changed here, or null if there was none yet. */
  changesBroughtIn: number | null;
  /** Stamps: when this computer last read the folder and last wrote its file. */
  lastRead: string | null;
  lastWrite: string | null;
}

export interface CoordinatorDeps {
  engine: { sync(): Promise<SyncOutcome>; resolveFirstLink(offer: FirstLinkOffer, winner: Winner): Promise<SyncOutcome> };
  settings: { read(): Promise<SyncSettings>; update(change: (current: SyncSettings) => Partial<SyncSettings>): Promise<SyncSettings> };
  /** The folder sync would use (the backup folder), or null if none is chosen. */
  folderPath: () => Promise<string | null>;
  /** How often to look at the folder. */
  intervalMs?: number;
  /** How long after a change to wait for more changes before syncing. */
  changeDelayMs?: number;
}

export const DEFAULT_INTERVAL_MS = 60_000;
export const DEFAULT_CHANGE_DELAY_MS = 3_000;

interface Shown {
  devices: DeviceStatus[];
  problem: SyncProblem | null;
  changesBroughtIn: number | null;
}

const NOTHING_SHOWN: Shown = { devices: [], problem: null, changesBroughtIn: null };

export class SyncCoordinator {
  private readonly deps: CoordinatorDeps;
  private shown: Shown = NOTHING_SHOWN;
  private running = 0;
  private changedSinceSync = false;
  private interval: NodeJS.Timeout | undefined;
  private delayed: NodeJS.Timeout | undefined;
  private stopListening: (() => void) | undefined;

  constructor(deps: CoordinatorDeps) {
    this.deps = deps;
  }

  /** Starts watching: syncs now, then every interval, and soon after each change. Does nothing while sync is off. */
  start(): void {
    this.stop();
    this.stopListening = onBudgetChanged(() => this.budgetChanged());
    this.interval = setInterval(() => {
      // A sync that takes longer than the interval is not piled on.
      if (this.running === 0) void this.syncIfOn();
    }, this.deps.intervalMs ?? DEFAULT_INTERVAL_MS);
    this.interval.unref?.();
    void this.syncIfOn();
  }

  stop(): void {
    clearInterval(this.interval);
    clearTimeout(this.delayed);
    this.interval = undefined;
    this.delayed = undefined;
    this.stopListening?.();
    this.stopListening = undefined;
  }

  async status(): Promise<SyncStatus> {
    const [settings, folder] = await Promise.all([this.deps.settings.read(), this.deps.folderPath()]);
    return { enabled: settings.enabled, folder, running: this.running > 0, ...this.shown, lastRead: settings.lastRead, lastWrite: settings.lastWrite };
  }

  /** The first link the person is being offered for `deviceId`, as of the last sync, if there is one. */
  offerFor(deviceId: string): FirstLinkOffer | undefined {
    const found = this.shown.devices.find((device) => device.kind === 'offer' && device.deviceId === deviceId);
    return found?.kind === 'offer' ? found.offer : undefined;
  }

  /** Turns sync on and syncs. It needs a folder: without one nothing is changed and the answer says so. */
  async turnOn(): Promise<'on' | 'no-folder'> {
    if ((await this.deps.folderPath()) === null) {
      return 'no-folder';
    }
    await this.deps.settings.update(() => ({ enabled: true }));
    this.shown = NOTHING_SHOWN;
    await this.run(() => this.deps.engine.sync());
    return 'on';
  }

  /** Turns sync off on this computer. Nothing in the folder is touched. */
  async turnOff(): Promise<void> {
    clearTimeout(this.delayed);
    this.delayed = undefined;
    await this.deps.settings.update(() => ({ enabled: false }));
    this.shown = NOTHING_SHOWN;
  }

  /** Syncs now. Never throws for an expected failure; the result is in the status. */
  async syncNow(): Promise<void> {
    await this.run(() => this.deps.engine.sync());
  }

  /** Settles a first link the person was offered (ADR-0008). */
  async resolve(offer: FirstLinkOffer, winner: Winner): Promise<void> {
    await this.run(() => this.deps.engine.resolveFirstLink(offer, winner));
  }

  /** Before quitting: publishes what changed since the last sync, if anything did. The caller bounds how long to wait. */
  async syncOnQuit(): Promise<void> {
    clearTimeout(this.delayed);
    this.delayed = undefined;
    if (this.changedSinceSync) {
      await this.syncIfOn();
    }
  }

  private budgetChanged(): void {
    this.changedSinceSync = true;
    clearTimeout(this.delayed);
    this.delayed = setTimeout(() => {
      this.delayed = undefined;
      void this.syncIfOn();
    }, this.deps.changeDelayMs ?? DEFAULT_CHANGE_DELAY_MS);
    this.delayed.unref?.();
  }

  private async syncIfOn(): Promise<void> {
    try {
      if ((await this.deps.settings.read()).enabled) {
        await this.syncNow();
      }
    } catch (error) {
      console.error('Sync failed unexpectedly', error);
    }
  }

  private async run(task: () => Promise<SyncOutcome>): Promise<void> {
    this.running++;
    let outcome: SyncOutcome;
    try {
      outcome = await task();
    } catch (error) {
      // The engine reports what it expects; anything else is a bug, and must not take the app down.
      console.error('Sync failed unexpectedly', error);
      outcome = { kind: 'failed', cause: error };
    } finally {
      this.running--;
    }
    await this.show(outcome);
  }

  private async show(outcome: SyncOutcome): Promise<void> {
    switch (outcome.kind) {
      case 'not-set-up':
        this.shown = NOTHING_SHOWN;
        break;
      case 'folder-unreachable':
        console.warn('The sync folder could not be reached', outcome.cause);
        this.shown = { ...this.shown, problem: 'folder-unreachable' };
        break;
      case 'failed':
        console.warn('The merge could not be applied', outcome.cause);
        this.shown = { ...this.shown, problem: 'failed' };
        break;
      case 'offer-expired':
        // The device wrote again since the person saw the offer: look again and show the current one.
        await this.run(() => this.deps.engine.sync());
        break;
      case 'done': {
        const { report } = outcome;
        this.changedSinceSync = false;
        this.shown = {
          devices: report.devices,
          problem: report.published.kind === 'failed' ? 'publish-failed' : null,
          changesBroughtIn: report.changes.added + report.changes.updated + report.changes.removed,
        };
        break;
      }
    }
  }
}
