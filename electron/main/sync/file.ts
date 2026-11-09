import { createHash } from 'node:crypto';
import { addSeconds, compareStamps, formatStamp, isIsoDate, parseStamp } from './stamp.ts';
import { SYNC_TABLES } from './model.ts';
import type { FieldValue, ReadResult, SkipReason, SyncFile, SyncRow, SyncTable, Tombstone } from './model.ts';

// The sync file of ADR-0009 (mobile repo): what one device publishes into the shared folder, and the checks a file
// must pass before anything in it is merged. Pure: bytes in, a typed result out. A port of the mobile app's
// `domain/sync/SyncFile.kt` and `Json.kt`; both pass test/golden/sync/sync-file.json.
//
// A file is an envelope `{"format": 1, "payloadSha256": "<hex>", "payload": "<text>"}`. The payload is a string of
// JSON, and the hash is of that string's UTF-8 bytes, so neither side has to reproduce the other's serialisation to
// check it. A reader that finds anything wrong skips the whole file for this round; it never merges part of one.
//
// Limits of this side, beyond the mobile app's: whole numbers must be safe integers (below 2^53, which is 90
// trillion dollars in cents), and stamps must be in the exact form stamp.ts describes.

/** The version of the envelope and payload layout. A file with a higher one was written by a newer app. */
export const SYNC_FILE_FORMAT = 1;

/** The version of what is synced: the tables and their columns. Bump it when a synced column is added or changed. */
export const SYNC_SCHEMA = 1;

/** A real file is a few kilobytes; this stops a damaged or hostile one from being read into memory. */
export const MAX_SYNC_FILE_BYTES = 5 * 1024 * 1024;

/** A stamp further ahead of this device's clock than this would win every conflict, so the file is skipped. */
export const MAX_STAMP_AHEAD_SECONDS = 24 * 3600;

/** Nesting deeper than this is refused. */
export const MAX_JSON_DEPTH = 16;

export const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP'] as const;
export const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly', 'semimonthly'] as const;

class Skip extends Error {
  reason: SkipReason;
  constructor(reason: SkipReason, detail: string) {
    super(detail);
    this.reason = reason;
  }
}

const invalid = (detail: string): never => {
  throw new Skip('INVALID', detail);
};

// --- what a row holds ---------------------------------------------------------------------------------------

type FieldType = 'TEXT' | 'CURRENCY' | 'FREQUENCY' | 'LONG' | 'INT' | 'INT_OR_NULL' | 'BOOLEAN' | 'DATE' | 'DATE_OR_NULL';

interface Field {
  name: string;
  type: FieldType;
}

interface TableLayout {
  table: SyncTable;
  arrayName: string;
  fields: Field[];
}

// What must hold is what the app needs to read a row without failing, not what the forms allow: a range such as
// "interval at least 1" is not checked. Where the file names an account, the account is `accountUuid`.
const LAYOUTS: TableLayout[] = [
  {
    table: 'accounts',
    arrayName: 'accounts',
    fields: [
      { name: 'name', type: 'TEXT' },
      { name: 'currency', type: 'CURRENCY' },
      { name: 'startingBalanceCents', type: 'LONG' },
      { name: 'startingBalanceDate', type: 'DATE_OR_NULL' },
      { name: 'createdAt', type: 'TEXT' },
    ],
  },
  {
    table: 'recurring_items',
    arrayName: 'recurringItems',
    fields: [
      { name: 'name', type: 'TEXT' },
      { name: 'amountCents', type: 'LONG' },
      { name: 'frequency', type: 'FREQUENCY' },
      { name: 'interval', type: 'INT' },
      { name: 'startDate', type: 'DATE' },
      { name: 'endDate', type: 'DATE_OR_NULL' },
      { name: 'semiMonthlyDay1', type: 'INT_OR_NULL' },
      { name: 'semiMonthlyDay2', type: 'INT_OR_NULL' },
      { name: 'sinkingFund', type: 'BOOLEAN' },
      { name: 'createdAt', type: 'TEXT' },
    ],
  },
  {
    table: 'balance_checkpoints',
    arrayName: 'balanceCorrections',
    fields: [
      { name: 'date', type: 'DATE' },
      { name: 'balanceCents', type: 'LONG' },
      { name: 'createdAt', type: 'TEXT' },
    ],
  },
];

