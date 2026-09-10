import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('accounts').addColumn('currency', 'text', (col) => col.notNull().defaultTo('CAD')).execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('accounts').dropColumn('currency').execute();
}
