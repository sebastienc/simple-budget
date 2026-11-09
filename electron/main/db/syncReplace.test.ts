import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import SqliteDatabase from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration';
import { afterEach, describe, expect, it } from 'vitest';
import { withTestDb } from '../../../test/dbFixture';
import { T0, account } from '../../../test/syncRows';
import { merge } from '../sync/merge';
import type { DeviceState } from '../sync/model';
import { planSync } from '../sync/plan';
import { backupDbTo, getDb, migrations } from './index';
import { accountsQueries, balanceCheckpointsQueries, recurringItemsQueries } from './queries';
import { setClockForTests } from './stamps';
import { syncStore } from './syncStore';
import { replaceDb } from './syncReplace';

afterEach(() => setClockForTests(null));
const at = (iso: string) => setClockForTests(() => new Date(iso));

const item = (accountId: number, name: string) => ({ accountId, name, amountCents: -100, frequency: 'monthly', interval: 1, startDate: '2026-11-01' });

const dump = async () => ({
  accounts: await getDb().selectFrom('accounts').selectAll().orderBy('uuid').execute(),
  items: await getDb().selectFrom('recurring_items').selectAll().orderBy('uuid').execute(),
  corrections: await getDb().selectFrom('balance_checkpoints').selectAll().orderBy('uuid').execute(),
  deleted: await getDb().selectFrom('deleted_rows').selectAll().orderBy('table_name').orderBy('uuid').execute(),
});

const tombstones = async () => (await dump()).deleted.map((d) => [d.table_name, d.uuid, d.deleted_at]);
const uuids = (rows: { uuid: string }[]) => rows.map((r) => r.uuid).sort();

/** Snapshots the database as it is now into a throwaway file, and returns where it is. */
async function snapshot(dir: string, name: string): Promise<string> {
  const path = join(dir, name);
  await backupDbTo(path);
  return path;
}

