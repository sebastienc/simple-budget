import { describe, expect, it } from 'vitest';
import { addSeconds, compareStamps, formatStamp, isIsoDate, parseStamp, stampOf, truncateToSeconds } from './stamp.ts';

describe('stamps', () => {
  it('round-trip the form Instant.toString() writes', () => {
    for (const text of [
      '2026-11-05T10:00:00Z',
      '2026-11-05T10:00:00.500Z',
      '2026-11-05T10:00:00.123456Z',
      '2026-11-05T10:00:00.123456789Z',
      '1969-12-31T23:59:59Z',
      '1969-12-31T23:59:59.999Z',
      '2024-02-29T00:00:00Z',
      '0001-01-01T00:00:00Z',
      '9999-12-31T23:59:59Z',
    ]) {
      const nanos = parseStamp(text);
      expect(nanos, text).not.toBeNull();
      expect(formatStamp(nanos as bigint), text).toBe(text);
    }
  });

  it('writes a fraction in groups of three digits, and none when there is none', () => {
    expect(formatStamp(parseStamp('2026-11-05T10:00:00.5Z') as bigint)).toBe('2026-11-05T10:00:00.500Z');
    expect(formatStamp(parseStamp('2026-11-05T10:00:00.000Z') as bigint)).toBe('2026-11-05T10:00:00Z');
    expect(formatStamp(parseStamp('2026-11-05T10:00:00.1230Z') as bigint)).toBe('2026-11-05T10:00:00.123Z');
  });

  it('matches the platform for the epoch and for a known instant', () => {
    expect(parseStamp('1970-01-01T00:00:00Z')).toBe(0n);
    expect(parseStamp('2026-11-09T12:00:00Z')).toBe(BigInt(Date.parse('2026-11-09T12:00:00Z')) * 1_000_000n);
    expect(stampOf(new Date('2026-11-09T12:00:00.250Z'))).toBe('2026-11-09T12:00:00.250Z');
  });

  it.each([
    '',
    '2026-11-05',
    '2026-11-05T10:00Z',
    '2026-11-05T10:00:00',
    '2026-11-05T10:00:00+00:00',
    '2026-11-05T10:00:00z',
    '2026-11-05 10:00:00Z',
    '2026-11-05T10:00:00.Z',
    '2026-11-05T10:00:00.1234567890Z',
    '2026-02-30T10:00:00Z',
    '2026-13-01T10:00:00Z',
    '2026-11-05T24:00:00Z',
    '2026-11-05T10:60:00Z',
    '2026-11-05T10:00:60Z',
    '2023-02-29T00:00:00Z',
    ' 2026-11-05T10:00:00Z',
  ])('refuses %j', (text) => {
    expect(parseStamp(text)).toBeNull();
  });

  it('knows which dates exist', () => {
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2100-02-29')).toBe(false);
    expect(isIsoDate('2026-04-31')).toBe(false);
    expect(isIsoDate('2026-4-3')).toBe(false);
    expect(isIsoDate('2026-11-05T00:00:00Z')).toBe(false);
  });

  it('compares instants, truncates and moves', () => {
    expect(compareStamps('2026-11-05T10:00:00.500Z', '2026-11-05T10:00:00Z')).toBeGreaterThan(0);
    expect(compareStamps('2026-11-05T10:00:00Z', '2026-11-05T10:00:00.000Z')).toBe(0);
    expect(truncateToSeconds('2026-11-05T10:00:00.999Z')).toBe('2026-11-05T10:00:00Z');
    expect(truncateToSeconds('1969-12-31T23:59:59.500Z')).toBe('1969-12-31T23:59:59Z');
    expect(addSeconds('2026-11-05T23:59:59Z', 1)).toBe('2026-11-06T00:00:00Z');
  });
});
