import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { describeRecurrence, type RecurrenceDescribable } from './recurrence';

/**
 * Stands in for i18next: returns the key so a test asserts which key was
 * chosen, and appends the interpolated values so a dropped interval fails.
 */
const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}(${Object.entries(options)
    .map(([name, value]) => `${name}=${value}`)
    .join(',')})` : key) as unknown as TFunction;

function item(overrides: Partial<RecurrenceDescribable> = {}): RecurrenceDescribable {
  return {
    frequency: 'monthly',
    interval: 1,
    startDate: '2026-01-15',
    endDate: null,
    semiMonthlyDay1: null,
    semiMonthlyDay2: null,
    ...overrides,
  };
}

describe('describeRecurrence', () => {
  it('names the plain frequency when the interval is 1', () => {
    expect(describeRecurrence(item({ frequency: 'weekly' }), t)).toBe('FrequencyWeekly');
    expect(describeRecurrence(item({ frequency: 'yearly' }), t)).toBe('FrequencyYearly');
  });

  it('carries the interval for a bi-weekly mortgage', () => {
    expect(describeRecurrence(item({ frequency: 'weekly', interval: 2 }), t)).toBe('EveryNWeeks(interval=2)');
  });

  it('distinguishes every interval unit', () => {
    expect(describeRecurrence(item({ frequency: 'daily', interval: 3 }), t)).toBe('EveryNDays(interval=3)');
    expect(describeRecurrence(item({ frequency: 'monthly', interval: 2 }), t)).toBe('EveryNMonths(interval=2)');
    expect(describeRecurrence(item({ frequency: 'yearly', interval: 5 }), t)).toBe('EveryNYears(interval=5)');
  });

  it('keeps semi-monthly naming its two days, which have no interval', () => {
    expect(describeRecurrence(item({ frequency: 'semimonthly', semiMonthlyDay1: 15, semiMonthlyDay2: 30 }), t)).toBe('FrequencySemimonthly (15, 30)');
  });

  it('calls a start date equal to the end date a one-time payment', () => {
    expect(describeRecurrence(item({ frequency: 'daily', startDate: '2026-01-15', endDate: '2026-01-15' }), t)).toBe('OneTimePayment');
  });

  it('still describes the recurrence of an item that merely ends some day', () => {
    expect(describeRecurrence(item({ frequency: 'weekly', interval: 2, startDate: '2026-01-15', endDate: '2027-01-15' }), t)).toBe('EveryNWeeks(interval=2)');
  });
});
