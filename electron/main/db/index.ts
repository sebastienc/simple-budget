import { app } from 'electron';
import { dirname, join, resolve } from 'path';
import { mkdir, rm, copyFile } from 'fs/promises';
import SqliteDatabase from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration';
import type { Database } from './schema';
import * as migration001Init from './migrations/001_init';
import * as migration002RecurringItems from './migrations/002_recurring_items';
import * as migration003SemimonthlyRecurringItems from './migrations/003_semimonthly_recurring_items';
import * as migration004BalanceCheckpoints from './migrations/004_balance_checkpoints';
import * as migration005RecurringItemSinkingFund from './migrations/005_recurring_item_sinking_fund';

const migrations: Record<string, Migration> = {
  '001_init': migration001Init,
  '002_recurring_items': migration002RecurringItems,
  '003_semimonthly_recurring_items': migration003SemimonthlyRecurringItems,
  '004_balance_checkpoints': migration004BalanceCheckpoints,
  '005_recurring_item_sinking_fund': migration005RecurringItemSinkingFund,
};

class InlineMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return migrations;
  }
}

let db: Kysely<Database> | undefined;
let sqlite: SqliteDatabase.Database | undefined;

export function getDb(): Kysely<Database> {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

/**
 * SIMPLE_BUDGET_DB points the app at a different database file. It exists so a
 * throwaway one can be used for demos and manual testing — seeded data has no
 * business landing beside somebody's real finances, and the alternative is
 * remembering to delete test accounts afterwards.
 */
export function dbPath(): string {
  return process.env.SIMPLE_BUDGET_DB || join(app.getPath('userData'), 'simple-budget.db');
}

export async function initDb(): Promise<Kysely<Database>> {
  const path = dbPath();
  // An overridden path may point somewhere that doesn't exist yet; SQLite will
  // not create the parent directory for us.
  await mkdir(dirname(path), { recursive: true });

  sqlite = new SqliteDatabase(path);
  sqlite.pragma('journal_mode = WAL');

  db = new Kysely<Database>({ dialect: new SqliteDialect({ database: sqlite }) });

  const migrator = new Migrator({ db, provider: new InlineMigrationProvider() });
  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((result) => {
    if (result.status === 'Error') {
      console.error(`Migration "${result.migrationName}" failed`);
    }
  });

  if (error) {
    throw error;
  }

  return db;
}

export async function backupDbTo(destinationPath: string): Promise<void> {
  if (!sqlite) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  await sqlite.backup(destinationPath);
}

/**
 * Snapshots the database beside itself and returns where it landed.
 *
 * Used to make wiping safe: the app takes this itself rather than trusting the
 * user to have downloaded a backup, because a browser download can't be
 * confirmed from the page and "I thought I'd exported it" is not a recoverable
 * position to be in.
 */
export async function backupBeforeDestructiveChange(label: string): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const directory = join(dirname(dbPath()), 'backups');
  await mkdir(directory, { recursive: true });

  // Absolute: this path is shown to the user so they can go and find the file,
  // and SIMPLE_BUDGET_DB may well be relative.
  const destination = resolve(directory, `simple-budget-${label}-${stamp}.db`);
  await backupDbTo(destination);
  return destination;
}

export async function replaceDbWith(sourcePath: string): Promise<void> {
  sqlite?.close();
  db = undefined;
  sqlite = undefined;

  const path = dbPath();
  for (const suffix of ['', '-wal', '-shm']) {
    await rm(`${path}${suffix}`, { force: true });
  }
  await copyFile(sourcePath, path);

  await initDb();
}
