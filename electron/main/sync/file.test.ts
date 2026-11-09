import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decodeSyncFile, deviceIdOfSyncFile, encodeSyncFile, MAX_SYNC_FILE_BYTES, syncFileName, wholeOrNull } from './file.ts';
import type { SkipReason, SyncFile } from './model.ts';

const NOW = '2026-11-09T12:00:00Z';
const enc = new TextEncoder();

const sample: SyncFile = {
  header: { deviceId: 'dev-1', deviceName: 'Desktop', writtenAt: '2026-11-09T11:00:00Z', schema: 1 },
  rows: [
    {
      table: 'accounts',
      uuid: 'a1',
      updatedAt: '2026-11-05T10:00:00Z',
      parentUuid: null,
      key: null,
      fields: { name: 'Chequing', currency: 'CAD', startingBalanceCents: 150000, startingBalanceDate: '2026-11-01', createdAt: '2026-11-01 09:00:00' },
    },
    {
      table: 'recurring_items',
      uuid: 'i1',
      updatedAt: '2026-11-05T10:00:00.250Z',
      parentUuid: 'a1',
      key: null,
      fields: {
        name: 'Rent',
        amountCents: -150000,
        frequency: 'monthly',
        interval: 1,
        startDate: '2026-11-01',
        endDate: null,
        semiMonthlyDay1: null,
        semiMonthlyDay2: null,
        sinkingFund: true,
        createdAt: '2026-11-01 09:00:00',
      },
    },
    {
      table: 'balance_checkpoints',
      uuid: 'c1',
      updatedAt: '2026-11-05T10:00:00Z',
      parentUuid: 'a1',
      key: '2026-11-05',
      fields: { date: '2026-11-05', balanceCents: 140000, createdAt: '2026-11-05 10:00:00' },
    },
  ],
  tombstones: [{ table: 'recurring_items', uuid: 'gone', deletedAt: '2026-11-06T10:00:00Z' }],
};

/** An envelope around [payload] text with a right hash, as another app would write it. */
const envelope = (payload: string) => enc.encode(JSON.stringify({ format: 1, payloadSha256: createHash('sha256').update(payload).digest('hex'), payload }));
const payloadOf = (file: SyncFile) => JSON.parse(new TextDecoder().decode(encodeSyncFile(file))).payload as string;
const skippedReason = (bytes: Uint8Array): SkipReason | 'read' => {
  const result = decodeSyncFile(bytes, NOW);
  return result.kind === 'skipped' ? result.reason : 'read';
};

describe('encodeSyncFile', () => {
  it('writes what decodeSyncFile reads back, exactly', () => {
    const result = decodeSyncFile(encodeSyncFile(sample), NOW);
    expect(result).toEqual({ kind: 'read', file: sample });
  });

  it('writes the envelope with a hash of the payload text', () => {
    const outer = JSON.parse(new TextDecoder().decode(encodeSyncFile(sample)));
    expect(Object.keys(outer)).toEqual(['format', 'payloadSha256', 'payload']);
    expect(outer.payloadSha256).toBe(createHash('sha256').update(outer.payload, 'utf8').digest('hex'));
  });

  it('writes the payload keys in the documented order', () => {
    const payload = JSON.parse(payloadOf(sample));
    expect(Object.keys(payload)).toEqual(['format', 'schema', 'device', 'writtenAt', 'accounts', 'recurringItems', 'balanceCorrections', 'deleted']);
    expect(Object.keys(payload.accounts[0])).toEqual(['uuid', 'updatedAt', 'name', 'currency', 'startingBalanceCents', 'startingBalanceDate', 'createdAt']);
    expect(Object.keys(payload.recurringItems[0]).slice(0, 4)).toEqual(['uuid', 'updatedAt', 'accountUuid', 'name']);
    expect(Object.keys(payload.deleted[0])).toEqual(['table', 'uuid', 'deletedAt']);
  });

  it('keeps text outside ASCII, and replaces an unpaired surrogate so the file stays readable', () => {
    const file: SyncFile = { ...sample, header: { ...sample.header, deviceName: 'Pi\uD83Cxel é 🙂' } };
    const result = decodeSyncFile(encodeSyncFile(file), NOW);
    expect(result.kind === 'read' ? result.file.header.deviceName : result).toBe('Pi�xel é 🙂');
  });

  it('refuses a row that does not hold exactly the columns of its table', () => {
    const [account, ...rest] = sample.rows;
    expect(() => encodeSyncFile({ ...sample, rows: [{ ...account, fields: { name: 'x' } }, ...rest] })).toThrow();
    expect(() => encodeSyncFile({ ...sample, rows: [{ ...account, fields: { ...account.fields, extra: 1 } }, ...rest] })).toThrow();
  });

  it('refuses a number it could not read back', () => {
    const [account, ...rest] = sample.rows;
    expect(() => encodeSyncFile({ ...sample, rows: [{ ...account, fields: { ...account.fields, startingBalanceCents: 2 ** 53 } }, ...rest] })).toThrow();
    expect(() => encodeSyncFile({ ...sample, rows: [{ ...account, fields: { ...account.fields, startingBalanceCents: 1.5 } }, ...rest] })).toThrow();
  });

  it('refuses a correction whose key is not its date', () => {
    const rows = sample.rows.map((row) => (row.table === 'balance_checkpoints' ? { ...row, key: '2026-01-01' } : row));
    expect(() => encodeSyncFile({ ...sample, rows })).toThrow();
  });
});

