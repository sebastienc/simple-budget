import { mkdtemp, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import SqliteDatabase from 'better-sqlite3';
import { Kysely, SqliteDialect, sql } from 'kysely';
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDb, initDb, migrations } from '../index';
import { parseStamp } from '../../sync/stamp';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'simple-budget-migration-'));
  process.env.SIMPLE_BUDGET_DB = join(dir, 'test.db');
});

afterEach(async () => {
  delete process.env.SIMPLE_BUDGET_DB;
  await rm(dir, { recursive: true, force: true });
});

/** Builds a database as the app left it before sync (migrations 001 to 006), with some data, and closes it. */
async function buildVersion6Database(): Promise<void> {
  const sqlite = new SqliteDatabase(join(dir, 'test.db'));
  const db = new Kysely<unknown>({ dialect: new SqliteDialect({ database: sqlite }) });
  const upToSix: Record<string, Migration> = Object.fromEntries(Object.entries(migrations).filter(([name]) => name < '007'));
  const provider: MigrationProvider = { getMigrations: async () => upToSix };
  const { error } = await new Migrator({ db, provider }).migrateToLatest();
  if (error) throw error;
  sqlite.exec(`
    insert into accounts (id, name, currency, starting_balance_cents, starting_balance_date, created_at) values
      (1, 'Chequing', 'CAD', 150000, '2026-01-01', '2026-03-04 05:06:07'),
      (2, 'Savings', 'USD', 0, null, 'not a date');
    insert into recurring_items (id, account_id, name, amount_cents, frequency, interval, start_date, created_at) values
      (10, 1, 'Rent', -150000, 'monthly', 1, '2026-01-01', '2026-03-04 05:06:08'),
      (11, 1, 'Phone', -5000, 'monthly', 1, '2026-01-05', '2026-03-04 05:06:09');
    insert into balance_checkpoints (id, account_id, date, balance_cents, created_at) values
      (20, 1, '2026-02-01', 140000, '2026-03-04 05:06:10');
  `);
  await db.destroy();
}

/** The safety copies taken before an upgrade (opening one makes -wal and -shm files beside it, which are not copies). */
const safetyCopies = async () => (await readdir(join(dir, 'backups'))).filter((name) => name.includes('before-migration') && name.endsWith('.db'));

describe('migration 007 (sync identity)', () => {
  it('gives every existing row a unique uuid and an updated_at, and changes nothing else', async () => {
    await buildVersion6Database();
    await initDb();
    const db = getDb();

    const accounts = await db.selectFrom('accounts').selectAll().orderBy('id').execute();
    const items = await db.selectFrom('recurring_items').selectAll().orderBy('id').execute();
    const checkpoints = await db.selectFrom('balance_checkpoints').selectAll().orderBy('id').execute();

    expect(accounts.map((r) => [r.id, r.name, r.currency, r.starting_balance_cents, r.starting_balance_date])).toEqual([
      [1, 'Chequing', 'CAD', 150000, '2026-01-01'],
      [2, 'Savings', 'USD', 0, null],
    ]);
    expect(items.map((r) => [r.id, r.account_id, r.name, r.amount_cents])).toEqual([
      [10, 1, 'Rent', -150000],
      [11, 1, 'Phone', -5000],
    ]);
    expect(checkpoints.map((r) => [r.id, r.account_id, r.date, r.balance_cents])).toEqual([[20, 1, '2026-02-01', 140000]]);

    const uuids = [...accounts, ...items, ...checkpoints].map((r) => r.uuid);
    expect(uuids.every((u) => UUID_V4.test(u))).toBe(true);
    expect(new Set(uuids).size).toBe(uuids.length);
  });

  it('takes updated_at from created_at, and stamps a created_at that is not a date with the moment of the migration', async () => {
    await buildVersion6Database();
    const before = Date.now();
    await initDb();
    const db = getDb();

    const [chequing, savings] = await db.selectFrom('accounts').select(['updated_at']).orderBy('id').execute();
    expect(chequing.updated_at).toBe('2026-03-04T05:06:07Z');
    expect((await db.selectFrom('recurring_items').select('updated_at').where('id', '=', 10).executeTakeFirstOrThrow()).updated_at).toBe('2026-03-04T05:06:08Z');
    expect((await db.selectFrom('balance_checkpoints').select('updated_at').executeTakeFirstOrThrow()).updated_at).toBe('2026-03-04T05:06:10Z');

    const nanos = parseStamp(savings.updated_at);
    expect(nanos).not.toBeNull();
    const ms = Number((nanos as bigint) / 1_000_000n);
    expect(ms).toBeGreaterThanOrEqual(before - 1000);
    expect(ms).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('creates an empty deleted_rows table', async () => {
    await buildVersion6Database();
    await initDb();
    expect(await getDb().selectFrom('deleted_rows').selectAll().execute()).toEqual([]);
  });

  it('refuses two rows with the same uuid', async () => {
    await buildVersion6Database();
    await initDb();
    const [first] = await getDb().selectFrom('accounts').select('uuid').execute();
    await expect(getDb().insertInto('accounts').values({ name: 'Again', currency: 'CAD', uuid: first.uuid, updated_at: '2026-01-01T00:00:00Z' }).execute()).rejects.toThrow(/UNIQUE/);
  });

  it('takes a safety copy of a database that holds data before upgrading it, and only then', async () => {
    await buildVersion6Database();
    await initDb();

    const backups = await safetyCopies();
    expect(backups).toHaveLength(1);
    const copy = new SqliteDatabase(join(dir, 'backups', backups[0]), { readonly: true });
    try {
      // the copy is the database as it was: no uuid column yet, and the rows are there
      const columns = copy.prepare("select name from pragma_table_info('accounts')").all() as { name: string }[];
      expect(columns.map((c) => c.name)).not.toContain('uuid');
      expect(copy.prepare('select count(*) as n from accounts').get()).toEqual({ n: 2 });
    } finally {
      copy.close();
    }

    // starting again with nothing to migrate takes no further copy
    await initDb();
    expect(await safetyCopies()).toHaveLength(1);
  });

  it('takes no copy when the database is new', async () => {
    await initDb();
    await expect(readdir(join(dir, 'backups'))).rejects.toThrow(/ENOENT/);
  });

  it('can be undone, leaving the data in place', async () => {
    await buildVersion6Database();
    await initDb();
    const sqlite = new SqliteDatabase(join(dir, 'test.db'));
    const db = new Kysely<unknown>({ dialect: new SqliteDialect({ database: sqlite }) });
    try {
      const provider: MigrationProvider = { getMigrations: async () => migrations };
      const { error } = await new Migrator({ db, provider }).migrateTo('006_account_currency');
      expect(error).toBeUndefined();
      const columns = (await sql<{ name: string }>`select name from pragma_table_info('accounts')`.execute(db)).rows.map((c) => c.name);
      expect(columns).not.toContain('uuid');
      expect(columns).not.toContain('updated_at');
      expect((await sql<{ n: number }>`select count(*) as n from accounts`.execute(db)).rows[0].n).toBe(2);
      expect((await sql`select name from sqlite_master where name = 'deleted_rows'`.execute(db)).rows).toEqual([]);
    } finally {
      await db.destroy();
    }
  });
});
