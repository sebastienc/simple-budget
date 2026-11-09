// The types of sync (ADR-0008, ADR-0009 in the mobile repo). They mirror the mobile app's `domain/sync`, so that the
// two apps can be checked against the same golden files (test/golden/sync). Pure data: no database, no files.

/** The tables that take part in sync, in the order a merged state lists them. */
export const SYNC_TABLES = ['accounts', 'recurring_items', 'balance_checkpoints'] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

export function tableIndex(table: SyncTable): number {
  return SYNC_TABLES.indexOf(table);
}

/** What a synced column holds: text, a whole number (a safe integer), a boolean or null. */
export type FieldValue = string | number | boolean | null;

/**
 * One live row as a device holds it. `parentUuid` is the account an item or a correction belongs to (an account has
 * none). `key` is what makes a correction unique within its account: its date. `fields` are the other columns, which
 * the merge carries untouched. `updatedAt` is a stamp (see stamp.ts).
 */
export interface SyncRow {
  table: SyncTable;
  uuid: string;
  updatedAt: string;
  parentUuid: string | null;
  key: string | null;
  fields: Record<string, FieldValue>;
}

/** A row that was deleted, and when. Kept for good, so a device that was away cannot bring it back. */
export interface Tombstone {
  table: SyncTable;
  uuid: string;
  deletedAt: string;
}

/** What one device holds: its live rows and its tombstones. A row is live or deleted on a device, never both. */
export interface DeviceState {
  deviceId: string;
  rows: SyncRow[];
  tombstones: Tombstone[];
}

/** The result of a merge, in a fixed order: tables as in SYNC_TABLES, then uuid. */
export interface MergedState {
  rows: SyncRow[];
  tombstones: Tombstone[];
}

export interface SyncHeader {
  deviceId: string;
  deviceName: string;
  writtenAt: string;
  schema: number;
}

/** What one device published: who and when, its live rows and its tombstones. */
export interface SyncFile {
  header: SyncHeader;
  rows: SyncRow[];
  tombstones: Tombstone[];
}

/** The file as the merge sees it, held by the device that wrote it. */
export function stateOf(file: SyncFile): DeviceState {
  return { deviceId: file.header.deviceId, rows: file.rows, tombstones: file.tombstones };
}

/** Why a file was skipped. None of these is shown as text; the screen maps each to a message. */
export const SKIP_REASONS = ['UNREADABLE', 'CHECKSUM', 'NEWER_FORMAT', 'NEWER_SCHEMA', 'TOO_LARGE', 'INVALID', 'FUTURE_STAMP'] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

export type ReadResult = { kind: 'read'; file: SyncFile } | { kind: 'skipped'; reason: SkipReason; detail: string };

/** A file found in the folder, decoded, and the device its name says wrote it. */
export interface RemoteFile {
  deviceId: string;
  result: ReadResult;
}