describe('decodeSyncFile', () => {
  it('skips a file over the size limit before reading it', () => {
    expect(skippedReason(new Uint8Array(MAX_SYNC_FILE_BYTES + 1))).toBe('TOO_LARGE');
  });

  it('accepts a file of exactly the limit as far as size goes', () => {
    expect(skippedReason(new Uint8Array(MAX_SYNC_FILE_BYTES))).toBe('UNREADABLE');
  });

  it('skips bytes that are not UTF-8', () => {
    expect(skippedReason(new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]))).toBe('UNREADABLE');
    expect(skippedReason(new Uint8Array([0xc0, 0xaf]))).toBe('UNREADABLE');
    expect(skippedReason(new Uint8Array([0xed, 0xa0, 0x80]))).toBe('UNREADABLE');
  });

  it('skips a file with a bad byte inside an otherwise valid string, instead of repairing it', () => {
    const good = encodeSyncFile(sample);
    const damaged = good.slice();
    damaged[good.indexOf(enc.encode('Desktop')[0])] = 0xff;
    expect(skippedReason(damaged)).toBe('UNREADABLE');
  });

  it('skips a file that starts with a byte order mark, as the mobile reader does', () => {
    const good = encodeSyncFile(sample);
    expect(skippedReason(new Uint8Array([0xef, 0xbb, 0xbf, ...good]))).toBe('UNREADABLE');
  });

  it('skips an envelope nested deeper than 16 levels, without overflowing the stack', () => {
    expect(skippedReason(enc.encode('['.repeat(200_000) + ']'.repeat(200_000)))).toBe('UNREADABLE');
  });

  it('allows 16 levels of nesting and refuses 17, counting the envelope itself as the first', () => {
    // a valid file with an extra key holding `levels` nested lists: the envelope is level 1
    const nested = (levels: number) => {
      const outer = JSON.parse(new TextDecoder().decode(encodeSyncFile(sample)));
      return enc.encode(JSON.stringify(outer).replace(/}$/, `,"extra":${'['.repeat(levels)}${']'.repeat(levels)}}`));
    };
    expect(skippedReason(nested(15))).toBe('read');
    expect(skippedReason(nested(16))).toBe('UNREADABLE');
  });

  it('counts brackets only outside strings when measuring depth', () => {
    const payload = JSON.stringify({
      format: 1,
      schema: 1,
      device: { id: 'd', name: '[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[\\"[[[[' },
      writtenAt: '2026-11-09T11:00:00Z',
      accounts: [],
      recurringItems: [],
      balanceCorrections: [],
      deleted: [],
    });
    expect(skippedReason(envelope(payload))).toBe('read');
  });

  it('skips a payload nested too deeply as invalid', () => {
    expect(skippedReason(envelope('{"a":'.repeat(20) + '1' + '}'.repeat(20)))).toBe('INVALID');
  });

  it('skips an unpaired surrogate in the envelope or the payload', () => {
    expect(skippedReason(enc.encode('{"format":1,"payloadSha256":"x","payload":"\\ud800"}'))).toBe('UNREADABLE');
    const payload = payloadOf(sample).replace('Desktop', 'D\\ud800esktop');
    expect(skippedReason(envelope(payload))).toBe('INVALID');
  });

  it('accepts a correctly paired surrogate written as escapes', () => {
    const payload = payloadOf(sample).replace('Desktop', '\\ud83d\\ude42');
    const result = decodeSyncFile(envelope(payload), NOW);
    expect(result.kind === 'read' ? result.file.header.deviceName : result).toBe('🙂');
  });

  it('skips a key with an unpaired surrogate', () => {
    const payload = payloadOf(sample).replace('"name":"Desktop"', '"name":"Desktop","\\udc00":1');
    expect(skippedReason(envelope(payload))).toBe('INVALID');
  });

  it('keeps the last of a repeated key, as JSON.parse and the mobile reader do', () => {
    const payload = payloadOf(sample).replace('"name":"Desktop"', '"name":"First","name":"Desktop"');
    const result = decodeSyncFile(envelope(payload), NOW);
    expect(result.kind === 'read' ? result.file.header.deviceName : result).toBe('Desktop');
  });

  it('does not trip over a key called __proto__', () => {
    const payload = payloadOf(sample).replace('"writtenAt"', '"__proto__":{"format":9},"writtenAt"');
    expect(skippedReason(envelope(payload))).toBe('read');
  });

  it('reads a stamp into the form Instant.toString() writes', () => {
    const payload = payloadOf(sample).replace('"2026-11-05T10:00:00Z"', '"2026-11-05T10:00:00.5Z"');
    const result = decodeSyncFile(envelope(payload), NOW);
    expect(result.kind === 'read' ? result.file.rows[0].updatedAt : result).toBe('2026-11-05T10:00:00.500Z');
  });

  it('skips a stamp with an offset or without the Z', () => {
    for (const bad of ['2026-11-05T10:00:00+00:00', '2026-11-05T10:00:00', '2026-11-05T10:00Z']) {
      const payload = payloadOf(sample).replace('"2026-11-05T10:00:00Z"', JSON.stringify(bad));
      expect(skippedReason(envelope(payload)), bad).toBe('INVALID');
    }
  });

  it('skips a number that is not a safe integer', () => {
    const payload = payloadOf(sample).replace('"startingBalanceCents":150000', '"startingBalanceCents":9007199254740993');
    expect(skippedReason(envelope(payload))).toBe('INVALID');
  });

  it('skips a number written to look whole but with a hidden fraction', () => {
    const payload = payloadOf(sample).replace('"startingBalanceCents":150000', '"startingBalanceCents":150000.000000000000000000001');
    expect(skippedReason(envelope(payload))).toBe('INVALID');
  });

  it('reads the file name and the device name consistently', () => {
    expect(syncFileName('dev-1')).toBe('simple-budget-sync-dev-1.json');
    expect(deviceIdOfSyncFile('simple-budget-sync-dev-1.json')).toBe('dev-1');
    expect(deviceIdOfSyncFile('simple-budget-sync-.json')).toBeNull();
    expect(deviceIdOfSyncFile('simple-budget-sync-a b.json')).toBeNull();
    expect(deviceIdOfSyncFile('simple-budget-host-2026.db')).toBeNull();
    expect(deviceIdOfSyncFile('simple-budget-sync-dev-1.json.tmp')).toBeNull();
    expect(() => syncFileName('../x')).toThrow();
  });
});

describe('wholeOrNull', () => {
  it.each([
    ['0', 0],
    ['-0', 0],
    ['5', 5],
    ['-150000', -150000],
    ['5.0', 5],
    ['5000.000', 5000],
    ['1e5', 100000],
    ['1E+2', 100],
    ['15e-1', null],
    ['150e-2', null],
    ['1500e-2', 15],
    ['0e999999999', 0],
    ['0.0', 0],
    ['1.5', null],
    ['0.5', null],
    ['1e999999999', null],
    ['9007199254740991', 9007199254740991],
    ['-9007199254740991', -9007199254740991],
    ['9007199254740992', null],
    ['1e20', null],
    ['12345678901234567890', null],
    ['', null],
    ['abc', null],
    ['1.', null],
    ['.5', null],
    ['+5', null],
  ] as [string, number | null][])('%s -> %s', (text, expected) => {
    expect(wholeOrNull(text)).toBe(expected);
  });
});
