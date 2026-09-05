import { hostname } from 'os';
import { basename, join, resolve } from 'path';
import { readdir, stat, unlink, rename, mkdir } from 'fs/promises';
import { backupDbTo } from '../db';
import { parseSnapshotName, parseSnapshots, selectSnapshotsToPrune, snapshotFileName } from './naming';

export interface Snapshot {
  name: string;
  path: string;
  host: string;
  takenAt: string;
  sizeBytes: number;
  /** Whether this machine wrote it — the app labels the others by host. */
  isThisMachine: boolean;
}

export function thisHost(): string {
  return hostname();
}

/**
 * Snapshots in a folder, newest first.
 *
 * Only files matching the app's own naming are returned, so pointing this at
 * the root of a Drive full of other things lists nothing rather than
 * everything.
 */
export async function listSnapshots(folder: string): Promise<Snapshot[]> {
  let names: string[];
  try {
    names = await readdir(folder);
  } catch {
    return [];
  }

  const host = parseSnapshotName(snapshotFileName(thisHost(), new Date()))?.host;

  const snapshots = await Promise.all(
    parseSnapshots(names).map(async (parsed) => {
      const path = join(folder, parsed.name);
      try {
        const stats = await stat(path);
        return { ...parsed, path, sizeBytes: stats.size, isThisMachine: parsed.host === host };
      } catch {
        // Vanished between the readdir and the stat — a cloud client
        // rearranging files underneath us is entirely normal here.
        return null;
      }
    }),
  );

  return snapshots.filter((snapshot): snapshot is Snapshot => snapshot !== null);
}

/**
 * Writes a consistent snapshot into `folder` and returns where it landed.
 *
 * Two things make this safe to drop into a folder a sync client is watching.
 * `sqlite.backup()` produces a single self-contained file rather than the live
 * database, which in WAL mode is three files that have to agree with each
 * other — copying those out from under SQLite is how synced databases get
 * corrupted. And the file is built under a temporary name and renamed into
 * place, so the client never sees, and never uploads, a half-written database.
 */
export async function writeSnapshot(folder: string): Promise<Snapshot> {
  await mkdir(folder, { recursive: true });

  const name = snapshotFileName(thisHost(), new Date());
  const path = join(folder, name);
  const staging = join(folder, `.${name}.partial`);

  try {
    await backupDbTo(staging);
    await rename(staging, path);
  } catch (error) {
    await unlink(staging).catch(() => {});
    throw error;
  }

  const parsed = parseSnapshotName(name)!;
  const stats = await stat(path);
  return { ...parsed, path, sizeBytes: stats.size, isThisMachine: true };
}

/** Deletes the snapshots retention no longer wants; returns how many went. */
export async function pruneSnapshots(folder: string, keep: number): Promise<number> {
  let names: string[];
  try {
    names = await readdir(folder);
  } catch {
    return 0;
  }

  const doomed = selectSnapshotsToPrune(names, keep);
  const results = await Promise.all(doomed.map((name) => unlink(join(folder, name)).then(() => true).catch(() => false)));
  return results.filter(Boolean).length;
}

/**
 * Turns a snapshot name from a request into a path, or `null`.
 *
 * The name arrives over HTTP, so it is checked twice: it has to parse as one
 * of this app's own snapshot names, and the path it resolves to has to still
 * be directly inside the configured folder. Either check alone would do; both
 * cost nothing and this one reads a file the user then restores over their
 * whole database.
 */
export function resolveSnapshotPath(folder: string, name: string): string | null {
  if (!parseSnapshotName(name) || basename(name) !== name) {
    return null;
  }
  const path = resolve(folder, name);
  return path === join(resolve(folder), name) ? path : null;
}