const PARENT = 'accountUuid';
const HEX = /^[0-9a-fA-F]{64}$/;
const DEVICE_ID = /^[A-Za-z0-9-]{1,64}$/;
const INT_MIN = -(2 ** 31);
const INT_MAX = 2 ** 31 - 1;

/** A device id is a random UUID, but anything of letters, digits and dashes up to 64 characters is accepted. */
export function isValidDeviceId(id: string): boolean {
  return DEVICE_ID.test(id);
}

const PREFIX = 'simple-budget-sync-';
const SUFFIX = '.json';

/** The name of a device's sync file. Only a name of exactly this shape is ever read, written or removed. */
export function syncFileName(deviceId: string): string {
  if (!isValidDeviceId(deviceId)) throw new Error(`not a device id: '${deviceId}'`);
  return `${PREFIX}${deviceId}${SUFFIX}`;
}

/** The device id in a sync file's name, or null if the name is not a sync file's. */
export function deviceIdOfSyncFile(name: string): string | null {
  if (!name.startsWith(PREFIX) || !name.endsWith(SUFFIX)) return null;
  const id = name.slice(PREFIX.length, name.length - SUFFIX.length);
  return isValidDeviceId(id) ? id : null;
}

// --- JSON, strictly -------------------------------------------------------------------------------------------

/** A number as written in the file, since a double cannot tell `5`, `5.0` and `1e5` apart from a real fraction. */
class RawNumber {
  text: string;
  constructor(text: string) {
    this.text = text;
  }
}

type Json = null | boolean | string | RawNumber | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

class JsonError extends Error {}

/** True when the text nests deeper than MAX_JSON_DEPTH, found without recursing (a deep file must not overflow the stack). */
function nestedTooDeeply(text: string): boolean {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
    } else if (c === '{' || c === '[') {
      if (++depth > MAX_JSON_DEPTH) return true;
    } else if (c === '}' || c === ']') {
      depth--;
    }
  }
  return false;
}

/**
 * Parses exactly one JSON value. JSON.parse already follows RFC 8259 (no comments, no trailing commas, control
 * characters must be escaped, a repeated key keeps the last value). On top of that: nesting is limited, a string
 * holding an unpaired surrogate is refused (it cannot be hashed as UTF-8 without losing it), and numbers keep the text
 * they were written with.
 */
function parseJson(text: string): Json {
  if (nestedTooDeeply(text)) throw new JsonError('nested too deeply');
  try {
    return JSON.parse(text, function (this: unknown, key: string, value: unknown, context?: { source?: string }) {
      if (LONE_SURROGATE.test(key)) throw new JsonError('unpaired surrogate');
      if (typeof value === 'string' && LONE_SURROGATE.test(value)) throw new JsonError('unpaired surrogate');
      if (typeof value === 'number') {
        if (context?.source === undefined) throw new JsonError('this runtime does not give the source text of numbers');
        return new RawNumber(context.source);
      }
      return value;
    }) as Json;
  } catch (e) {
    if (e instanceof JsonError) throw e;
    throw new JsonError(e instanceof Error ? e.message : String(e));
  }
}

/**
 * The value of a JSON number if it is a whole number that fits a safe integer, however it is written (`5`, `5.0`,
 * `5e0`); null for a real fraction or a number too big. Works on the text, so `5.000000000000000000001` is a fraction.
 */
