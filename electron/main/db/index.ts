import { app } from 'electron';
import { join } from 'path';
import { rm, copyFile } from 'fs/promises';
import SqliteDatabase from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration';
import type { Database } from './schema';
import * as migration001Init from './migrations/001_init';
import * as migration002RecurringItems from './migrations/002_recurring_items';

const migrations: Record<string, Migration> = {
  '001_init': migration001Init,
  '002_recurring_items': migration002RecurringItems,
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

function dbPath(): string {
  return join(app.getPath('userData'), 'simple-budget.db');
}

export async function initDb(): Promise<Kysely<Database>> {
  sqlite = new SqliteDatabase(dbPath());
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
