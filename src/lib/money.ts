import i18next from 'i18next';

/**
 * Formats cents as a currency amount, following the active language: an
 * English user sees `$1,234.56`, a French one `1 234,56 $`.
 */
export function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat(i18next.language || 'en', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

/**
 * Whole units, no decimal places — for chart axis ticks, where cents are noise
 * and every extra glyph competes with the data.
 */
export function formatCentsAxis(cents: number, currency: string): string {
  return new Intl.NumberFormat(i18next.language || 'en', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** Same as {@link formatCents}, but always carries an explicit + or −. */
export function formatCentsSigned(cents: number, currency: string): string {
  const sign = cents < 0 ? '−' : '+';
  return `${sign}${formatCents(Math.abs(cents), currency)}`;
}

/** Parses a form field's amount (a plain decimal string) into cents. */
export function parseAmountToCents(value: string): number {
  return Math.round(parseFloat(value || '0') * 100);
}

/**
 * Cents as an editable decimal string for seeding a number input.
 * Intentionally unformatted — a grouped or localized string is not a valid
 * `<input type="number">` value.
 */
export function centsToInputValue(cents: number): string {
  return String(cents / 100);
}
