import { describe, expect, it, vi } from 'vitest';
import i18next from 'i18next';
import { formatISODate, formatInstant, monthsBetweenISO, todayISO, toISODate } from './dates';

describe('todayISO', () => {
  it('reads the local calendar date, not UTC', () => {
    // 23:30 local on Jan 15 must still read as Jan 15 — toISODate builds from
    // local Y/M/D components, not a UTC timestamp that could roll to the 16th.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 23, 30));
    expect(todayISO()).toBe('2026-01-15');
    vi.useRealTimers();
  });
});

describe('toISODate', () => {
  it('formats local Y/M/D components, ignoring the time of day', () => {
    expect(toISODate(new Date(2026, 8, 4, 0, 0))).toBe('2026-09-04');
    expect(toISODate(new Date(2026, 8, 4, 23, 59))).toBe('2026-09-04');
  });

  it('zero-pads single-digit months and days', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('monthsBetweenISO', () => {
  it('is zero for the same date', () => {
    expect(monthsBetweenISO('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('is negative when `to` is earlier than `from`', () => {
    expect(monthsBetweenISO('2026-02-01', '2026-01-01')).toBeLessThan(0);
  });

  it('reports roughly one month for a 30-day gap', () => {
    expect(monthsBetweenISO('2026-01-01', '2026-01-31')).toBeCloseTo(1, 0);
  });
});

describe('formatISODate', () => {
  it('does not shift the day when the pattern includes no time component', () => {
    // A UTC timestamp for this date would land on Sept 3rd anywhere west of
    // Greenwich; building from local Y/M/D components must not do that.
    expect(formatISODate('2026-09-04', 'yyyy-MM-dd')).toBe('2026-09-04');
  });

  it('formats in French when the active language is French', () => {
    i18next.language = 'fr-CA';
    expect(formatISODate('2026-09-04', 'MMMM')).toBe('septembre');
  });

  it('formats in English otherwise', () => {
    i18next.language = 'en-US';
    expect(formatISODate('2026-09-04', 'MMMM')).toBe('September');
  });
});

describe('formatInstant', () => {
  it('converts a UTC instant to the reader\'s local time, unlike formatISODate', () => {
    // formatInstant deliberately does the opposite of formatISODate: this is
    // a moment in time (with a zone), not a calendar date.
    const localMidnightUTC = new Date(2026, 0, 1).toISOString();
    expect(formatInstant(localMidnightUTC, 'yyyy-MM-dd')).toBe('2026-01-01');
  });

  it('formats in French when the active language is French', () => {
    i18next.language = 'fr-CA';
    expect(formatInstant('2026-09-04T12:00:00.000Z', 'MMMM')).toBe('septembre');
  });
});
