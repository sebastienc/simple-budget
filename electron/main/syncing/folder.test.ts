import { chmod, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deviceIdOfSyncFile } from '../sync/file';
import { DirectorySyncFolder } from './folder';

let dir: string;
let folder: DirectorySyncFolder;
const bytes = (text: string) => new TextEncoder().encode(text);
const text = (data: Uint8Array | null) => (data === null ? null : new TextDecoder().decode(data));
const NAME = 'simple-budget-sync-dev-1.json';

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'simple-budget-folder-'));
  folder = new DirectorySyncFolder(dir);
});

afterEach(async () => {
  await chmod(dir, 0o755).catch(() => undefined);
  await rm(dir, { recursive: true, force: true });
});

describe('DirectorySyncFolder', () => {
  it('lists the files in the folder, whatever they are, but not folders', async () => {
    await writeFile(join(dir, NAME), 'x');
    await writeFile(join(dir, 'simple-budget-host-2026-11-01T10-00-00.db'), 'x');
    await writeFile(join(dir, 'notes.txt'), 'x');
    await mkdir(join(dir, 'sub'));
    expect((await folder.list()).sort()).toEqual(['notes.txt', 'simple-budget-host-2026-11-01T10-00-00.db', NAME]);
  });

  it('fails to list a folder that is not there, so the engine can say it is unreachable', async () => {
    await expect(new DirectorySyncFolder(join(dir, 'nope')).list()).rejects.toThrow(/ENOENT/);
  });

  it('reads a file, and says null for one that is not there', async () => {
    await writeFile(join(dir, NAME), 'hello');
    expect(text(await folder.read(NAME, 100))).toBe('hello');
    expect(await folder.read('simple-budget-sync-other.json', 100)).toBeNull();
  });

  it('reads at most the limit, so a huge file is never read into memory', async () => {
    await writeFile(join(dir, NAME), 'abcdefghij');
    expect(text(await folder.read(NAME, 4))).toBe('abcd');
    expect(text(await folder.read(NAME, 10))).toBe('abcdefghij');
    expect(text(await folder.read(NAME, 11))).toBe('abcdefghij');
  });

  it('refuses to read something that is not a file', async () => {
    await mkdir(join(dir, NAME));
    await expect(folder.read(NAME, 10)).rejects.toThrow();
  });

  it('writes a new file', async () => {
    await folder.write(NAME, bytes('one'));
    expect(await readFile(join(dir, NAME), 'utf8')).toBe('one');
  });

  it('replaces a file as a whole and leaves nothing else behind', async () => {
    await folder.write(NAME, bytes('first version, longer than the second'));
    await folder.write(NAME, bytes('second'));
    expect(await readFile(join(dir, NAME), 'utf8')).toBe('second');
    expect(await readdir(dir)).toEqual([NAME]);
  });

  it('leaves the old file and no temporary one when the write fails', async () => {
    await folder.write(NAME, bytes('old'));
    await chmod(dir, 0o555); // nobody can create a file here now
    await expect(folder.write(NAME, bytes('new'))).rejects.toThrow();
    await chmod(dir, 0o755);
    expect(await readFile(join(dir, NAME), 'utf8')).toBe('old');
    expect(await readdir(dir)).toEqual([NAME]);
  });

  it('removes its temporary file when it cannot move it into place', async () => {
    await mkdir(join(dir, NAME)); // a folder where the file should go: the move fails after the temporary file is written
    await expect(folder.write(NAME, bytes('new'))).rejects.toThrow();
    expect(await readdir(dir)).toEqual([NAME]);
  });

  it('names its temporary files so that they are never taken for a sync file', async () => {
    // what a crash between writing and renaming would leave behind
    const temp = `.${NAME}.0b1c2d3e-0000-4000-8000-000000000000.tmp`;
    await writeFile(join(dir, temp), 'half');
    expect(deviceIdOfSyncFile(temp)).toBeNull();
    expect(await folder.list()).toEqual([temp]);
  });

  it.each([
    'notes.txt',
    'simple-budget-host-2026-11-01T10-00-00.db',
    'simple-budget-sync-.json',
    '../simple-budget-sync-dev-1.json',
    'sub/simple-budget-sync-dev-1.json',
    '/etc/simple-budget-sync-dev-1.json',
    '',
  ])('never reads or writes %j, which is not the name of a sync file', async (name) => {
    await expect(folder.read(name, 10)).rejects.toThrow(/not the name of a sync file/);
    await expect(folder.write(name, bytes('x'))).rejects.toThrow(/not the name of a sync file/);
    expect(await readdir(dir)).toEqual([]);
  });

  it('leaves the other files in the folder alone when it writes', async () => {
    await writeFile(join(dir, 'keep.db'), 'snapshot');
    await folder.write(NAME, bytes('x'));
    expect(await readFile(join(dir, 'keep.db'), 'utf8')).toBe('snapshot');
  });
});
