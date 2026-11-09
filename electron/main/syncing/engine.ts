import { isDeepStrictEqual } from 'util';
import { deviceIdOfSyncFile, decodeSyncFile, encodeSyncFile, MAX_SYNC_FILE_BYTES, SYNC_SCHEMA, syncFileName } from '../sync/file';
import type { DeviceState, MergedState, ReadResult, RemoteFile, SyncFile } from '../sync/model';
import { stateOf } from '../sync/model';
import { planSync } from '../sync/plan';
import type { DeviceStatus, FirstLinkOffer, SyncPlan, Winner } from '../sync/plan';
import { stampOf } from '../sync/stamp';
import type { SyncFolder } from './folder';
import type { SyncChanges, MergeOutcome } from '../db/syncStore';

// Syncing this computer with the other devices through a shared folder (ADR-0008, ADR-0009 in simple-budget-mobile).
// A port of the mobile app's `SyncEngine`: it reads every other device's file, merges the ones that may be merged
// into this computer's state in one transaction, and writes this device's own file if its state changed. The files that
// cannot be read, or hold a budget that has never met this one, are reported and left alone. Only one sync runs at a
// time. Nothing here knows about timers or screens; the coordinator does.

/** What happened to this device's own file. */
export type Published =
  | { kind: 'wrote'; at: string }
  /** The file already held exactly this state, so it was left alone. */
  | { kind: 'unchanged' }
  /** The merge was applied here, but the file could not be written; the next sync tries again. */
  | { kind: 'failed'; cause: unknown };

/** What a sync did. Only what this device did is reported, never that the others received it. */
export interface SyncReport {
  readAt: string;
  changes: SyncChanges;
  /** One entry per other device with a file in the folder, by device id. */
  devices: DeviceStatus[];
  published: Published;
}

export type SyncOutcome =
  /** Sync is off, or no folder has been chosen. */
  | { kind: 'not-set-up' }
  /** The folder could not be listed; nothing was changed, here or there. */
  | { kind: 'folder-unreachable'; cause: unknown }
  /** The database refused the merge, which was rolled back whole; nothing was changed. */
  | { kind: 'failed'; cause: unknown }
  /** The device's file changed or went away since it was offered: sync again to see the current offer. */
  | { kind: 'offer-expired' }
  | { kind: 'done'; report: SyncReport };

export interface EngineSettings {
  deviceId(): Promise<string>;
  keptAgainst(): Promise<ReadonlySet<string>>;
  keepAgainst(deviceId: string): Promise<void>;
  stopKeepingAgainst(deviceId: string): Promise<void>;
  recordRead(at: string): Promise<void>;
  recordWrite(at: string): Promise<void>;
}

export interface EngineStore {
  mergeInto(deviceId: string, choose: (local: DeviceState) => DeviceState[]): Promise<MergeOutcome>;
  replaceWith(state: DeviceState): Promise<SyncChanges>;
}

export interface EngineDeps {
  /** The folder to sync through, asked for each time so that choosing or clearing it takes effect at once. Null: off. */
  folder: () => Promise<SyncFolder | null>;
  store: EngineStore;
  settings: EngineSettings;
  /** Makes a copy of the database that can be restored from; called before a first link replaces this computer's data. */
  safetyCopy: () => Promise<unknown>;
  now: () => Date;
  /** How this device is named in its file, such as the computer's name. */
  deviceName: string;
}

export class SyncEngine {
  private readonly deps: EngineDeps;
  private tail: Promise<unknown> = Promise.resolve();

  constructor(deps: EngineDeps) {
    this.deps = deps;
  }

