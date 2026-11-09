import type { DeviceState, SyncRow, Tombstone } from '../electron/main/sync/model';

// Rows as another device would have them, for the tests of sync: complete with every column the sync file carries.

export const T0 = '2026-11-01T10:00:00Z';
export const CREATED = '2026-11-01 09:00:00';

export const account = (uuid: string, updatedAt = T0, name = 'Chequing', extra: Partial<SyncRow['fields']> = {}): SyncRow => ({
  table: 'accounts',
  uuid,
  updatedAt,
  parentUuid: null,
  key: null,
  fields: { name, currency: 'CAD', startingBalanceCents: 1000, startingBalanceDate: '2026-11-01', createdAt: CREATED, ...extra },
});
export const item = (uuid: string, parentUuid: string, updatedAt = T0, name = 'Rent', extra: Partial<SyncRow['fields']> = {}): SyncRow => ({
  table: 'recurring_items',
  uuid,
  updatedAt,
  parentUuid,
  key: null,
  fields: {
    name,
    amountCents: -1500,
    frequency: 'monthly',
    interval: 1,
    startDate: '2026-11-01',
    endDate: null,
    semiMonthlyDay1: null,
    semiMonthlyDay2: null,
    sinkingFund: false,
    createdAt: CREATED,
    ...extra,
  },
});
export const correction = (uuid: string, parentUuid: string, date: string, updatedAt = T0, balanceCents = 500): SyncRow => ({
  table: 'balance_checkpoints',
  uuid,
  updatedAt,
  parentUuid,
  key: date,
  fields: { date, balanceCents, createdAt: CREATED },
});
export const tomb = (table: Tombstone['table'], uuid: string, deletedAt: string): Tombstone => ({ table, uuid, deletedAt });
export const remote = (deviceId: string, rows: SyncRow[], tombstones: Tombstone[] = []): DeviceState => ({ deviceId, rows, tombstones });
