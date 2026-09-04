import { format } from 'date-fns';
import { enUS, frCA } from 'date-fns/locale';
import i18next from 'i18next';

/**
 * date-fns formats in English unless handed a locale, so every display format
 * has to pass one or a French user gets "le 4 September 2026".
 */
function activeLocale() {
  return (i18next.language || 'en').startsWith('fr') ? frCA : enUS;
}

/**
 * Today as an ISO "YYYY-MM-DD" calendar date, in the user's *local* zone.
 *
 * Deliberately not `new Date().toISOString().slice(0, 10)` — that is UTC, so
 * anywhere west of Greenwich it starts reporting tomorrow partway through the
 * evening (in Quebec, from ~19:00 local).
 */
export function todayISO(): string {
  return toISODate(new Date());
}

/**
 * A `Date` as an ISO "YYYY-MM-DD" calendar date, in the user's local zone.
 * No locale: this is a machine format for the API, not display text.
 */
export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

const DAYS_PER_MONTH = 30.4368;

/** Whole days from one ISO calendar date to another; negative if `to` is earlier. */
function daysBetweenISO(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split('-').map(Number);
  const [ty, tm, td] = toISO.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** Months from one ISO calendar date to another, as a fraction. */
export function monthsBetweenISO(fromISO: string, toISO: string): number {
  return daysBetweenISO(fromISO, toISO) / DAYS_PER_MONTH;
}

/**
 * Formats an ISO "YYYY-MM-DD" calendar date for display without any timezone
 * conversion — building the Date from local Y/M/D components (not a UTC
 * timestamp) keeps date-fns' locale-time `format` from shifting the day.
 */
export function formatISODate(isoDate: string, pattern: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return format(new Date(year, month - 1, day), pattern, { locale: activeLocale() });
}
