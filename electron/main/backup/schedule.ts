import { readBackupSettings } from './settings';
import { listSnapshots, pruneSnapshots, writeSnapshot, type Snapshot } from './snapshots';

const HOUR = 60 * 60 * 1000;

/** How stale this machine's newest snapshot must be before taking another. */
const SNAPSHOT_INTERVAL = 20 * HOUR;
/** How often to check. Well under the interval, so a long-running app still lands one a day. */
const CHECK_INTERVAL = 3 * HOUR;
/** Quitting right after a snapshot shouldn't write a near-identical second one. */
const QUIT_FLOOR = 5 * 60 * 1000;

let timer: NodeJS.Timeout | undefined;

async function newestForThisMachine(folder: string): Promise<Snapshot | undefined> {
  return (await listSnapshots(folder)).find((snapshot) => snapshot.isThisMachine);
}

/** Takes one now regardless of when the last one was, and applies retention. */
export async function snapshotNow(): Promise<Snapshot | null> {
  const { folder, keep } = await readBackupSettings();
  if (!folder) {
    return null;
  }
  const snapshot = await writeSnapshot(folder);
  await pruneSnapshots(folder, keep);
  return snapshot;
}

/** Takes one only if this machine's newest is old enough. */
export async function maybeSnapshot(minimumAge = SNAPSHOT_INTERVAL): Promise<Snapshot | null> {
  const { folder } = await readBackupSettings();
  if (!folder) {
    return null;
  }

  const newest = await newestForThisMachine(folder);
  if (newest && Date.now() - new Date(newest.takenAt).getTime() < minimumAge) {
    return null;
  }

  return snapshotNow();
}

/**
 * A failed backup must never take the app down with it.
 *
 * The folder is outside the app's control — an unmounted drive, a cloud client
 * signed out, a path that has since been renamed. None of that is a reason to
 * fail to start, or to block quitting; it's a reason to log and carry on.
 */
async function attempt(reason: string, run: () => Promise<Snapshot | null>): Promise<void> {
  try {
    const snapshot = await run();
    if (snapshot) {
      console.log(`Backup snapshot (${reason}): ${snapshot.path}`);
    }
  } catch (error) {
    console.error(`Backup snapshot (${reason}) failed`, error);
  }
}

export function startBackupSchedule(): void {
  attempt('startup', () => maybeSnapshot());
  timer = setInterval(() => attempt('scheduled', () => maybeSnapshot()), CHECK_INTERVAL);
  // Don't hold the process open just to take a backup nobody is waiting for.
  timer.unref?.();
}

export function stopBackupSchedule(): void {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
}

export async function snapshotOnQuit(): Promise<void> {
  stopBackupSchedule();
  await attempt('quit', () => maybeSnapshot(QUIT_FLOOR));
}
