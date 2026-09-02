import { app } from 'electron';
import { join } from 'path';
import SqliteDatabase from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration';
import type { Database } from './schema';
import * as migration001Init from './migrations/001_init';

const migrations: Record<string, Migration> = {
  '001_init': migration001Init,
};

class InlineMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return migrations;
  }
}

let db: Kysely<Database> | undefined;

export function getDb(): Kysely<Database> {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export async function initDb(): Promise<Kysely<Database>> {
  const dbPath = join(app.getPath('userData'), 'simple-budget.db');
  const sqlite = new SqliteDatabase(dbPath);
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
