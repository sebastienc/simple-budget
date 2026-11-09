import { randomUUID } from 'crypto';
import { open, readdir, rename, unlink } from 'fs/promises';
import { basename, join } from 'path';
import { deviceIdOfSyncFile } from '../sync/file';

// The shared folder the devices exchange their sync files through (ADR-0009 in simple-budget-mobile), as the engine
// sees it. The real one is a directory on disk that a cloud client (Google Drive for desktop, Dropbox, ...) keeps in
// step with the other devices; tests use one in memory. Every call may throw: the folder is outside the app's control.

export interface SyncFolder {
  /** The names of the files in the folder, whatever they are; the engine picks out the sync files. */
  list(): Promise<string[]>;
  /** At most `limit` bytes of the file, or null if it is not there (any more). */
  read(name: string, limit: number): Promise<Uint8Array | null>;
  /** Creates or replaces the file as a whole: a reader sees the old file or the new one, never half of one. */
  write(name: string, bytes: Uint8Array): Promise<void>;
}

/**
 * A folder on disk. It only ever reads or writes a file whose name is a sync file's name: the snapshots that share
 * the folder, and anything else the person keeps there, cannot be touched through it.
 */
export class DirectorySyncFolder implements SyncFolder {
  private readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  private fileFor(name: string): string {
    if (basename(name) !== name || deviceIdOfSyncFile(name) === null) {
      throw new Error(`'${name}' is not the name of a sync file`);
    }
    return join(this.path, name);
  }

  async list(): Promise<string[]> {
    return (await readdir(this.path, { withFileTypes: true })).filter((entry) => !entry.isDirectory()).map((entry) => entry.name);
  }

  async read(name: string, limit: number): Promise<Uint8Array | null> {
    const file = this.fileFor(name);
    let handle;
    try {
      handle = await open(file, 'r');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
    try {
      const info = await handle.stat();
      if (!info.isFile()) {
        throw new Error(`'${name}' is not a file`);
      }
      const buffer = Buffer.alloc(Math.min(info.size, limit));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  async write(name: string, bytes: Uint8Array): Promise<void> {
    const file = this.fileFor(name);
    // Written beside the file and moved over it, so the cloud client never uploads half a file, and a crash leaves the
    // old one. The temporary name starts with a dot and ends in .tmp, so it is never mistaken for a sync file.
    const temp = join(this.path, `.${name}.${randomUUID()}.tmp`);
    try {
      const handle = await open(temp, 'wx');
      try {
        await handle.writeFile(bytes);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temp, file);
    } catch (error) {
      await unlink(temp).catch(() => undefined);
      throw error;
    }
  }
}