export function wholeOrNull(text: string): number | null {
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(text);
  if (m === null) return null;
  const fraction = m[3] ?? '';
  const digits = (m[2] + fraction).replace(/^0+/, '');
  if (digits === '') return 0;
  const scale = fraction.length - Number(m[4] ?? '0');
  let whole: string;
  if (scale > 0) {
    if (scale > digits.length || /[^0]/.test(digits.slice(digits.length - scale))) return null;
    whole = digits.slice(0, digits.length - scale);
  } else {
    if (digits.length - scale > 20) return null;
    whole = digits + '0'.repeat(-scale);
  }
  if (whole === '') return 0;
  const value = BigInt(m[1] + whole);
  return value >= -BigInt(Number.MAX_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
}

const isObject = (json: Json | undefined): json is JsonObject => typeof json === 'object' && json !== null && !Array.isArray(json) && !(json instanceof RawNumber);
const member = (o: JsonObject, key: string): Json | undefined => o[key];

function parseObject(text: string, reason: SkipReason, what: string): JsonObject {
  let json: Json;
  try {
    json = parseJson(text);
  } catch (e) {
    throw new Skip(reason, `${what}: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!isObject(json)) throw new Skip(reason, `${what} is not a JSON object`);
  return json;
}

// --- reading one object ---------------------------------------------------------------------------------------

function whole(o: JsonObject, key: string): number | null {
  const value = member(o, key);
  return value instanceof RawNumber ? wholeOrNull(value.text) : null;
}

function int(o: JsonObject, key: string): number {
  const value = whole(o, key) ?? invalid(`${key} is not a whole number`);
  if (value < INT_MIN || value > INT_MAX) invalid(`${key} does not fit`);
  return value;
}

function text(o: JsonObject, key: string): string {
  const value = member(o, key);
  return typeof value === 'string' ? value : invalid(`${key} is not text`);
}

function object(o: JsonObject, key: string): JsonObject {
  const value = member(o, key);
  return isObject(value) ? value : invalid(`${key} is not an object`);
}

function array(o: JsonObject, key: string): Json[] {
  const value = member(o, key);
  return Array.isArray(value) ? value : invalid(`${key} is not a list`);
}

function uuid(o: JsonObject): string {
  const value = text(o, 'uuid');
  return value === '' ? invalid('a uuid is empty') : value;
}

function instant(o: JsonObject, key: string): string {
  const value = text(o, key);
  const nanos = parseStamp(value);
  if (nanos === null) invalid(`${key} is not a time`);
  // Kept in the form Instant.toString() writes, so the same instant is always the same text.
  return formatStamp(nanos as bigint);
}

function readField(row: JsonObject, field: Field): FieldValue {
  const json = member(row, field.name) ?? null;
  const bad = (what: string): never => invalid(`${field.name} ${what}`);
  const wholeValue = (): number => (json instanceof RawNumber ? wholeOrNull(json.text) : null) ?? bad('is not a whole number');
  const intValue = (): number => {
    const value = wholeValue();
    return value < INT_MIN || value > INT_MAX ? bad('does not fit') : value;
  };
  const textValue = (): string => (typeof json === 'string' ? json : bad('is not text'));
  const dateValue = (): string => {
    const value = textValue();
    return isIsoDate(value) ? value : bad('is not a date');
  };
  switch (field.type) {
    case 'TEXT':
      return textValue();
    case 'CURRENCY': {
      const code = textValue();
      return (CURRENCIES as readonly string[]).includes(code) ? code : bad('is not a known currency');
    }
    case 'FREQUENCY': {
      const name = textValue();
      return (FREQUENCIES as readonly string[]).includes(name) ? name : bad('is not a known frequency');
    }
    case 'LONG':
      return wholeValue();
    case 'INT':
      return intValue();
    case 'INT_OR_NULL':
      return json === null ? null : intValue();
    case 'BOOLEAN':
      return typeof json === 'boolean' ? json : bad('is not true or false');
    case 'DATE':
      return dateValue();
    case 'DATE_OR_NULL':
      return json === null ? null : dateValue();
  }
}

function decodeRow(row: JsonObject, layout: TableLayout, where: string): SyncRow {
  try {
    const parentUuid = layout.table === 'accounts' ? null : text(row, PARENT);
    const fields: Record<string, FieldValue> = {};
    for (const field of layout.fields) fields[field.name] = readField(row, field);
    return {
      table: layout.table,
      uuid: uuid(row),
      updatedAt: instant(row, 'updatedAt'),
      parentUuid,
      key: layout.table === 'balance_checkpoints' ? (fields.date as string) : null,
      fields,
    };
  } catch (e) {
    if (e instanceof Skip) throw new Skip(e.reason, `${where}: ${e.message}`);
    throw e;
  }
}

/** Things that must hold of one device's state, whatever its rows say: none of them can happen by accident. */
function checkConsistent(rows: SyncRow[], tombstones: Tombstone[]): void {
  const seen = new Set<string>();
  const firstUse = (set: Set<string>, id: string) => {
    if (set.has(id)) return false;
    set.add(id);
    return true;
  };
  for (const row of rows) if (!firstUse(seen, `${row.table}|${row.uuid}`)) invalid(`${row.table} ${row.uuid} appears twice`);
  for (const tombstone of tombstones) {
    if (!firstUse(seen, `${tombstone.table}|${tombstone.uuid}`)) invalid(`${tombstone.table} ${tombstone.uuid} is both live and deleted, or deleted twice`);
  }
  const accounts = new Set(rows.filter((row) => row.table === 'accounts').map((row) => row.uuid));
  const orphan = rows.find((row) => row.parentUuid !== null && !accounts.has(row.parentUuid));
  if (orphan !== undefined) invalid(`${orphan.uuid} belongs to an account not in the file`);
  const days = new Set<string>();
  for (const row of rows.filter((r) => r.table === 'balance_checkpoints')) {
    if (!firstUse(days, JSON.stringify([row.parentUuid, row.key]))) invalid('two corrections for the same account and day');
  }
}

// --- reading --------------------------------------------------------------------------------------------------

const sha256Hex = (data: Uint8Array | string): string => createHash('sha256').update(data).digest('hex');

/**
 * Checks and decodes a file read from the folder.
 *
 * `now` is this device's clock (a stamp). `fileDeviceId` is the device id in the file's name, when known: a file whose
 * content names another device is refused, so a copied or renamed file cannot pass for someone else's.
 * `supportedSchema` is the newest data layout this app understands.
 */
export function decodeSyncFile(bytes: Uint8Array, now: string, options: { supportedSchema?: number; fileDeviceId?: string | null } = {}): ReadResult {
  try {
    return { kind: 'read', file: decode(bytes, now, options.supportedSchema ?? SYNC_SCHEMA, options.fileDeviceId ?? null) };
  } catch (e) {
    if (e instanceof Skip) return { kind: 'skipped', reason: e.reason, detail: e.message };
    throw e;
  }
}

function decode(bytes: Uint8Array, now: string, supportedSchema: number, fileDeviceId: string | null): SyncFile {
  if (bytes.length > MAX_SYNC_FILE_BYTES) throw new Skip('TOO_LARGE', `${bytes.length} bytes`);
  let fileText: string;
  try {
    // ignoreBOM keeps a byte order mark in the text, where the JSON parser refuses it, as the mobile reader does.
    fileText = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new Skip('UNREADABLE', 'not UTF-8');
  }

  const envelope = parseObject(fileText, 'UNREADABLE', 'the file');
  const format =
    whole(envelope, 'format') ??
    (() => {
      throw new Skip('UNREADABLE', 'no format');
    })();
  if (format > SYNC_FILE_FORMAT) throw new Skip('NEWER_FORMAT', `format ${format}`);
  if (format !== SYNC_FILE_FORMAT) throw new Skip('UNREADABLE', `format ${format}`);
  const sha = member(envelope, 'payloadSha256');
  const payloadText = member(envelope, 'payload');
  if (typeof sha !== 'string' || typeof payloadText !== 'string' || !HEX.test(sha)) throw new Skip('UNREADABLE', 'no payload or hash');
  if (sha256Hex(payloadText).toLowerCase() !== sha.toLowerCase()) throw new Skip('CHECKSUM', 'the payload does not match its hash');

  const payload = parseObject(payloadText, 'INVALID', 'the payload');
  const payloadFormat = whole(payload, 'format') ?? invalid('the payload has no format');
  if (payloadFormat > SYNC_FILE_FORMAT) throw new Skip('NEWER_FORMAT', `payload format ${payloadFormat}`);
  if (payloadFormat !== SYNC_FILE_FORMAT) invalid(`payload format ${payloadFormat}`);
  const schema = int(payload, 'schema');
  if (schema > supportedSchema) throw new Skip('NEWER_SCHEMA', `schema ${schema}`);
  if (schema < 1) invalid(`schema ${schema}`);

  const device = object(payload, 'device');
  const deviceId = text(device, 'id');
  if (!isValidDeviceId(deviceId)) invalid(`device id '${deviceId}'`);
  if (fileDeviceId !== null && fileDeviceId !== deviceId) invalid(`the file is named for ${fileDeviceId} but written by ${deviceId}`);
  const header = { deviceId, deviceName: text(device, 'name'), writtenAt: instant(payload, 'writtenAt'), schema };

  const rows: SyncRow[] = [];
  for (const layout of LAYOUTS) {
    array(payload, layout.arrayName).forEach((element, index) => {
      const where = `${layout.arrayName}[${index}]`;
      if (!isObject(element)) invalid(`${where} is not an object`);
      rows.push(decodeRow(element as JsonObject, layout, where));
    });
  }
  const tombstones = array(payload, 'deleted').map((element, index): Tombstone => {
    if (!isObject(element)) invalid(`deleted[${index}] is not an object`);
    const entry = element as JsonObject;
    const table = text(entry, 'table');
    if (!(SYNC_TABLES as readonly string[]).includes(table)) invalid(`deleted[${index}]: Unknown sync table '${table}'`);
    return { table: table as SyncTable, uuid: uuid(entry), deletedAt: instant(entry, 'deletedAt') };
  });

  checkConsistent(rows, tombstones);

  const latest = addSeconds(now, MAX_STAMP_AHEAD_SECONDS);
  const ahead = [...rows.map((row) => row.updatedAt), ...tombstones.map((tombstone) => tombstone.deletedAt), header.writtenAt].find((stamp) => compareStamps(stamp, latest) > 0);
  if (ahead !== undefined) throw new Skip('FUTURE_STAMP', `a stamp of ${ahead}, now is ${now}`);

  return { header, rows, tombstones };
}

// --- writing --------------------------------------------------------------------------------------------------

/** Text with every unpaired surrogate replaced by U+FFFD, so it can be written as UTF-8 and read back as it was. */
function wellFormed(value: string): string {
  return value.replace(new RegExp(LONE_SURROGATE.source, 'g'), '�');
}

function encodeRow(row: SyncRow, layout: TableLayout): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = { uuid: wellFormed(row.uuid), updatedAt: row.updatedAt };
  if (row.parentUuid !== null) out[PARENT] = wellFormed(row.parentUuid);
  const names = layout.fields.map((field) => field.name);
  const held = Object.keys(row.fields);
  if (held.length !== names.length || !names.every((name) => held.includes(name))) {
    throw new Error(`a ${row.table} row must hold exactly ${names.join(', ')}, not ${held.join(', ')}`);
  }
  if (row.table === 'balance_checkpoints' && row.key !== row.fields.date) throw new Error("a correction's key is its date");
  for (const field of layout.fields) {
    const value = row.fields[field.name];
    if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error(`unsupported value for ${field.name}`);
    out[field.name] = typeof value === 'string' ? wellFormed(value) : value;
  }
  return out;
}

/** The bytes to put in the folder. Rows are written in the order given, so pass a merged state's order. */
export function encodeSyncFile(file: SyncFile): Uint8Array {
  const payload = JSON.stringify({
    format: SYNC_FILE_FORMAT,
    schema: file.header.schema,
    device: { id: wellFormed(file.header.deviceId), name: wellFormed(file.header.deviceName) },
    writtenAt: file.header.writtenAt,
    ...Object.fromEntries(LAYOUTS.map((layout) => [layout.arrayName, file.rows.filter((row) => row.table === layout.table).map((row) => encodeRow(row, layout))])),
    deleted: file.tombstones.map((t) => ({ table: t.table, uuid: wellFormed(t.uuid), deletedAt: t.deletedAt })),
  });
  const envelope = JSON.stringify({ format: SYNC_FILE_FORMAT, payloadSha256: sha256Hex(payload), payload });
  return new TextEncoder().encode(envelope);
}
