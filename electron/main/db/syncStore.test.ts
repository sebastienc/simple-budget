import { afterEach, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { withTestDb } from '../../../test/dbFixture';
import { getDb } from './index';
import { accountsQueries, balanceCheckpointsQueries, recurringItemsQueries } from './queries';
import { setClockForTests } from './stamps';
import { anyChange, syncStore } from './syncStore';
import { merge } from '../sync/merge';
import type { DeviceState, SyncRow, Tombstone } from '../sync/model';
import { CREATED, T0, account, correction, item, remote, tomb } from '../../../test/syncRows';
import { addSeconds } from '../sync/stamp';

afterEach(() => setClockForTests(null));
const at = (iso: string) => setClockForTests(() => new Date(iso));

const dump = async () => ({
  accounts: await getDb().selectFrom('accounts').selectAll().orderBy('uuid').execute(),
  items: await getDb().selectFrom('recurring_items').selectAll().orderBy('uuid').execute(),
  corrections: await getDb().selectFrom('balance_checkpoints').selectAll().orderBy('uuid').execute(),
  deleted: await getDb().selectFrom('deleted_rows').selectAll().orderBy('table_name').orderBy('uuid').execute(),
});

const TABLE_ORDER = ['accounts', 'recurring_items', 'balance_checkpoints'];
const byTableThenUuid = <T extends { table: string; uuid: string }>(list: T[]) =>
  [...list].sort((a, b) => TABLE_ORDER.indexOf(a.table) - TABLE_ORDER.indexOf(b.table) || (a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0));

describe('syncStore.localState', () => {
  it('reads rows with their parents, keys and fields, and the tombstones', async () => {
    await withTestDb(async () => {
      at('2026-11-09T12:00:00Z');
      const chequing = await accountsQueries.create({ name: 'Chequing', currency: 'USD' });
      await accountsQueries.update(chequing.id, { startingBalanceCents: 12_345, startingBalanceDate: '2026-11-01' });
      const rent = await recurringItemsQueries.create({
        accountId: chequing.id,
        name: 'Rent',
        amountCents: -150_000,
        frequency: 'semimonthly',
        interval: 1,
        startDate: '2026-11-01',
        semiMonthlyDay1: 1,
        semiMonthlyDay2: 15,
        sinkingFund: true,
      });
      const gone = await recurringItemsQueries.create({ accountId: chequing.id, name: 'Gone', amountCents: 1, frequency: 'daily', interval: 1, startDate: '2026-11-01' });
      const checkpoint = await balanceCheckpointsQueries.upsert(chequing.id, '2026-11-05', 99);
      at('2026-11-09T13:00:00Z');
      await recurringItemsQueries.delete(gone.id);

      const state = await syncStore.localState('desk');

      expect(state.deviceId).toBe('desk');
      expect(state.rows.map((r) => [r.table, r.uuid])).toEqual([
        ['accounts', chequing.uuid],
        ['recurring_items', rent.uuid],
        ['balance_checkpoints', checkpoint.uuid],
      ]);
      const [acc, itm, cor] = state.rows;
      expect(acc).toEqual({
        table: 'accounts',
        uuid: chequing.uuid,
        updatedAt: '2026-11-09T12:00:00Z',
        parentUuid: null,
        key: null,
        fields: { name: 'Chequing', currency: 'USD', startingBalanceCents: 12_345, startingBalanceDate: '2026-11-01', createdAt: chequing.created_at },
      });
      expect(itm).toMatchObject({ parentUuid: chequing.uuid, key: null });
      expect(itm.fields).toEqual({
        name: 'Rent',
        amountCents: -150_000,
        frequency: 'semimonthly',
        interval: 1,
        startDate: '2026-11-01',
        endDate: null,
        semiMonthlyDay1: 1,
        semiMonthlyDay2: 15,
        sinkingFund: true,
        createdAt: rent.created_at,
      });
      expect(cor).toMatchObject({ parentUuid: chequing.uuid, key: '2026-11-05', fields: { date: '2026-11-05', balanceCents: 99, createdAt: checkpoint.created_at } });
      expect(state.tombstones).toEqual([tomb('recurring_items', gone.uuid, '2026-11-09T13:00:00Z')]);
    });
  });

  it('reads an empty database as an empty state', async () => {
    await withTestDb(async () => {
      expect(await syncStore.localState('desk')).toEqual({ deviceId: 'desk', rows: [], tombstones: [] });
    });
  });

  it('refuses a time in the database that is not a time, rather than guess', async () => {
    await withTestDb(async () => {
      await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      await sql`update accounts set updated_at = 'zzz'`.execute(getDb());
      await expect(syncStore.localState('desk')).rejects.toThrow(/not a time/);
    });
  });
});

describe('syncStore.mergeInto', () => {
  it('changes nothing when there is nothing to merge in', async () => {
    await withTestDb(async () => {
      const chequing = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      await recurringItemsQueries.create({ accountId: chequing.id, name: 'Rent', amountCents: -1, frequency: 'monthly', interval: 1, startDate: '2026-11-01' });
      await balanceCheckpointsQueries.upsert(chequing.id, '2026-11-02', 5);
      const before = await dump();

      const outcome = await syncStore.mergeInto('desk', () => []);

      expect(outcome.changes).toEqual({ added: 0, updated: 0, removed: 0, tombstones: 0 });
      expect(anyChange(outcome.changes)).toBe(false);
      expect(await dump()).toEqual(before);
    });
  });

  it('adds what another device has, with its uuids, stamps and fields, and wires the keys', async () => {
    await withTestDb(async () => {
      const phone = remote('phone', [
        account('a1', '2026-11-05T10:00:00Z', 'Phone account', { startingBalanceDate: null }),
        item('i1', 'a1', '2026-11-05T10:00:01Z', 'Gym', { sinkingFund: true, endDate: '2027-01-01', semiMonthlyDay1: 3, semiMonthlyDay2: 18 }),
        correction('c1', 'a1', '2026-11-04', '2026-11-05T10:00:02Z', 777),
      ]);

      const outcome = await syncStore.mergeInto('desk', () => [phone]);

      expect(outcome.changes).toEqual({ added: 3, updated: 0, removed: 0, tombstones: 0 });
      const { accounts, items, corrections } = await dump();
      expect(accounts).toEqual([
        expect.objectContaining({
          uuid: 'a1',
          name: 'Phone account',
          currency: 'CAD',
          starting_balance_cents: 1000,
          starting_balance_date: null,
          created_at: CREATED,
          updated_at: '2026-11-05T10:00:00Z',
        }),
      ]);
      expect(items).toEqual([
        expect.objectContaining({
          uuid: 'i1',
          account_id: accounts[0].id,
          name: 'Gym',
          amount_cents: -1500,
          frequency: 'monthly',
          interval: 1,
          start_date: '2026-11-01',
          end_date: '2027-01-01',
          semi_monthly_day1: 3,
          semi_monthly_day2: 18,
          sinking_fund: 1,
          created_at: CREATED,
          updated_at: '2026-11-05T10:00:01Z',
        }),
      ]);
      expect(corrections).toEqual([expect.objectContaining({ uuid: 'c1', account_id: accounts[0].id, date: '2026-11-04', balance_cents: 777, updated_at: '2026-11-05T10:00:02Z' })]);
      // the app's own queries see them
      expect(await recurringItemsQueries.list(accounts[0].id)).toHaveLength(1);
      expect(await balanceCheckpointsQueries.list(accounts[0].id)).toHaveLength(1);
    });
  });

  it("takes a newer version, keeping the id and the other side's stamp, and ignores an older one", async () => {
    await withTestDb(async () => {
      await syncStore.mergeInto('desk', () => [remote('phone', [account('a1', T0, 'Old'), item('i1', 'a1', T0, 'Rent')])]);
      const before = await dump();

      const newer = await syncStore.mergeInto('desk', () => [remote('phone', [account('a1', '2026-11-02T10:00:00Z', 'New'), item('i1', 'a1', T0, 'Rent')])]);
      expect(newer.changes).toEqual({ added: 0, updated: 1, removed: 0, tombstones: 0 });
      const afterNewer = await dump();
      expect(afterNewer.accounts[0]).toMatchObject({ id: before.accounts[0].id, name: 'New', updated_at: '2026-11-02T10:00:00Z' });

      const older = await syncStore.mergeInto('desk', () => [remote('phone', [account('a1', '2026-11-01T11:00:00Z', 'Older')])]);
      expect(older.changes).toEqual({ added: 0, updated: 0, removed: 0, tombstones: 0 });
      expect(await dump()).toEqual(afterNewer);
    });
  });

  it('takes a changed parent account for an item as well as changed fields', async () => {
    await withTestDb(async () => {
      await syncStore.mergeInto('desk', () => [remote('phone', [account('a1'), account('a2'), item('i1', 'a1', T0)])]);
      await syncStore.mergeInto('desk', () => [remote('phone', [account('a1'), account('a2'), item('i1', 'a2', '2026-11-02T10:00:00Z')])]);
      const { accounts, items } = await dump();
      expect(items[0].account_id).toBe(accounts.find((a) => a.uuid === 'a2')!.id);
    });
  });

  it('removes what another device deleted later, and the items and corrections of a deleted account, writing only the merged tombstones', async () => {
    await withTestDb(async () => {
      await syncStore.mergeInto('desk', () => [remote('phone', [account('a1'), item('i1', 'a1'), item('i2', 'a1'), correction('c1', 'a1', '2026-11-04'), account('a2'), item('i3', 'a2')])]);

      const outcome = await syncStore.mergeInto('desk', () => [
        remote('phone', [account('a1'), account('a2'), item('i3', 'a2')], [tomb('recurring_items', 'i1', '2026-11-03T10:00:00Z'), tomb('accounts', 'a1', '2026-11-03T10:00:00Z')]),
      ]);

      expect(outcome.changes).toMatchObject({ added: 0, removed: 4 });
      const { accounts, items, corrections, deleted } = await dump();
      expect(accounts.map((a) => a.uuid)).toEqual(['a2']);
      expect(items.map((i) => i.uuid)).toEqual(['i3']);
      expect(corrections).toEqual([]);
      // i2 and c1 went with their account without a record of their own: every device drops them by itself
      expect(deleted.map((d) => [d.table_name, d.uuid, d.deleted_at])).toEqual([
        ['accounts', 'a1', '2026-11-03T10:00:00Z'],
        ['recurring_items', 'i1', '2026-11-03T10:00:00Z'],
      ]);
    });
  });

  it('keeps a local row that was edited after another device deleted it', async () => {
    await withTestDb(async () => {
      await syncStore.mergeInto('desk', () => [remote('phone', [account('a1', '2026-11-05T10:00:00Z')])]);
      const outcome = await syncStore.mergeInto('desk', () => [remote('phone', [], [tomb('accounts', 'a1', '2026-11-04T10:00:00Z')])]);
      expect(outcome.changes).toEqual({ added: 0, updated: 0, removed: 0, tombstones: 0 });
      expect((await dump()).accounts).toHaveLength(1);
    });
  });

  it('drops a tombstone that a newer edit overrides', async () => {
    await withTestDb(async () => {
      await getDb().insertInto('deleted_rows').values({ table_name: 'accounts', uuid: 'a1', deleted_at: '2026-11-03T10:00:00Z' }).execute();

      const outcome = await syncStore.mergeInto('desk', () => [remote('phone', [account('a1', '2026-11-04T10:00:00Z')])]);

      expect(outcome.changes).toEqual({ added: 1, updated: 0, removed: 0, tombstones: 1 });
      expect((await dump()).deleted).toEqual([]);
    });
  });

  it('keeps one correction per account and day: the later one wins and the other leaves a tombstone at its own stamp', async () => {
    await withTestDb(async () => {
      await syncStore.mergeInto('desk', () => [remote('phone', [account('a1'), correction('c-local', 'a1', '2026-11-04', '2026-11-02T10:00:00Z', 100)])]);

      const outcome = await syncStore.mergeInto('desk', () => [remote('phone', [account('a1'), correction('c-remote', 'a1', '2026-11-04', '2026-11-03T10:00:00Z', 200)])]);

      expect(outcome.changes).toEqual({ added: 1, updated: 0, removed: 1, tombstones: 1 });
      const { corrections, deleted } = await dump();
      expect(corrections.map((c) => [c.uuid, c.balance_cents])).toEqual([['c-remote', 200]]);
      expect(deleted).toEqual([{ table_name: 'balance_checkpoints', uuid: 'c-local', deleted_at: '2026-11-02T10:00:00Z' }]);
    });
  });

  it('does it again with nothing new: no change', async () => {
    await withTestDb(async () => {
      const phone = remote('phone', [account('a1'), item('i1', 'a1'), correction('c1', 'a1', '2026-11-04')], [tomb('recurring_items', 'old', '2026-10-01T00:00:00Z')]);
      const first = await syncStore.mergeInto('desk', () => [phone]);
      expect(anyChange(first.changes)).toBe(true);
      const after = await dump();
      const second = await syncStore.mergeInto('desk', () => [phone]);
      expect(second.changes).toEqual({ added: 0, updated: 0, removed: 0, tombstones: 0 });
      expect(await dump()).toEqual(after);
    });
  });

  it("hands choose the state it read, and reports it as 'before'", async () => {
    await withTestDb(async () => {
      const chequing = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      let seen: DeviceState | undefined;
      const outcome = await syncStore.mergeInto('desk', (local) => {
        seen = local;
        return [];
      });
      expect(seen?.rows.map((r) => r.uuid)).toEqual([chequing.uuid]);
      expect(outcome.before).toEqual(seen);
      expect(outcome.merged.rows.map((r) => r.uuid)).toEqual([chequing.uuid]);
    });
  });

  it('copes with more tombstones than one statement can carry, coming and going', async () => {
    await withTestDb(async () => {
      const many = Array.from({ length: 12_000 }, (_, i) => tomb('recurring_items', `old-${i}`, '2026-10-01T00:00:00Z'));
      const added = await syncStore.mergeInto('desk', () => [remote('phone', [], many)]);
      expect(added.changes.tombstones).toBe(12_000);
      expect((await dump()).deleted).toHaveLength(12_000);

      const dropped = await syncStore.replaceWith(remote('x', []));
      expect(dropped.tombstones).toBe(12_000);
      expect((await dump()).deleted).toEqual([]);
    });
  });

  it('refuses to read a row whose account is not there, rather than invent a parent', async () => {
    await withTestDb(async () => {
      const chequing = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      await recurringItemsQueries.create({ accountId: chequing.id, name: 'Rent', amountCents: 1, frequency: 'daily', interval: 1, startDate: '2026-11-01' });
      // the database enforces its keys, so a row like this only exists if something bypassed them
      await sql`pragma foreign_keys = off`.execute(getDb());
      try {
        await sql`update recurring_items set account_id = 999`.execute(getDb());
        await expect(syncStore.localState('desk')).rejects.toThrow(/does not exist/);
      } finally {
        await sql`pragma foreign_keys = on`.execute(getDb());
      }
    });
  });

  it('writes nothing when anything goes wrong part way', async () => {
    await withTestDb(async () => {
      await syncStore.mergeInto('desk', () => [remote('phone', [account('a1'), item('i1', 'a1'), item('i2', 'a1', T0, 'Other')])]);
      const before = await dump();

      // i1 is removed first, then a2 is added, then i9 has a field the database cannot take
      const broken = item('i9', 'a2', T0, 'Broken', { amountCents: 1.5 });
      await expect(
        syncStore.mergeInto('desk', () => [remote('phone', [account('a1'), account('a2'), broken, item('i2', 'a1', T0, 'Other')], [tomb('recurring_items', 'i1', '2026-11-03T10:00:00Z')])]),
      ).rejects.toThrow(/whole number/);

      expect(await dump()).toEqual(before);
    });
  });

  it('writes nothing when choose throws', async () => {
    await withTestDb(async () => {
      await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      const before = await dump();
      await expect(
        syncStore.mergeInto('desk', () => {
          throw new Error('no');
        }),
      ).rejects.toThrow('no');
      expect(await dump()).toEqual(before);
    });
  });

  it('leaves the database sound for the app afterwards: keys intact, and the next write is stamped after everything merged in', async () => {
    await withTestDb(async () => {
      await syncStore.mergeInto('desk', () => [remote('phone', [account('a1', '2026-11-20T10:00:00Z'), item('i1', 'a1', '2026-11-20T10:00:00Z')])]);
      expect(((await sql`pragma foreign_key_check`.execute(getDb())).rows as unknown[]).length).toBe(0);

      at('2026-11-09T12:00:00Z'); // this computer's clock is well behind the phone's edits
      const [a] = await accountsQueries.list();
      const renamed = await accountsQueries.update(a.id, { name: 'Renamed' });
      expect(renamed.updated_at).toBe('2026-11-20T10:00:00Z');
      const created = await recurringItemsQueries.create({ accountId: a.id, name: 'New', amountCents: 1, frequency: 'daily', interval: 1, startDate: '2026-11-01' });
      expect(created.updated_at).toBe('2026-11-20T10:00:00Z');
    });
  });

  it("takes the other device's created_at too, so devices that merge end up identical", async () => {
    await withTestDb(async () => {
      await syncStore.mergeInto('desk', () => [remote('phone', [account('a1', T0)])]);
      const changed = account('a1', '2026-11-02T10:00:00Z', 'Chequing', { createdAt: '2026-10-01 00:00:00' });
      await syncStore.mergeInto('desk', () => [remote('phone', [changed])]);
      expect((await dump()).accounts[0].created_at).toBe('2026-10-01 00:00:00');
    });
  });
});

describe('syncStore.replaceWith', () => {
  it('makes the database hold exactly the given state: what it lacks is deleted, and its tombstones replace the old ones', async () => {
    await withTestDb(async () => {
      const mine = await accountsQueries.create({ name: 'Mine', currency: 'CAD' });
      await recurringItemsQueries.create({ accountId: mine.id, name: 'Mine too', amountCents: 1, frequency: 'daily', interval: 1, startDate: '2026-11-01' });
      const gone = await recurringItemsQueries.create({ accountId: mine.id, name: 'Gone', amountCents: 1, frequency: 'daily', interval: 1, startDate: '2026-11-01' });
      await recurringItemsQueries.delete(gone.id);

      const changes = await syncStore.replaceWith(remote('phone', [account('p1', T0, 'Theirs'), item('p2', 'p1')], [tomb('balance_checkpoints', 'p9', '2026-10-01T00:00:00Z')]));

      expect(changes).toEqual({ added: 2, updated: 0, removed: 3 - 1, tombstones: 2 });
      const { accounts, items, deleted } = await dump();
      expect(accounts.map((a) => a.uuid)).toEqual(['p1']);
      expect(items.map((i) => i.uuid)).toEqual(['p2']);
      expect(deleted).toEqual([{ table_name: 'balance_checkpoints', uuid: 'p9', deleted_at: '2026-10-01T00:00:00Z' }]);
    });
  });

  it('empties the database for an empty state', async () => {
    await withTestDb(async () => {
      const mine = await accountsQueries.create({ name: 'Mine', currency: 'CAD' });
      await balanceCheckpointsQueries.upsert(mine.id, '2026-11-01', 1);
      await syncStore.replaceWith(remote('x', []));
      expect(await dump()).toEqual({ accounts: [], items: [], corrections: [], deleted: [] });
    });
  });

  it('writes nothing when it fails part way', async () => {
    await withTestDb(async () => {
      await accountsQueries.create({ name: 'Mine', currency: 'CAD' });
      const before = await dump();
      await expect(syncStore.replaceWith(remote('x', [account('p1'), item('p2', 'p1', T0, 'Broken', { interval: 'x' })]))).rejects.toThrow(/whole number/);
      expect(await dump()).toEqual(before);
    });
  });
});

describe('the store against the pure merge', () => {
  // Applying a merge to the real database must give exactly the state the pure merge computes (the golden-tested
  // part), for any local state and any other devices, and leave the database's keys intact.
  function random(seed: number) {
    let state = seed >>> 0;
    const next = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return { below: (n: number) => Math.floor(next() * n), chance: (p: number) => next() * 100 < p };
  }
  const ACCOUNTS = ['a1', 'a2', 'a3'];
  const ITEMS: [string, string][] = [
    ['i1', 'a1'],
    ['i2', 'a1'],
    ['i3', 'a2'],
    ['i4', 'a3'],
  ];
  const CORRECTIONS: [string, string, string][] = [
    ['c1', 'a1', '2026-11-01'],
    ['c2', 'a1', '2026-11-01'],
    ['c3', 'a2', '2026-11-01'],
    ['c4', 'a3', '2026-11-02'],
  ];

  function world(rng: ReturnType<typeof random>, deviceId: string): DeviceState {
    const stamp = () => addSeconds(T0, rng.below(6) * 3600);
    const rows: SyncRow[] = [];
    const tombstones: Tombstone[] = [];
    const place = (table: Tombstone['table'], uuid: string, row: () => SyncRow) => {
      if (rng.chance(35)) return;
      if (rng.chance(25)) tombstones.push(tomb(table, uuid, stamp()));
      else rows.push(row());
    };
    for (const uuid of ACCOUNTS) place('accounts', uuid, () => account(uuid, stamp(), ['x', 'y', 'z'][rng.below(3)]));
    for (const [uuid, parent] of ITEMS)
      place('recurring_items', uuid, () => item(uuid, parent, stamp(), 'n', { amountCents: rng.below(6) - 3, sinkingFund: rng.chance(50), semiMonthlyDay1: rng.chance(50) ? null : 4 }));
    for (const [uuid, parent, day] of CORRECTIONS) place('balance_checkpoints', uuid, () => correction(uuid, parent, day, stamp(), rng.below(3)));
    return { deviceId, rows, tombstones };
  }

  it('gives exactly the merged state, for 150 random local states and other devices', async () => {
    await withTestDb(async () => {
      const rng = random(20261109);
      for (let round = 0; round < 150; round++) {
        await syncStore.replaceWith(world(rng, 'seed'));
        const others = [world(rng, 'B'), world(rng, 'C')];

        const outcome = await syncStore.mergeInto('A', () => others);

        const expected = merge([...others, outcome.before]);
        const after = await syncStore.localState('A');
        expect({ rows: byTableThenUuid(after.rows), tombstones: byTableThenUuid(after.tombstones) }, `round ${round}`).toEqual(expected);
        expect(outcome.merged, `round ${round}`).toEqual(expected);
        expect(((await sql`pragma foreign_key_check`.execute(getDb())).rows as unknown[]).length).toBe(0);
        // and merging that again, with the same others, changes nothing
        // Merging the same others again is not always a no-op: a row the merge dropped as an orphan leaves no tombstone
        // of its own, so a tombstone another device still holds for it comes back the next time (it is true history).
        // It settles after that, and every round must still equal the pure merge.
        let changed = true;
        for (let again = 1; again <= 3 && changed; again++) {
          const next = await syncStore.mergeInto('A', () => others);
          const want = merge([...others, next.before]);
          const now = await syncStore.localState('A');
          expect({ rows: byTableThenUuid(now.rows), tombstones: byTableThenUuid(now.tombstones) }, `round ${round} again ${again}`).toEqual(want);
          changed = anyChange(next.changes);
        }
        expect(changed, `round ${round} settles`).toBe(false);
      }
    });
  });
});
