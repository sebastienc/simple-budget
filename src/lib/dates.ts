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

/**
 * Formats an ISO "YYYY-MM-DD" calendar date for display without any timezone
 * conversion — building the Date from local Y/M/D components (not a UTC
 * timestamp) keeps date-fns' locale-time `format` from shifting the day.
 */
export function formatISODate(isoDate: string, pattern: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return format(new Date(year, month - 1, day), pattern, { locale: activeLocale() });
}
