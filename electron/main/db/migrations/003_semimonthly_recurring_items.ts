import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('recurring_items').addColumn('semi_monthly_day1', 'integer').execute();
  await db.schema.alterTable('recurring_items').addColumn('semi_monthly_day2', 'integer').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('recurring_items').dropColumn('semi_monthly_day2').execute();
  await db.schema.alterTable('recurring_items').dropColumn('semi_monthly_day1').execute();
}
