import type { TFunction } from 'i18next';
import type { Frequency } from '@/data/useRecurringItems';

/** Just the fields that decide how a recurrence is described. */
export interface RecurrenceDescribable {
  frequency: Frequency;
  interval: number;
  startDate: string;
  endDate: string | null;
  semiMonthlyDay1: number | null;
  semiMonthlyDay2: number | null;
}

/** `daily` → `EveryNDays`. Semi-monthly has no interval, so it isn't here. */
const INTERVAL_KEY: Partial<Record<Frequency, string>> = {
  daily: 'EveryNDays',
  weekly: 'EveryNWeeks',
  monthly: 'EveryNMonths',
  yearly: 'EveryNYears',
};

/**
 * How a recurring item's schedule reads in the list.
 *
 * The interval has to be part of this. A mortgage paid every two weeks is
 * stored as `weekly` with interval 2, and naming it "Weekly" beside its amount
 * describes an item paying twice as often for twice the money — the one place
 * the list can mislead about how much leaves the account.
 *
 * The count is interpolated as `interval` rather than i18next's `count` on
 * purpose: this branch only runs for intervals of 2 and up, where every
 * supported language takes the plural, so involving the plural machinery would
 * add two keys per unit that differ from each other in no language we ship.
 */
export function describeRecurrence(item: RecurrenceDescribable, t: TFunction): string {
  if (item.endDate && item.endDate === item.startDate) {
    return t('OneTimePayment');
  }

  if (item.frequency === 'semimonthly') {
    return `${t('FrequencySemimonthly')} (${item.semiMonthlyDay1}, ${item.semiMonthlyDay2})`;
  }

  const key = INTERVAL_KEY[item.frequency];
  if (key && item.interval > 1) {
    return t(key, { interval: item.interval });
  }

  return t(`Frequency${item.frequency.charAt(0).toUpperCase()}${item.frequency.slice(1)}`);
}