  /** Runs `task` after every task before it has finished, so only one sync is ever running. */
  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task, task);
    this.tail = result.catch(() => undefined);
    return result;
  }

  /** Runs `task` while no sync is running and none starts, such as swapping the whole database from under it. */
  exclusively<T>(task: () => Promise<T>): Promise<T> {
    return this.exclusive(task);
  }

  sync(): Promise<SyncOutcome> {
    return this.exclusive(() => this.runSync());
  }

  /**
   * Settles a first link (ADR-0008): 'REMOTE' replaces this computer's data with the other device's, after a safety copy;
   * 'LOCAL' keeps this computer's data and leaves that device alone until it has taken it. `offer` is the one the person
   * saw: if the device has written since, nothing is replaced and the result is 'offer-expired'.
   */
  resolveFirstLink(offer: FirstLinkOffer, winner: Winner): Promise<SyncOutcome> {
    return this.exclusive(async () => {
      const { deps } = this;
      if (winner === 'LOCAL') {
        await deps.settings.keepAgainst(offer.deviceId);
        return this.runSync();
      }
      const folder = await deps.folder();
      if (folder === null) {
        return { kind: 'not-set-up' };
      }
      let bytes: Uint8Array | null;
      try {
        bytes = await folder.read(syncFileName(offer.deviceId), MAX_SYNC_FILE_BYTES + 1);
      } catch (cause) {
        return { kind: 'folder-unreachable', cause };
      }
      const read = bytes === null ? null : decodeSyncFile(bytes, stampOf(deps.now()), { supportedSchema: SYNC_SCHEMA, fileDeviceId: offer.deviceId });
      if (read === null || read.kind !== 'read' || read.file.header.writtenAt !== offer.writtenAt) {
        return { kind: 'offer-expired' };
      }
      try {
        await deps.safetyCopy();
        await deps.store.replaceWith(stateOf(read.file));
      } catch (cause) {
        return { kind: 'failed', cause };
      }
      await deps.settings.stopKeepingAgainst(offer.deviceId);
      return this.runSync();
    });
  }

  private async runSync(): Promise<SyncOutcome> {
    const { deps } = this;
    const folder = await deps.folder();
    if (folder === null) {
      return { kind: 'not-set-up' };
    }
    const deviceId = await deps.settings.deviceId();
    const now = stampOf(deps.now());

    let others: RemoteFile[];
    try {
      others = await this.readOthers(folder, deviceId, now);
    } catch (cause) {
      return { kind: 'folder-unreachable', cause };
    }

    const keptAgainst = await deps.settings.keptAgainst();
    let plan: SyncPlan | undefined;
    let outcome: MergeOutcome;
    try {
      outcome = await deps.store.mergeInto(deviceId, (local) => {
        plan = planSync(local, others, keptAgainst);
        return plan.merge;
      });
    } catch (cause) {
      return { kind: 'failed', cause };
    }

    const published = await this.publish(folder, deviceId, outcome.merged, now);
    await deps.settings.recordRead(now);
    if (published.kind === 'wrote') {
      await deps.settings.recordWrite(now);
    }
    return { kind: 'done', report: { readAt: now, changes: outcome.changes, devices: (plan as SyncPlan).statuses, published } };
  }

  /** Every other device's file, decoded. A file that cannot be read is a skipped file, not a failed sync. */
  private async readOthers(folder: SyncFolder, own: string, now: string): Promise<RemoteFile[]> {
    const ids = [...new Set((await folder.list()).map(deviceIdOfSyncFile).filter((id): id is string => id !== null && id !== own))];
    const files: RemoteFile[] = [];
    for (const deviceId of ids) {
      let bytes: Uint8Array | null;
      try {
        bytes = await folder.read(syncFileName(deviceId), MAX_SYNC_FILE_BYTES + 1);
      } catch (error) {
        const result: ReadResult = { kind: 'skipped', reason: 'UNREADABLE', detail: `could not be read: ${error instanceof Error ? error.message : String(error)}` };
        files.push({ deviceId, result });
        continue;
      }
      // Gone between the listing and the read: nothing to report.
      if (bytes !== null) {
        files.push({ deviceId, result: decodeSyncFile(bytes, now, { supportedSchema: SYNC_SCHEMA, fileDeviceId: deviceId }) });
      }
    }
    return files;
  }

  /** Writes this device's file unless it already holds exactly `merged`, so the folder is not touched needlessly. */
  private async publish(folder: SyncFolder, deviceId: string, merged: MergedState, now: string): Promise<Published> {
    const name = syncFileName(deviceId);
    try {
      const bytes = await folder.read(name, MAX_SYNC_FILE_BYTES + 1);
      const existing = bytes === null ? null : decodeSyncFile(bytes, now, { supportedSchema: SYNC_SCHEMA, fileDeviceId: deviceId });
      if (
        existing !== null &&
        existing.kind === 'read' &&
        existing.file.header.deviceName === this.deps.deviceName &&
        isDeepStrictEqual(existing.file.rows, merged.rows) &&
        isDeepStrictEqual(existing.file.tombstones, merged.tombstones)
      ) {
        return { kind: 'unchanged' };
      }
      const file: SyncFile = { header: { deviceId, deviceName: this.deps.deviceName, writtenAt: now, schema: SYNC_SCHEMA }, rows: merged.rows, tombstones: merged.tombstones };
      await folder.write(name, encodeSyncFile(file));
      return { kind: 'wrote', at: now };
    } catch (cause) {
      return { kind: 'failed', cause };
    }
  }
}
