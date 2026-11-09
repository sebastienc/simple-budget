import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { withTestDb } from '../../../test/dbFixture';
import { getDb } from './index';
import { accountsQueries, balanceCheckpointsQueries, recurringItemsQueries, wipeAllData } from './queries';
import { recordDeletions, setClockForTests } from './stamps';

// Sync (ADR-0008 in simple-budget-mobile) depends on every write being stamped and every delete leaving a tombstone.
// These tests drive every write path in db/queries.ts, and the last ones fail when a new path is added without the
// same care.

afterEach(() => setClockForTests(null));

const at = (iso: string) => setClockForTests(() => new Date(iso));

const itemInput = (accountId: number, name = 'Rent') => ({
  accountId,
  name,
  amountCents: -1500,
  frequency: 'monthly',
  interval: 1,
  startDate: '2026-01-01',
});

const tombstones = () => getDb().selectFrom('deleted_rows').selectAll().orderBy('table_name').orderBy('uuid').execute();

describe('stamps on writes', () => {
  it('gives a new row a uuid and the clock as its stamp, in whole seconds', async () => {
    await withTestDb(async () => {
      at('2026-11-09T12:00:00.900Z');
      const account = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      const item = await recurringItemsQueries.create(itemInput(account.id));
      const checkpoint = await balanceCheckpointsQueries.upsert(account.id, '2026-11-01', 1000);
      for (const row of [account, item, checkpoint]) {
        expect(row.updated_at).toBe('2026-11-09T12:00:00Z');
        expect(row.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      }
      expect(new Set([account.uuid, item.uuid, checkpoint.uuid]).size).toBe(3);
    });
  });

  it('restamps an account and an item when they are updated, and keeps their uuid', async () => {
    await withTestDb(async () => {
      at('2026-11-09T12:00:00Z');
      const account = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      const item = await recurringItemsQueries.create(itemInput(account.id));
      at('2026-11-09T13:00:00Z');
      const renamed = await accountsQueries.update(account.id, { name: 'Main' });
      const changed = await recurringItemsQueries.update(item.id, { amountCents: -2000 });
      expect(renamed).toMatchObject({ uuid: account.uuid, updated_at: '2026-11-09T13:00:00Z' });
      expect(changed).toMatchObject({ uuid: item.uuid, updated_at: '2026-11-09T13:00:00Z' });
    });
  });

  it('restamps a correction that is set again for the same day, and keeps its uuid', async () => {
    await withTestDb(async () => {
      at('2026-11-09T12:00:00Z');
      const account = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      const first = await balanceCheckpointsQueries.upsert(account.id, '2026-11-01', 1000);
      at('2026-11-09T14:00:00Z');
      const again = await balanceCheckpointsQueries.upsert(account.id, '2026-11-01', 2000);
      expect(again).toMatchObject({ id: first.id, uuid: first.uuid, balance_cents: 2000, updated_at: '2026-11-09T14:00:00Z' });
    });
  });

  it('stamps with the newest stamp in the database when the clock is behind it', async () => {
    await withTestDb(async () => {
      at('2026-11-09T12:00:00Z');
      const account = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      // a row another device edited later than this computer's clock says it is now
      await getDb().updateTable('recurring_items').set({ updated_at: '2026-11-09T18:00:00Z' }).execute();
      const item = await recurringItemsQueries.create(itemInput(account.id));
      await getDb().updateTable('recurring_items').set({ updated_at: '2026-11-09T18:00:00Z' }).where('id', '=', item.id).execute();

      at('2026-11-09T12:30:00Z');
      const renamed = await accountsQueries.update(account.id, { name: 'Main' });
      expect(renamed.updated_at).toBe('2026-11-09T18:00:00Z');
    });
  });

  it('also looks at the stamps of tombstones', async () => {
    await withTestDb(async () => {
      at('2026-11-09T12:00:00Z');
      const account = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      await getDb().insertInto('deleted_rows').values({ table_name: 'accounts', uuid: 'elsewhere', deleted_at: '2026-11-09T20:00:00Z' }).execute();
      expect((await accountsQueries.update(account.id, { name: 'Main' })).updated_at).toBe('2026-11-09T20:00:00Z');
    });
  });

  it('also looks at the stamps of items and corrections', async () => {
    await withTestDb(async () => {
      at('2026-11-09T12:00:00Z');
      const account = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      await recurringItemsQueries.create(itemInput(account.id));
      await balanceCheckpointsQueries.upsert(account.id, '2026-11-01', 1000);
      for (const [table, stamp] of [
        ['recurring_items', '2026-11-09T19:00:00Z'],
        ['balance_checkpoints', '2026-11-09T21:00:00Z'],
      ] as const) {
        await getDb().updateTable(table).set({ updated_at: stamp }).execute();
        at('2026-11-09T12:30:00Z');
        expect((await accountsQueries.update(account.id, { name: stamp })).updated_at).toBe(stamp);
        await getDb().updateTable(table).set({ updated_at: '2026-11-09T12:00:00Z' }).execute();
        await getDb().updateTable('accounts').set({ updated_at: '2026-11-09T12:00:00Z' }).execute();
      }
    });
  });

  it('is not stopped by a stamp in the database that is not a stamp', async () => {
    await withTestDb(async () => {
      at('2026-11-09T12:00:00Z');
      const account = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      await sql`update accounts set updated_at = 'zzz'`.execute(getDb());
      expect((await accountsQueries.update(account.id, { name: 'Main' })).updated_at).toBe('2026-11-09T12:00:00Z');
    });
  });

  it('writes nothing when the update fails', async () => {
    await withTestDb(async () => {
      at('2026-11-09T12:00:00Z');
      await expect(accountsQueries.update(999, { name: 'x' })).rejects.toThrow();
      expect(await accountsQueries.list()).toEqual([]);
    });
  });
});

describe('tombstones on deletes', () => {
  it('records a deleted item at a stamp no earlier than its own', async () => {
    await withTestDb(async () => {
      at('2026-11-09T12:00:00Z');
      const account = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      const item = await recurringItemsQueries.create(itemInput(account.id));
      at('2026-11-09T11:00:00Z'); // a slow clock: the tombstone must still be after the row's own stamp
      await recurringItemsQueries.delete(item.id);
      expect(await tombstones()).toEqual([{ table_name: 'recurring_items', uuid: item.uuid, deleted_at: '2026-11-09T12:00:00Z' }]);
      expect(await recurringItemsQueries.get(item.id)).toBeUndefined();
    });
  });

  it('records a deleted correction', async () => {
    await withTestDb(async () => {
      at('2026-11-09T12:00:00Z');
      const account = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      const checkpoint = await balanceCheckpointsQueries.upsert(account.id, '2026-11-01', 1000);
      at('2026-11-09T13:00:00Z');
      await balanceCheckpointsQueries.delete(checkpoint.id);
      expect(await tombstones()).toEqual([{ table_name: 'balance_checkpoints', uuid: checkpoint.uuid, deleted_at: '2026-11-09T13:00:00Z' }]);
    });
  });

  it('records a deleted account together with each item and correction it took with it, all at the same stamp', async () => {
    await withTestDb(async () => {
      at('2026-11-09T12:00:00Z');
      const account = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      const other = await accountsQueries.create({ name: 'Other', currency: 'CAD' });
      const rent = await recurringItemsQueries.create(itemInput(account.id));
      const phone = await recurringItemsQueries.create(itemInput(account.id, 'Phone'));
      await recurringItemsQueries.create(itemInput(other.id, 'Not mine'));
      const checkpoint = await balanceCheckpointsQueries.upsert(account.id, '2026-11-01', 1000);
      at('2026-11-09T13:00:00Z');

      await accountsQueries.delete(account.id);

      const expected = [
        { table_name: 'accounts', uuid: account.uuid },
        { table_name: 'balance_checkpoints', uuid: checkpoint.uuid },
        { table_name: 'recurring_items', uuid: rent.uuid },
        { table_name: 'recurring_items', uuid: phone.uuid },
      ]
        .map((t) => ({ ...t, deleted_at: '2026-11-09T13:00:00Z' }))
        .sort((a, b) => (a.table_name + a.uuid < b.table_name + b.uuid ? -1 : 1));
      expect(await tombstones()).toEqual(expected);
      expect((await accountsQueries.list()).map((a) => a.id)).toEqual([other.id]);
    });
  });

  it('records every row a wipe removes, and keeps the tombstones of earlier deletions', async () => {
    await withTestDb(async () => {
      at('2026-11-09T12:00:00Z');
      const account = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      const gone = await recurringItemsQueries.create(itemInput(account.id, 'Gone'));
      const kept = await recurringItemsQueries.create(itemInput(account.id, 'Kept'));
      const checkpoint = await balanceCheckpointsQueries.upsert(account.id, '2026-11-01', 1000);
      at('2026-11-09T12:30:00Z');
      await recurringItemsQueries.delete(gone.id);
      at('2026-11-09T13:00:00Z');

      await wipeAllData();

      const all = await tombstones();
      expect(all.map((t) => [t.table_name, t.uuid, t.deleted_at]).sort()).toEqual(
        [
          ['accounts', account.uuid, '2026-11-09T13:00:00Z'],
          ['balance_checkpoints', checkpoint.uuid, '2026-11-09T13:00:00Z'],
          ['recurring_items', kept.uuid, '2026-11-09T13:00:00Z'],
          ['recurring_items', gone.uuid, '2026-11-09T12:30:00Z'],
        ].sort(),
      );
      expect(await accountsQueries.list()).toEqual([]);
    });
  });

  it('moves an existing tombstone to the new stamp instead of failing or keeping the old one', async () => {
    await withTestDb(async () => {
      const record = (stamp: string) =>
        getDb()
          .transaction()
          .execute((trx) => recordDeletions(trx, 'accounts', ['u1'], stamp));
      await record('2026-11-09T10:00:00Z');
      await record('2026-11-09T11:00:00Z');
      expect(await tombstones()).toEqual([{ table_name: 'accounts', uuid: 'u1', deleted_at: '2026-11-09T11:00:00Z' }]);
    });
  });

  it('copes with a wipe of more rows than one statement can carry', async () => {
    await withTestDb(async () => {
      const account = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      await sql`
        with recursive n(i) as (select 1 union all select i + 1 from n where i < 12000)
        insert into recurring_items (account_id, name, amount_cents, frequency, interval, start_date, uuid, updated_at)
        select ${account.id}, 'x', 0, 'monthly', 1, '2026-01-01', 'item-' || i, '2026-11-09T12:00:00Z' from n`.execute(getDb());

      await wipeAllData();

      expect(await tombstones()).toHaveLength(12_001);
      expect(await getDb().selectFrom('recurring_items').select('id').execute()).toEqual([]);
    });
  });

  it('records nothing for a row that is not there', async () => {
    await withTestDb(async () => {
      await accountsQueries.delete(999);
      await recurringItemsQueries.delete(999);
      await balanceCheckpointsQueries.delete(999);
      await wipeAllData();
      expect(await tombstones()).toEqual([]);
    });
  });

  it('removes nothing when the tombstone cannot be written', async () => {
    await withTestDb(async () => {
      const account = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      const item = await recurringItemsQueries.create(itemInput(account.id));
      await balanceCheckpointsQueries.upsert(account.id, '2026-11-01', 1000);
      await sql`drop table deleted_rows`.execute(getDb());

      await expect(recurringItemsQueries.delete(item.id)).rejects.toThrow();
      await expect(accountsQueries.delete(account.id)).rejects.toThrow();
      await expect(wipeAllData()).rejects.toThrow();

      expect(await accountsQueries.list()).toHaveLength(1);
      expect(await recurringItemsQueries.list(account.id)).toHaveLength(1);
      expect(await balanceCheckpointsQueries.list(account.id)).toHaveLength(1);
    });
  });
});

describe('the write paths', () => {
  const root = join(__dirname, '..');
  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sourceFiles(path);
      return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
    });

  it("are only in db/queries.ts (the app's own edits), db/stamps.ts (tombstones), db/syncStore.ts (applying a merge) and db/syncReplace.ts (a restore or import with sync on)", () => {
    const writers = sourceFiles(root)
      .filter((file) => /\.(insertInto|updateTable|deleteFrom)\(|sqlite\.(exec|prepare)\(/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(root, file))
      .sort();
    expect(writers).toEqual(['db/queries.ts', 'db/stamps.ts', 'db/syncReplace.ts', 'db/syncStore.ts']);
  });

  it('are exactly the ones these tests drive: a new one must be added here, with its stamp and tombstone checks', () => {
    expect(Object.keys(accountsQueries).sort()).toEqual(['create', 'delete', 'get', 'list', 'update']);
    expect(Object.keys(recurringItemsQueries).sort()).toEqual(['create', 'delete', 'get', 'list', 'update']);
    expect(Object.keys(balanceCheckpointsQueries).sort()).toEqual(['delete', 'get', 'list', 'upsert']);
  });

  it('set a uuid and a stamp on every insert, a stamp on every update, and leave a tombstone for every delete', () => {
    const source = readFileSync(join(root, 'db', 'queries.ts'), 'utf8');
    const statements = (keyword: string) => source.split(keyword).slice(1);
    for (const insert of statements('.insertInto(')) {
      const statement = insert.slice(0, insert.indexOf('executeTakeFirstOrThrow'));
      expect(statement, 'an insert').toContain('randomUUID()');
      expect(statement, 'an insert').toContain('updated_at');
    }
    for (const update of statements('.updateTable(')) {
      expect(update.slice(0, update.indexOf('executeTakeFirstOrThrow')), 'an update').toContain('updated_at: await nextWriteStamp(trx)');
    }
    // 8 deletes: an item, a correction, the 3 an account takes (items, corrections, itself) and the 3 of the wipe. Each
    // group records its tombstones first: 1 + 1 + 3 + 1 calls (the wipe's is in a loop over the three tables). A new
    // delete changes these numbers, which is the cue to give it a tombstone and a test above.
    expect(statements('.deleteFrom(')).toHaveLength(8);
    expect(source.match(/recordDeletions\(/g)).toHaveLength(1 + 1 + 3 + 1);
  });
});