let dir: string;
async function inTemp(fn: () => Promise<void>) {
  dir = await mkdtemp(join(tmpdir(), 'simple-budget-replace-'));
  try {
    await fn();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('replaceDb with sync on', () => {
  it('restoring an earlier snapshot of this budget: the rows win, what was added since is recorded as deleted, what came back is not', async () => {
    await withTestDb(() =>
      inTemp(async () => {
        at('2026-11-01T10:00:00Z');
        const chequing = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
        const rent = await recurringItemsQueries.create(item(chequing.id, 'Rent'));
        const gym = await recurringItemsQueries.create(item(chequing.id, 'Gym'));
        const correction = await balanceCheckpointsQueries.upsert(chequing.id, '2026-11-01', 5);
        // the snapshot already carries a deletion of its own
        const old = await recurringItemsQueries.create(item(chequing.id, 'Old'));
        at('2026-10-31T00:00:00Z');
        await recurringItemsQueries.delete(old.id);
        at('2026-11-01T10:00:00Z');
        const file = await snapshot(dir, 's1.db');

        at('2026-11-02T10:00:00Z');
        await recurringItemsQueries.delete(rent.id); // this deletion is undone by the restore
        const added = await recurringItemsQueries.create(item(chequing.id, 'Added since')); // this is lost by it
        await accountsQueries.update(chequing.id, { name: 'Renamed since' });
        await getDb().insertInto('deleted_rows').values({ table_name: 'accounts', uuid: 'long-gone', deleted_at: '2026-09-01T00:00:00Z' }).execute();
        const undo = await snapshot(dir, 'undo.db');

        at('2026-11-04T10:00:00Z');
        await replaceDb(file, undo, { keepSyncHistory: true });

        const after = await dump();
        expect(after.accounts.map((a) => [a.uuid, a.name, a.updated_at])).toEqual([[chequing.uuid, 'Chequing', '2026-11-04T10:00:00Z']]);
        expect(uuids(after.items)).toEqual([gym.uuid, rent.uuid].sort());
        expect(after.items.every((i) => i.updated_at === '2026-11-04T10:00:00Z')).toBe(true);
        expect(after.corrections.map((c) => [c.uuid, c.updated_at])).toEqual([[correction.uuid, '2026-11-04T10:00:00Z']]);
        expect(await tombstones()).toEqual(
          [
            ['accounts', 'long-gone', '2026-09-01T00:00:00Z'], // recorded before, kept
            ['recurring_items', added.uuid, '2026-11-04T10:00:00Z'], // taken away by the restore
            ['recurring_items', old.uuid, '2026-11-01T10:00:00Z'], // the file's own, kept (stamped with the newest stamp then, not the slow clock)
            // rent's tombstone is gone: the restore brought rent back
          ].sort(),
        );
      }),
    );
  });

  it('stamps with the newest stamp in the database when the clock is behind it', async () => {
    await withTestDb(() =>
      inTemp(async () => {
        at('2026-11-01T10:00:00Z');
        const chequing = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
        const file = await snapshot(dir, 's.db');
        await getDb().updateTable('accounts').set({ updated_at: '2026-11-20T10:00:00Z' }).execute(); // an edit from a device whose clock is ahead
        const undo = await snapshot(dir, 'undo.db');
        at('2026-11-05T10:00:00Z');

        await replaceDb(file, undo, { keepSyncHistory: true });

        expect((await dump()).accounts.map((a) => [a.uuid, a.updated_at])).toEqual([[chequing.uuid, '2026-11-20T10:00:00Z']]);
      }),
    );
  });

  it('keeps the later of a deletion recorded here and the same deletion in the file', async () => {
    await withTestDb(() =>
      inTemp(async () => {
        at('2026-11-01T10:00:00Z');
        await getDb().insertInto('deleted_rows').values({ table_name: 'accounts', uuid: 'a', deleted_at: '2026-10-05T00:00:00Z' }).execute();
        await getDb().insertInto('deleted_rows').values({ table_name: 'accounts', uuid: 'b', deleted_at: '2026-10-01T00:00:00Z' }).execute();
        const file = await snapshot(dir, 's.db');
        await getDb().deleteFrom('deleted_rows').execute();
        await getDb().insertInto('deleted_rows').values({ table_name: 'accounts', uuid: 'a', deleted_at: '2026-10-01T00:00:00Z' }).execute();
        await getDb().insertInto('deleted_rows').values({ table_name: 'accounts', uuid: 'b', deleted_at: '2026-10-09T00:00:00Z' }).execute();
        const undo = await snapshot(dir, 'undo.db');

        await replaceDb(file, undo, { keepSyncHistory: true });

        expect(await tombstones()).toEqual([
          ['accounts', 'a', '2026-10-05T00:00:00Z'],
          ['accounts', 'b', '2026-10-09T00:00:00Z'],
        ]);
      }),
    );
  });

  it('is not stopped by a recorded deletion whose time is not a time: the one that is a time is kept', async () => {
    await withTestDb(() =>
      inTemp(async () => {
        at('2026-11-01T10:00:00Z');
        await getDb().insertInto('deleted_rows').values({ table_name: 'accounts', uuid: 'a', deleted_at: '2026-10-05T00:00:00Z' }).execute();
        const file = await snapshot(dir, 's.db');
        await getDb().deleteFrom('deleted_rows').execute();
        await getDb().insertInto('deleted_rows').values({ table_name: 'accounts', uuid: 'a', deleted_at: 'not a time' }).execute();
        const undo = await snapshot(dir, 'undo.db');

        await replaceDb(file, undo, { keepSyncHistory: true });

        expect(await tombstones()).toEqual([['accounts', 'a', '2026-10-05T00:00:00Z']]);
      }),
    );
  });

  it('restoring an empty budget records every row as deleted', async () => {
    await withTestDb(() =>
      inTemp(async () => {
        at('2026-11-01T10:00:00Z');
        const file = await snapshot(dir, 'empty.db');
        const chequing = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
        const rent = await recurringItemsQueries.create(item(chequing.id, 'Rent'));
        const correction = await balanceCheckpointsQueries.upsert(chequing.id, '2026-11-01', 5);
        const undo = await snapshot(dir, 'undo.db');
        at('2026-11-02T10:00:00Z');

        await replaceDb(file, undo, { keepSyncHistory: true });

        const after = await dump();
        expect([after.accounts, after.items, after.corrections]).toEqual([[], [], []]);
        expect(await tombstones()).toEqual(
          [
            ['accounts', chequing.uuid, '2026-11-02T10:00:00Z'],
            ['recurring_items', rent.uuid, '2026-11-02T10:00:00Z'],
            ['balance_checkpoints', correction.uuid, '2026-11-02T10:00:00Z'],
          ].sort(),
        );
      }),
    );
  });

  /** A database as the app left it before sync (migrations 001 to 006), with rows, in a file of its own. */
  async function version6Snapshot(path: string): Promise<void> {
    const sqlite = new SqliteDatabase(path);
    const db = new Kysely<unknown>({ dialect: new SqliteDialect({ database: sqlite }) });
    const upToSix: Record<string, Migration> = Object.fromEntries(Object.entries(migrations).filter(([name]) => name < '007'));
    const provider: MigrationProvider = { getMigrations: async () => upToSix };
    const { error } = await new Migrator({ db, provider }).migrateToLatest();
    if (error) throw error;
    sqlite.exec(`
      insert into accounts (id, name, currency, starting_balance_cents, created_at) values (1, 'From an old backup', 'CAD', 100, '2026-03-04 05:06:07');
      insert into recurring_items (id, account_id, name, amount_cents, frequency, interval, start_date, created_at) values (10, 1, 'Old rent', -100, 'monthly', 1, '2026-01-01', '2026-03-04 05:06:08');
    `);
    await db.destroy();
  }

  it('restoring a snapshot from before sync: all the old rows are recorded as deleted and the new ones win, with no first link for the other devices', async () => {
    await withTestDb(() =>
      inTemp(async () => {
        const file = join(dir, 'v6.db');
        await version6Snapshot(file);
        at('2026-11-01T10:00:00Z');
        const chequing = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
        const rent = await recurringItemsQueries.create(item(chequing.id, 'Rent'));
        // the phone has this budget, as the desktop has already merged it
        const phone: DeviceState = { ...(await syncStore.localState('phone')) };
        const undo = await snapshot(dir, 'undo.db');
        at('2026-11-03T10:00:00Z');

        await replaceDb(file, undo, { keepSyncHistory: true });

        const after = await syncStore.localState('desk');
        expect(after.rows.map((r) => r.fields.name)).toEqual(['From an old backup', 'Old rent']);
        expect(after.rows.every((r) => r.updatedAt === '2026-11-03T10:00:00Z')).toBe(true);
        expect(after.rows.map((r) => r.uuid)).not.toContain(chequing.uuid);
        expect(after.tombstones.map((t) => [t.table, t.uuid, t.deletedAt]).sort()).toEqual(
          [
            ['accounts', chequing.uuid, '2026-11-03T10:00:00Z'],
            ['recurring_items', rent.uuid, '2026-11-03T10:00:00Z'],
          ].sort(),
        );
        // what the phone sees: a budget it shares history with (it merges), not a stranger (it would ask)
        const plan = planSync(phone, [
          {
            deviceId: 'desk',
            result: { kind: 'read', file: { header: { deviceId: 'desk', deviceName: 'Desktop', writtenAt: '2026-11-03T10:00:00Z', schema: 1 }, rows: after.rows, tombstones: after.tombstones } },
          },
        ]);
        expect(plan.statuses.map((s) => s.kind)).toEqual(['merged']);
        expect(merge([phone, ...plan.merge]).rows).toEqual(after.rows);
      }),
    );
  });

  it('wins on a device that holds the old state: after it merges, it holds exactly what was restored', async () => {
    await withTestDb(() =>
      inTemp(async () => {
        at('2026-11-01T10:00:00Z');
        const chequing = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
        await recurringItemsQueries.create(item(chequing.id, 'Rent'));
        const file = await snapshot(dir, 's.db');
        at('2026-11-02T10:00:00Z');
        const savings = await accountsQueries.create({ name: 'Savings', currency: 'CAD' });
        await recurringItemsQueries.create(item(savings.id, 'Interest'));
        await accountsQueries.update(chequing.id, { name: 'Edited later' });
        const phoneBefore = await syncStore.localState('phone'); // it has everything that is here now
        const undo = await snapshot(dir, 'undo.db');
        at('2026-11-03T10:00:00Z');

        await replaceDb(file, undo, { keepSyncHistory: true });

        const desk = await syncStore.localState('desk');
        const merged = merge([phoneBefore, desk]);
        expect(merged.rows).toEqual(desk.rows);
        expect(merged.rows.map((r) => r.fields.name)).toEqual(['Chequing', 'Rent']);
        expect(merged.tombstones.map((t) => t.uuid).sort()).toEqual(expect.arrayContaining([savings.uuid]));
      }),
    );
  });

  it('puts the database back, untouched, when what goes with the swap fails', async () => {
    await withTestDb(() =>
      inTemp(async () => {
        at('2026-11-01T10:00:00Z');
        const chequing = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
        const file = await snapshot(dir, 's.db');
        at('2026-11-02T10:00:00Z');
        await recurringItemsQueries.create(item(chequing.id, 'Rent'));
        await recurringItemsQueries.create(item(chequing.id, 'Gym'));
        const undo = await snapshot(dir, 'undo.db');
        const before = await dump();

        await expect(
          replaceDb(file, undo, {
            keepSyncHistory: true,
            apply: async () => {
              throw new Error('disk full');
            },
          }),
        ).rejects.toThrow('disk full');

        expect(await dump()).toEqual(before);
        // and it is a working database
        await accountsQueries.update(chequing.id, { name: 'Still works' });
      }),
    );
  });

  it('puts the database back when the file cannot be opened as a database', async () => {
    await withTestDb(() =>
      inTemp(async () => {
        at('2026-11-01T10:00:00Z');
        await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
        const undo = await snapshot(dir, 'undo.db');
        const before = await dump();
        const garbage = join(dir, 'garbage.db');
        await writeFile(garbage, 'this is not a database, however long it goes on');

        for (const keepSyncHistory of [true, false]) {
          await expect(replaceDb(garbage, undo, { keepSyncHistory })).rejects.toThrow();
          expect(await dump()).toEqual(before);
        }
        await accountsQueries.create({ name: 'Still works', currency: 'CAD' });
      }),
    );
  });
});

describe('replaceDb with sync off', () => {
  it('replaces the rows and nothing else: no new stamps, no deletions recorded', async () => {
    await withTestDb(() =>
      inTemp(async () => {
        at('2026-11-01T10:00:00Z');
        const chequing = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
        const file = await snapshot(dir, 's.db');
        at('2026-11-02T10:00:00Z');
        await recurringItemsQueries.create(item(chequing.id, 'Added since'));
        const undo = await snapshot(dir, 'undo.db');
        at('2026-11-05T10:00:00Z');

        await replaceDb(file, undo, { keepSyncHistory: false });

        const after = await dump();
        expect(after.accounts.map((a) => [a.uuid, a.updated_at])).toEqual([[chequing.uuid, '2026-11-01T10:00:00Z']]);
        expect(after.items).toEqual([]);
        expect(after.deleted).toEqual([]);
      }),
    );
  });
});

describe('a replacement and the stamps after it', () => {
  it('leaves the database ready for the next edit, which is stamped after the replacement', async () => {
    await withTestDb(() =>
      inTemp(async () => {
        at('2026-11-01T10:00:00Z');
        await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
        const file = await snapshot(dir, 's.db');
        const undo = await snapshot(dir, 'undo.db');
        at('2026-11-10T10:00:00Z');
        await replaceDb(file, undo, { keepSyncHistory: true });

        at('2026-11-02T00:00:00Z'); // a clock far behind
        const [row] = await accountsQueries.list();
        expect((await accountsQueries.update(row.id, { name: 'After' })).updated_at).toBe('2026-11-10T10:00:00Z');
      }),
    );
  });

  it('is exercised with rows from another device too', async () => {
    await withTestDb(() =>
      inTemp(async () => {
        at('2026-11-01T10:00:00Z');
        await syncStore.mergeInto('desk', () => [{ deviceId: 'phone', rows: [account('p1', T0, 'From the phone')], tombstones: [] }]);
        const file = await snapshot(dir, 's.db');
        await syncStore.replaceWith({ deviceId: 'x', rows: [], tombstones: [] });
        const undo = await snapshot(dir, 'undo.db');
        at('2026-11-02T10:00:00Z');

        await replaceDb(file, undo, { keepSyncHistory: true });

        expect((await syncStore.localState('desk')).rows.map((r) => [r.uuid, r.updatedAt])).toEqual([['p1', '2026-11-02T10:00:00Z']]);
      }),
    );
  });
});
