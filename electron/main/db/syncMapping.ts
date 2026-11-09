import type { Selectable } from 'kysely';
import type { AccountsTable, BalanceCheckpointsTable, RecurringItemsTable } from './schema';
import type { FieldValue, SyncRow } from '../sync/model';
import { formatStamp, parseStamp } from '../sync/stamp';

// The boundary between database rows and the rows the sync merge and the sync file speak (ADR-0008, ADR-0009 in
// simple-budget-mobile). The field names are the file's (camelCase) and the values plain text, whole numbers,
// booleans or null; an account is named by its uuid, never its integer id, which is never synced.

/** A stamp as stored, in the one form the merge compares and the files carry. Throws on text that is not a stamp. */
function stampFromDb(text: string, what: string): string {
  const nanos = parseStamp(text);
  if (nanos === null) throw new Error(`${what} has a time that is not a time: '${text}'`);
  return formatStamp(nanos);
}

export function accountToSyncRow(row: Selectable<AccountsTable>): SyncRow {
  return {
    table: 'accounts',
    uuid: row.uuid,
    updatedAt: stampFromDb(row.updated_at, `account ${row.uuid}`),
    parentUuid: null,
    key: null,
    fields: {
      name: row.name,
      currency: row.currency,
      startingBalanceCents: row.starting_balance_cents,
      startingBalanceDate: row.starting_balance_date,
      createdAt: row.created_at,
    },
  };
}

export function recurringItemToSyncRow(row: Selectable<RecurringItemsTable>, accountUuid: string): SyncRow {
  return {
    table: 'recurring_items',
    uuid: row.uuid,
    updatedAt: stampFromDb(row.updated_at, `item ${row.uuid}`),
    parentUuid: accountUuid,
    key: null,
    fields: {
      name: row.name,
      amountCents: row.amount_cents,
      frequency: row.frequency,
      interval: row.interval,
      startDate: row.start_date,
      endDate: row.end_date,
      semiMonthlyDay1: row.semi_monthly_day1,
      semiMonthlyDay2: row.semi_monthly_day2,
      sinkingFund: row.sinking_fund !== 0,
      createdAt: row.created_at,
    },
  };
}

export function balanceCheckpointToSyncRow(row: Selectable<BalanceCheckpointsTable>, accountUuid: string): SyncRow {
  return {
    table: 'balance_checkpoints',
    uuid: row.uuid,
    updatedAt: stampFromDb(row.updated_at, `correction ${row.uuid}`),
    parentUuid: accountUuid,
    key: row.date,
    fields: { date: row.date, balanceCents: row.balance_cents, createdAt: row.created_at },
  };
}

// The columns a sync row sets, without `id`, `uuid` and the account's id. A row reaching here has passed the file
// codec's checks, or came from this database, so a wrong type is a bug: fail loudly, and the transaction it happens in
// is rolled back.

export function accountColumns(row: SyncRow) {
  return {
    name: text(row, 'name'),
    currency: text(row, 'currency'),
    starting_balance_cents: whole(row, 'startingBalanceCents'),
    starting_balance_date: textOrNull(row, 'startingBalanceDate'),
    created_at: text(row, 'createdAt'),
    updated_at: row.updatedAt,
  };
}

export function recurringItemColumns(row: SyncRow) {
  return {
    name: text(row, 'name'),
    amount_cents: whole(row, 'amountCents'),
    frequency: text(row, 'frequency'),
    interval: whole(row, 'interval'),
    start_date: text(row, 'startDate'),
    end_date: textOrNull(row, 'endDate'),
    semi_monthly_day1: wholeOrNull(row, 'semiMonthlyDay1'),
    semi_monthly_day2: wholeOrNull(row, 'semiMonthlyDay2'),
    sinking_fund: row.fields.sinkingFund === true ? 1 : 0,
    created_at: text(row, 'createdAt'),
    updated_at: row.updatedAt,
  };
}

export function balanceCheckpointColumns(row: SyncRow) {
  return {
    date: text(row, 'date'),
    balance_cents: whole(row, 'balanceCents'),
    created_at: text(row, 'createdAt'),
    updated_at: row.updatedAt,
  };
}

const describe = (value: FieldValue | undefined) => JSON.stringify(value ?? null);

function text(row: SyncRow, name: string): string {
  const value = row.fields[name];
  if (typeof value !== 'string') throw new Error(`${row.uuid}: '${name}' is not text (${describe(value)})`);
  return value;
}

function textOrNull(row: SyncRow, name: string): string | null {
  const value = row.fields[name];
  if (value === null || typeof value === 'string') return value;
  throw new Error(`${row.uuid}: '${name}' is not text (${describe(value)})`);
}

function whole(row: SyncRow, name: string): number {
  const value = row.fields[name];
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error(`${row.uuid}: '${name}' is not a whole number (${describe(value)})`);
  return value;
}

function wholeOrNull(row: SyncRow, name: string): number | null {
  const value = row.fields[name];
  return value === null ? null : whole(row, name);
}
