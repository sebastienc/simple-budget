import { sql, type Kysely } from 'kysely';

// Two-way sync with the mobile app (ADR-0008 in simple-budget-mobile) needs every row to have a stable identity
// that survives on every device (`uuid`), the moment it last changed (`updated_at`), and a record of what was deleted
// (`deleted_rows`). Additive only: existing rows keep their integer ids, which remain the foreign keys.
//
// `uuid` stays nullable at the database level (SQLite cannot add a NOT NULL column without a default, and a default
// would give every row the same value) but every row gets one here and every insert in db/queries.ts sets one; a
// unique index guards it. `updated_at` is an ISO-8601 UTC instant, like the mobile app's: `2026-11-05T10:00:00Z`.

const TABLES = ['accounts', 'recurring_items', 'balance_checkpoints'] as const;

// A random version-4 UUID, built in SQL because it has to be computed per row. (SQLite calls randomblob() once per row
// of an UPDATE, which the migration test checks.)
const RANDOM_UUID = sql`lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))`;

// created_at is `YYYY-MM-DD HH:MM:SS` in UTC (datetime('now')). It is the best guess of when a row last changed, and
// an old row nobody edited since is exactly that. Anything that does not look like it is stamped with the moment of
// the migration instead of being trusted.
const UPDATED_AT_FROM_CREATED_AT = sql`case when created_at glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]' then replace(created_at, ' ', 'T') || 'Z' else strftime('%Y-%m-%dT%H:%M:%SZ', 'now') end`;

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const table of TABLES) {
    await db.schema.alterTable(table).addColumn('uuid', 'text').execute();
    await db.schema.alterTable(table).addColumn('updated_at', 'text').execute();
    await sql`update ${sql.table(table)} set uuid = ${RANDOM_UUID}, updated_at = ${UPDATED_AT_FROM_CREATED_AT}`.execute(db);
    await db.schema.createIndex(`${table}_uuid_unique`).unique().on(table).column('uuid').execute();
  }

  // What was deleted and when, kept for good so a device that was away cannot bring a row back. The names match the
  // mobile app's table of the same name.
  await db.schema
    .createTable('deleted_rows')
    .addColumn('table_name', 'text', (col) => col.notNull())
    .addColumn('uuid', 'text', (col) => col.notNull())
    .addColumn('deleted_at', 'text', (col) => col.notNull())
    .addPrimaryKeyConstraint('deleted_rows_pk', ['table_name', 'uuid'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('deleted_rows').execute();
  for (const table of TABLES) {
    await db.schema.dropIndex(`${table}_uuid_unique`).execute();
    await db.schema.alterTable(table).dropColumn('updated_at').execute();
    await db.schema.alterTable(table).dropColumn('uuid').execute();
  }
}
