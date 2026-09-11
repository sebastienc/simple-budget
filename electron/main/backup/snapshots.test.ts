import { mkdtemp, readdir, rm, writeFile } from 'fs/promises';
import { hostname, tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { withTestDb } from '../../../test/dbFixture';
import { listSnapshots, pruneSnapshots, resolveSnapshotPath, thisHost, writeSnapshot } from './snapshots';
import { snapshotFileName } from './naming';

async function scratchDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'simple-budget-test-'));
}

describe('thisHost', () => {
  it('returns the machine\'s real hostname', () => {
    expect(thisHost()).toBe(hostname());
  });
});

describe('resolveSnapshotPath', () => {
  it('resolves a valid snapshot name to a path inside the folder', () => {
    const name = snapshotFileName('laptop', new Date('2026-01-01T00:00:00Z'));
    expect(resolveSnapshotPath('/backups', name)).toBe(join('/backups', name));
  });

  it('rejects a name that does not parse as one of this app\'s snapshots', () => {
    expect(resolveSnapshotPath('/backups', 'not-a-snapshot.db')).toBeNull();
  });

  it('rejects a path-traversal attempt disguised as a snapshot name', () => {
    const name = snapshotFileName('laptop', new Date('2026-01-01T00:00:00Z'));
    expect(resolveSnapshotPath('/backups', `../${name}`)).toBeNull();
    expect(resolveSnapshotPath('/backups', `subdir/${name}`)).toBeNull();
  });
});

describe('listSnapshots', () => {
  it('returns an empty array for a folder that does not exist', async () => {
    expect(await listSnapshots(join(tmpdir(), 'simple-budget-test-nonexistent'))).toEqual([]);
  });

  it('lists only this app\'s own snapshot files, newest first', async () => {
    const dir = await scratchDir();
    try {
      const older = snapshotFileName('laptop', new Date('2026-01-01T00:00:00Z'));
      const newer = snapshotFileName('laptop', new Date('2026-02-01T00:00:00Z'));
      await writeFile(join(dir, older), 'x');
      await writeFile(join(dir, newer), 'xx');
      await writeFile(join(dir, 'not-a-snapshot.db'), 'ignored');

      const snapshots = await listSnapshots(dir);

      expect(snapshots.map((s) => s.name)).toEqual([newer, older]);
      expect(snapshots[1].sizeBytes).toBe(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('marks a snapshot named after this host as isThisMachine', async () => {
    const dir = await scratchDir();
    try {
      const mine = snapshotFileName(thisHost(), new Date('2026-01-01T00:00:00Z'));
      const theirs = snapshotFileName('some-other-laptop', new Date('2026-01-01T00:00:00Z'));
      await writeFile(join(dir, mine), 'x');
      await writeFile(join(dir, theirs), 'x');

      const snapshots = await listSnapshots(dir);

      expect(snapshots.find((s) => s.name === mine)?.isThisMachine).toBe(true);
      expect(snapshots.find((s) => s.name === theirs)?.isThisMachine).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('writeSnapshot', () => {
  it('writes a consistent snapshot file named after this host and the current time', async () => {
    await withTestDb(async () => {
      const dir = await scratchDir();
      try {
        const snapshot = await writeSnapshot(dir);

        expect(snapshot.isThisMachine).toBe(true);
        expect(snapshot.host).toBe(thisHost());
        expect(await readdir(dir)).toEqual([snapshot.name]);
        // No leftover staging file: a failed rename would have left a `.partial`.
        expect((await readdir(dir)).some((name) => name.includes('.partial'))).toBe(false);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  });
});

describe('pruneSnapshots', () => {
  it('deletes only what retention no longer wants, per host', async () => {
    const dir = await scratchDir();
    try {
      const names = [
        snapshotFileName('laptop', new Date('2026-01-01T00:00:00Z')),
        snapshotFileName('laptop', new Date('2026-01-02T00:00:00Z')),
        snapshotFileName('laptop', new Date('2026-01-03T00:00:00Z')),
      ];
      await Promise.all(names.map((name) => writeFile(join(dir, name), 'x')));

      const deletedCount = await pruneSnapshots(dir, 2);

      expect(deletedCount).toBe(1);
      expect(await readdir(dir)).toHaveLength(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('returns 0 for a folder that does not exist, rather than throwing', async () => {
    expect(await pruneSnapshots(join(tmpdir(), 'simple-budget-test-nonexistent'), 10)).toBe(0);
  });
});
