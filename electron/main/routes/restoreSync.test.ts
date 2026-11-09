import { mkdtemp, readFile, rm, stat, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import request from 'supertest';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { withTestApp } from '../../../test/dbFixture';
import { writeBackupSettings } from '../backup/settings';
import { writeSnapshot } from '../backup/snapshots';
import { dbPath, getDb } from '../db';
import { accountsQueries, recurringItemsQueries } from '../db/queries';
import { setClockForTests } from '../db/stamps';
import { getSyncCoordinator } from '../syncing';
import { onBudgetChanged } from '../syncing/changes';
import { updateSyncSettings } from '../syncing/settings';

// Restoring a snapshot and importing a file replace the whole budget. With sync on they must win on every device, and they
// always leave a copy of what they replaced.

const heard = vi.fn();
const stop = onBudgetChanged(heard);
afterAll(stop);

afterEach(() => {
  setClockForTests(null);
  heard.mockClear();
  vi.restoreAllMocks();
});

const at = (iso: string) => setClockForTests(() => new Date(iso));
const rent = (accountId: number, name: string) => ({ accountId, name, amountCents: -100, frequency: 'monthly', interval: 1, startDate: '2026-11-01' });
const stamps = async () => (await getDb().selectFrom('accounts').select(['name', 'updated_at']).execute()).map((a) => [a.name, a.updated_at]);
const tombstones = async () => (await getDb().selectFrom('deleted_rows').selectAll().execute()).map((d) => [d.table_name, d.deleted_at]);

/** A budget with one account and a snapshot of it in a backup folder; then an item is added, which a restore will lose. */
async function setUp(syncOn: boolean) {
  const folder = await mkdtemp(join(tmpdir(), 'simple-budget-restore-'));
  await writeBackupSettings({ folder, keep: 10 });
  at('2026-11-01T10:00:00Z');
  const chequing = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
  const snapshot = await writeSnapshot(folder);
  at('2026-11-02T10:00:00Z');
  const added = await recurringItemsQueries.create(rent(chequing.id, 'Added since'));
  if (syncOn) await updateSyncSettings(() => ({ enabled: true }));
  at('2026-11-05T10:00:00Z');
  return { folder, snapshot, chequing, added, clean: () => rm(folder, { recursive: true, force: true }) };
}

describe('POST /api/backup/restore', () => {
  it('with sync on, the snapshot wins on every device: its rows are stamped now, what was added since is recorded as deleted', async () => {
    await withTestApp(async (app) => {
      const { snapshot, added, clean } = await setUp(true);
      const idle = vi.spyOn(getSyncCoordinator(), 'whileSyncIsIdle');

      const res = await request(app).post('/api/backup/restore').send({ name: snapshot.name });

      expect(res.status).toBe(200);
      expect(await stamps()).toEqual([['Chequing', '2026-11-05T10:00:00Z']]);
      expect(await getDb().selectFrom('deleted_rows').select(['table_name', 'uuid', 'deleted_at']).execute()).toEqual([
        { table_name: 'recurring_items', uuid: added.uuid, deleted_at: '2026-11-05T10:00:00Z' },
      ]);
      expect(idle).toHaveBeenCalledTimes(1); // no sync runs while the database is swapped
      expect(heard).toHaveBeenCalledTimes(1); // and sync is told the budget changed, so the other devices follow soon
      await clean();
    });
  });

  it('with sync off, it replaces the rows and nothing more', async () => {
    await withTestApp(async (app) => {
      const { snapshot, clean } = await setUp(false);
      const idle = vi.spyOn(getSyncCoordinator(), 'whileSyncIsIdle');

      const res = await request(app).post('/api/backup/restore').send({ name: snapshot.name });

      expect(res.status).toBe(200);
      expect(await stamps()).toEqual([['Chequing', '2026-11-01T10:00:00Z']]);
      expect(await tombstones()).toEqual([]);
      expect(idle).not.toHaveBeenCalled();
      await clean();
    });
  });

  it('leaves a copy of what it replaced, and says where', async () => {
    await withTestApp(async (app) => {
      const { snapshot, clean } = await setUp(true);
      const res = await request(app).post('/api/backup/restore').send({ name: snapshot.name });
      expect(res.body.backupPath).toContain('before-restore');
      expect((await stat(res.body.backupPath)).size).toBeGreaterThan(0);
      await clean();
    });
  });
});

describe('POST /api/backup/import', () => {
  const importFile = (app: Parameters<typeof request>[0], bytes: Buffer) => request(app).post('/api/backup/import').set('Content-Type', 'application/octet-stream').send(bytes);

  it('with sync on, the file wins on every device', async () => {
    await withTestApp(async (app) => {
      const { snapshot, added, clean } = await setUp(true);

      const res = await importFile(app, await readFile(snapshot.path));

      expect(res.status).toBe(200);
      expect(await stamps()).toEqual([['Chequing', '2026-11-05T10:00:00Z']]);
      expect(await getDb().selectFrom('deleted_rows').select(['uuid', 'deleted_at']).execute()).toEqual([{ uuid: added.uuid, deleted_at: '2026-11-05T10:00:00Z' }]);
      expect(heard).toHaveBeenCalledTimes(1);
      await clean();
    });
  });

  it('with sync off, it replaces the rows and nothing more', async () => {
    await withTestApp(async (app) => {
      const { snapshot, clean } = await setUp(false);
      await importFile(app, await readFile(snapshot.path)).expect(200);
      expect(await stamps()).toEqual([['Chequing', '2026-11-01T10:00:00Z']]);
      expect(await tombstones()).toEqual([]);
      await clean();
    });
  });

  it('first saves a copy of what it replaces, as a restore and a wipe do', async () => {
    await withTestApp(async (app) => {
      const { snapshot, clean } = await setUp(false);
      const res = await importFile(app, await readFile(snapshot.path));
      expect(res.body.backupPath).toContain('before-import');
      const copy = await readFile(res.body.backupPath);
      expect(copy.subarray(0, 15).toString()).toBe('SQLite format 3');
      await clean();
    });
  });

  it('replaces nothing when the copy cannot be saved', async () => {
    await withTestApp(async (app) => {
      const { snapshot, clean } = await setUp(true);
      const before = await stamps();
      await writeFile(join(dirname(dbPath()), 'backups'), 'a file where the folder for copies should be');

      const res = await importFile(app, await readFile(snapshot.path));

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'backup_failed' });
      expect(await stamps()).toEqual(before);
      expect(await getDb().selectFrom('recurring_items').select('name').execute()).toEqual([{ name: 'Added since' }]);
      expect(heard).not.toHaveBeenCalled();
      await clean();
    });
  });

  it.each([
    ['something that is not a database', Buffer.from('definitely not sqlite, just some text that is long enough')],
    ["an SQLite file that is not this app's", null],
  ])('refuses %s and changes nothing', async (_name, bytes) => {
    await withTestApp(async (app) => {
      const { clean } = await setUp(true);
      const before = await stamps();
      let body = bytes;
      if (body === null) {
        const { default: Sqlite } = await import('better-sqlite3');
        const path = join(await mkdtemp(join(tmpdir(), 'simple-budget-other-')), 'other.db');
        const other = new Sqlite(path);
        other.exec('create table something_else (id integer)');
        other.close();
        body = await readFile(path);
      }

      const res = await importFile(app, body);

      expect(res.status).toBe(400);
      expect(await stamps()).toEqual(before);
      expect(heard).not.toHaveBeenCalled();
      await clean();
    });
  });
});
