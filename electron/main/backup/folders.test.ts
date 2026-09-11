import { mkdtemp, rm, writeFile } from 'fs/promises';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { describeCloudStorageEntry, isWritableDirectory, linuxCandidates, windowsCandidates } from './folders';

describe('describeCloudStorageEntry', () => {
  it('points Google Drive at "My Drive", not the mount point itself', () => {
    const result = describeCloudStorageEntry('GoogleDrive-someone@example.com');
    expect(result).toEqual({
      path: expect.stringMatching(/GoogleDrive-someone@example\.com[/\\]My Drive$/),
      label: 'Google Drive (someone@example.com)',
      provider: 'google-drive',
    });
  });

  it('names the account when the entry has one, and omits it otherwise', () => {
    expect(describeCloudStorageEntry('Dropbox-someone@example.com')?.label).toBe('Dropbox (someone@example.com)');
    expect(describeCloudStorageEntry('Dropbox')?.label).toBe('Dropbox');
  });

  it('recognizes OneDrive', () => {
    expect(describeCloudStorageEntry('OneDrive-someone@example.com')).toMatchObject({ provider: 'onedrive' });
  });

  it('does not append an account name to iCloud Drive, which mounts without one', () => {
    expect(describeCloudStorageEntry('iCloudDrive')?.label).toBe('iCloud Drive');
  });

  it('returns null for an entry that matches no known provider', () => {
    expect(describeCloudStorageEntry('SomeRandomFolder')).toBeNull();
  });
});

describe('windowsCandidates', () => {
  it('includes the OneDrive env var path only when it is set', () => {
    const original = process.env.OneDrive;
    delete process.env.OneDrive;
    expect(windowsCandidates().some((c) => c.provider === 'onedrive')).toBe(false);

    process.env.OneDrive = 'C:\\Users\\someone\\OneDrive';
    expect(windowsCandidates().find((c) => c.provider === 'onedrive')).toEqual({ path: 'C:\\Users\\someone\\OneDrive', label: 'OneDrive', provider: 'onedrive' });

    if (original === undefined) {
      delete process.env.OneDrive;
    } else {
      process.env.OneDrive = original;
    }
  });

  it('always offers the Google Drive "Mirror files" and Dropbox default locations', () => {
    const paths = windowsCandidates().map((c) => c.path);
    expect(paths).toContain(join(homedir(), 'Google Drive', 'My Drive'));
    expect(paths).toContain(join(homedir(), 'Dropbox'));
  });
});

describe('linuxCandidates', () => {
  it('offers Dropbox and Insync default locations', () => {
    const paths = linuxCandidates().map((c) => c.path);
    expect(paths).toEqual([join(homedir(), 'Dropbox'), join(homedir(), 'Insync')]);
  });
});

describe('isWritableDirectory', () => {
  it('is true for a real, writable directory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'simple-budget-test-'));
    try {
      expect(await isWritableDirectory(dir)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('is false for a path that does not exist', async () => {
    expect(await isWritableDirectory(join(tmpdir(), 'simple-budget-test-nonexistent'))).toBe(false);
  });

  it('is false for a file, not a directory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'simple-budget-test-'));
    const filePath = join(dir, 'not-a-directory.txt');
    await writeFile(filePath, 'x');
    try {
      expect(await isWritableDirectory(filePath)).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
