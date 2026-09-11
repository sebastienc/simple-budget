import { describe, expect, it } from 'vitest';
import { withTestDb } from '../../../test/dbFixture';
import { accountsQueries, balanceCheckpointsQueries, recurringItemsQueries, wipeAllData } from './queries';

describe('accountsQueries', () => {
  it('creates an account with defaulted starting balance fields', async () => {
    await withTestDb(async () => {
      const account = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      expect(account).toMatchObject({ name: 'Chequing', currency: 'CAD', starting_balance_cents: 0, starting_balance_date: null });
    });
  });

  it('lists accounts ordered by id', async () => {
    await withTestDb(async () => {
      await accountsQueries.create({ name: 'B', currency: 'CAD' });
      await accountsQueries.create({ name: 'A', currency: 'USD' });
      const accounts = await accountsQueries.list();
      expect(accounts.map((a) => a.name)).toEqual(['B', 'A']);
    });
  });

  it('updates only the fields that are provided', async () => {
    await withTestDb(async () => {
      const account = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      const updated = await accountsQueries.update(account.id, { startingBalanceCents: 5_000 });
      expect(updated).toMatchObject({ name: 'Chequing', currency: 'CAD', starting_balance_cents: 5_000 });
    });
  });

  it('deletes an account along with its recurring items and checkpoints', async () => {
    await withTestDb(async () => {
      const account = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      await recurringItemsQueries.create({
        accountId: account.id,
        name: 'Rent',
        amountCents: -1500,
        frequency: 'monthly',
        interval: 1,
        startDate: '2026-01-01',
      });
      await balanceCheckpointsQueries.upsert(account.id, '2026-01-01', 1000);

      await accountsQueries.delete(account.id);

      expect(await accountsQueries.get(account.id)).toBeUndefined();
      expect(await recurringItemsQueries.list(account.id)).toEqual([]);
      expect(await balanceCheckpointsQueries.list(account.id)).toEqual([]);
    });
  });
});

describe('recurringItemsQueries', () => {
  it('defaults sinkingFund to false when not provided', async () => {
    await withTestDb(async () => {
      const account = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      const item = await recurringItemsQueries.create({
        accountId: account.id,
        name: 'Rent',
        amountCents: -1500,
        frequency: 'monthly',
        interval: 1,
        startDate: '2026-01-01',
      });
      expect(item.sinking_fund).toBe(0);
    });
  });

  it('stores sinkingFund as an integer 1/0, not a boolean', async () => {
    await withTestDb(async () => {
      const account = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      const item = await recurringItemsQueries.create({
        accountId: account.id,
        name: 'Vacation fund',
        amountCents: -200,
        frequency: 'monthly',
        interval: 1,
        startDate: '2026-01-01',
        sinkingFund: true,
      });
      expect(item.sinking_fund).toBe(1);
    });
  });

  it('scopes list() to the given account', async () => {
    await withTestDb(async () => {
      const account1 = await accountsQueries.create({ name: 'One', currency: 'CAD' });
      const account2 = await accountsQueries.create({ name: 'Two', currency: 'CAD' });
      await recurringItemsQueries.create({
        accountId: account1.id,
        name: 'Rent',
        amountCents: -1500,
        frequency: 'monthly',
        interval: 1,
        startDate: '2026-01-01',
      });
      await recurringItemsQueries.create({
        accountId: account2.id,
        name: 'Internet',
        amountCents: -80,
        frequency: 'monthly',
        interval: 1,
        startDate: '2026-01-01',
      });

      const items = await recurringItemsQueries.list(account1.id);
      expect(items.map((i) => i.name)).toEqual(['Rent']);
    });
  });

  it('deletes a single item without touching its siblings', async () => {
    await withTestDb(async () => {
      const account = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      const rent = await recurringItemsQueries.create({
        accountId: account.id,
        name: 'Rent',
        amountCents: -1500,
        frequency: 'monthly',
        interval: 1,
        startDate: '2026-01-01',
      });
      const internet = await recurringItemsQueries.create({
        accountId: account.id,
        name: 'Internet',
        amountCents: -80,
        frequency: 'monthly',
        interval: 1,
        startDate: '2026-01-01',
      });

      await recurringItemsQueries.delete(rent.id);

      const remaining = await recurringItemsQueries.list(account.id);
      expect(remaining.map((i) => i.id)).toEqual([internet.id]);
    });
  });
});

describe('balanceCheckpointsQueries', () => {
  it('upserts by (account_id, date), replacing the balance on a repeat date', async () => {
    await withTestDb(async () => {
      const account = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      await balanceCheckpointsQueries.upsert(account.id, '2026-01-01', 1000);
      const updated = await balanceCheckpointsQueries.upsert(account.id, '2026-01-01', 2000);

      expect(updated.balance_cents).toBe(2000);
      expect(await balanceCheckpointsQueries.list(account.id)).toHaveLength(1);
    });
  });

  it('lists checkpoints ordered by date', async () => {
    await withTestDb(async () => {
      const account = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      await balanceCheckpointsQueries.upsert(account.id, '2026-03-01', 3000);
      await balanceCheckpointsQueries.upsert(account.id, '2026-01-01', 1000);

      const checkpoints = await balanceCheckpointsQueries.list(account.id);
      expect(checkpoints.map((c) => c.date)).toEqual(['2026-01-01', '2026-03-01']);
    });
  });
});

describe('wipeAllData', () => {
  it('deletes every account, recurring item, and checkpoint, leaving the schema intact', async () => {
    await withTestDb(async () => {
      const account = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      await recurringItemsQueries.create({
        accountId: account.id,
        name: 'Rent',
        amountCents: -1500,
        frequency: 'monthly',
        interval: 1,
        startDate: '2026-01-01',
      });
      await balanceCheckpointsQueries.upsert(account.id, '2026-01-01', 1000);

      await wipeAllData();

      expect(await accountsQueries.list()).toEqual([]);
      // Schema survives: creating a fresh account afterwards still works.
      const fresh = await accountsQueries.create({ name: 'New', currency: 'CAD' });
      expect(fresh.name).toBe('New');
    });
  });
});
