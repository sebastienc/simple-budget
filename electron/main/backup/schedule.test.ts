import { mkdtemp, readdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { withTestDb } from '../../../test/dbFixture';
import { writeBackupSettings } from './settings';
import { maybeSnapshot, snapshotNow, startBackupSchedule, stopBackupSchedule } from './schedule';

async function scratchDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'simple-budget-test-'));
}

describe('snapshotNow', () => {
  it('does nothing when no backup folder is configured', async () => {
    await withTestDb(async () => {
      expect(await snapshotNow()).toBeNull();
    });
  });

  it('writes a snapshot and applies retention', async () => {
    await withTestDb(async () => {
      const dir = await scratchDir();
      try {
        await writeBackupSettings({ folder: dir, keep: 10 });
        const snapshot = await snapshotNow();

        expect(snapshot).not.toBeNull();
        expect(await readdir(dir)).toEqual([snapshot!.name]);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  });
});

describe('maybeSnapshot', () => {
  it('does nothing when no backup folder is configured', async () => {
    await withTestDb(async () => {
      expect(await maybeSnapshot()).toBeNull();
    });
  });

  it('skips when this machine\'s newest snapshot is younger than the minimum age, and takes one once it is stale', async () => {
    await withTestDb(async () => {
      const dir = await scratchDir();
      try {
        await writeBackupSettings({ folder: dir, keep: 10 });

        // Fake only Date — faking setTimeout/queueMicrotask too would stall the
        // real fs.promises calls this test still needs to complete.
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
        const first = await maybeSnapshot(1000); // no snapshot yet — always takes one
        expect(first).not.toBeNull();

        vi.setSystemTime(new Date('2026-01-01T00:00:00.500Z')); // 500ms later
        expect(await maybeSnapshot(1000)).toBeNull(); // younger than the 1000ms minimum

        vi.setSystemTime(new Date('2026-01-01T00:00:02Z')); // 2s later
        const second = await maybeSnapshot(1000); // older than the minimum
        expect(second).not.toBeNull();
        expect(second!.name).not.toBe(first!.name);

        vi.useRealTimers();
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  });
});

describe('startBackupSchedule / attempt', () => {
  it('never throws or leaves an unhandled rejection when the underlying snapshot fails', async () => {
    await withTestDb(async () => {
      // A file, not a directory — writeSnapshot's mkdir(folder, {recursive:true}) fails on it.
      const dir = await scratchDir();
      const notADirectory = join(dir, 'not-a-directory');
      await writeFile(notADirectory, 'x');
      try {
        await writeBackupSettings({ folder: notADirectory, keep: 10 });
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => startBackupSchedule()).not.toThrow();
        await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled());

        stopBackupSchedule();
        errorSpy.mockRestore();
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  });

  it('stopBackupSchedule is safe to call when no schedule is running', () => {
    stopBackupSchedule();
    expect(() => stopBackupSchedule()).not.toThrow();
  });
});
