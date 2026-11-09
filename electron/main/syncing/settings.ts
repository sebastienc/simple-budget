import { randomUUID } from 'crypto';
import { dirname, join } from 'path';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { dbPath } from '../db';

// What this computer remembers about syncing (ADR-0009 in simple-budget-mobile): whether it is on, who it is to the
// other devices, which first links it decided to keep its own data in, and when it last read and wrote.
//
// Beside the database, not in it, like the backup settings: it describes this machine, not this budget. A snapshot
// restored onto another computer must not arrive claiming to be the first one, and `SIMPLE_BUDGET_DB` isolates it, so
// a demo run cannot sync into a real folder.

export interface SyncSettings {
  /** Whether sync is on. The folder is the backup folder (see backup/settings.ts). */
  enabled: boolean;
  /** This computer's id to the other devices; made the first time it is needed and never changed. */
  deviceId: string | null;
  /** Devices whose first link the person settled by keeping this computer's data. */
  keptAgainst: string[];
  /** A stamp: when this computer last read the folder. */
  lastRead: string | null;
  /** A stamp: when this computer last wrote its own file. */
  lastWrite: string | null;
}

export const DEFAULT_SYNC_SETTINGS: SyncSettings = { enabled: false, deviceId: null, keptAgainst: [], lastRead: null, lastWrite: null };

function settingsPath(): string {
  return join(dirname(dbPath()), 'sync-settings.json');
}

export function coerceSyncSettings(raw: unknown): SyncSettings {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_SYNC_SETTINGS };
  }
  const { enabled, deviceId, keptAgainst, lastRead, lastWrite } = raw as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : null);
  return {
    enabled: enabled === true,
    deviceId: text(deviceId),
    keptAgainst: Array.isArray(keptAgainst) ? [...new Set(keptAgainst.filter((id): id is string => typeof id === 'string' && id !== ''))].sort() : [],
    lastRead: text(lastRead),
    lastWrite: text(lastWrite),
  };
}

export async function readSyncSettings(): Promise<SyncSettings> {
  try {
    return coerceSyncSettings(JSON.parse(await readFile(settingsPath(), 'utf8')));
  } catch {
    // Missing on first run, and unreadable or corrupt is not worth failing over: sync off is a safe state to fall back to.
    return { ...DEFAULT_SYNC_SETTINGS };
  }
}

// Changes are read, changed and written one at a time, so two at once (a sync recording its time while the person turns
// sync off) cannot lose one of them.
let queue: Promise<unknown> = Promise.resolve();

/** Applies `change` to the stored settings and writes them, atomically. Returns the new settings. */
export function updateSyncSettings(change: (current: SyncSettings) => Partial<SyncSettings>): Promise<SyncSettings> {
  const run = async () => {
    const current = await readSyncSettings();
    const next = coerceSyncSettings({ ...current, ...change(current) });
    const path = settingsPath();
    await mkdir(dirname(path), { recursive: true });
    const temp = `${path}.${randomUUID()}.tmp`;
    await writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    await rename(temp, path);
    return next;
  };
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}

/** This computer's id to the other devices. Made and kept the first time it is asked for. */
export async function syncDeviceId(): Promise<string> {
  const existing = (await readSyncSettings()).deviceId;
  if (existing !== null) {
    return existing;
  }
  // Re-checked inside the update: two first calls at once must agree on one id.
  return (await updateSyncSettings((current) => ({ deviceId: current.deviceId ?? randomUUID() }))).deviceId as string;
}

/** The settings the engine uses, in the terms it uses them. */
export const engineSettings = {
  deviceId: syncDeviceId,
  keptAgainst: async (): Promise<ReadonlySet<string>> => new Set((await readSyncSettings()).keptAgainst),
  keepAgainst: async (deviceId: string): Promise<void> => {
    await updateSyncSettings((current) => ({ keptAgainst: [...current.keptAgainst, deviceId] }));
  },
  stopKeepingAgainst: async (deviceId: string): Promise<void> => {
    await updateSyncSettings((current) => ({ keptAgainst: current.keptAgainst.filter((id) => id !== deviceId) }));
  },
  recordRead: async (at: string): Promise<void> => {
    await updateSyncSettings(() => ({ lastRead: at }));
  },
  recordWrite: async (at: string): Promise<void> => {
    await updateSyncSettings(() => ({ lastWrite: at }));
  },
};
