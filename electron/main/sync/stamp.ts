// Time stamps of the sync model (ADR-0008, ADR-0009 in the mobile repo).
//
// A stamp is text in the form Java's Instant.toString() writes: `2026-11-05T10:00:00Z`, with a fraction of a second
// only when there is one, in groups of three digits (`.500Z`, `.123456Z`). The mobile app writes and reads exactly this,
// so a stamp that went through either app compares and prints the same. Comparing is done on the instant, never on the
// text: `10:00:00Z` sorts after `10:00:00.500Z` as text and before it in time.
//
// Only this form is accepted (a `Z`, seconds present, up to nine digits of fraction). Java also reads offsets such as
// `+01:00`; a file with one is refused here rather than guessed at.

const STAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const NANOS_PER_SECOND = 1_000_000_000n;
const SECONDS_PER_DAY = 86_400n;

/** The day number (days since 1970-01-01) of a proleptic Gregorian date. */
function daysFromCivil(year: number, month: number, day: number): bigint {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return BigInt(era * 146_097 + dayOfEra - 719_468);
}

function civilFromDays(days: bigint): { year: number; month: number; day: number } {
  const z = Number(days) + 719_468;
  const era = Math.floor(z / 146_097);
  const dayOfEra = z - era * 146_097;
  const yearOfEra = Math.floor((dayOfEra - Math.floor(dayOfEra / 1_460) + Math.floor(dayOfEra / 36_524) - Math.floor(dayOfEra / 146_096)) / 365);
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const mp = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return { year, month, day };
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function validDate(year: number, month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/** True for an ISO calendar date such as `2026-11-05` that exists (no February 30). */
export function isIsoDate(text: string): boolean {
  const m = DATE.exec(text);
  return m !== null && validDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** Nanoseconds since the epoch of a stamp, or null when [text] is not a stamp in the accepted form. */
export function parseStamp(text: string): bigint | null {
  const m = STAMP.exec(text);
  if (m === null) return null;
  const [year, month, day, hour, minute, second] = [m[1], m[2], m[3], m[4], m[5], m[6]].map(Number);
  if (!validDate(year, month, day) || hour > 23 || minute > 59 || second > 59) return null;
  const fraction = BigInt((m[7] ?? '').padEnd(9, '0') || '0');
  const seconds = daysFromCivil(year, month, day) * SECONDS_PER_DAY + BigInt(hour * 3600 + minute * 60 + second);
  return seconds * NANOS_PER_SECOND + fraction;
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** The stamp for [nanos] since the epoch, written the way Instant.toString() writes it. */
export function formatStamp(nanos: bigint): string {
  const seconds = nanos >= 0n ? nanos / NANOS_PER_SECOND : -((-nanos + NANOS_PER_SECOND - 1n) / NANOS_PER_SECOND);
  const fraction = Number(nanos - seconds * NANOS_PER_SECOND);
  const days = seconds >= 0n ? seconds / SECONDS_PER_DAY : -((-seconds + SECONDS_PER_DAY - 1n) / SECONDS_PER_DAY);
  const inDay = Number(seconds - days * SECONDS_PER_DAY);
  const { year, month, day } = civilFromDays(days);
  let text = `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(Math.floor(inDay / 3600))}:${pad(Math.floor((inDay % 3600) / 60))}:${pad(inDay % 60)}`;
  if (fraction !== 0) {
    const digits = pad(fraction, 9);
    text += '.' + (fraction % 1_000_000 === 0 ? digits.slice(0, 3) : fraction % 1_000 === 0 ? digits.slice(0, 6) : digits);
  }
  return text + 'Z';
}

/** The stamp for a moment on this machine's clock. */
export function stampOf(date: Date): string {
  return formatStamp(BigInt(date.getTime()) * 1_000_000n);
}

const cache = new Map<string, bigint>();

/** Nanoseconds of a stamp that is known to be well formed. Throws on text that is not a stamp. */
export function nanosOf(stamp: string): bigint {
  let nanos = cache.get(stamp);
  if (nanos === undefined) {
    const parsed = parseStamp(stamp);
    if (parsed === null) throw new Error(`not a stamp: '${stamp}'`);
    if (cache.size > 50_000) cache.clear();
    cache.set(stamp, parsed);
    nanos = parsed;
  }
  return nanos;
}

/** Negative, zero or positive as [a] is before, the same instant as, or after [b]. */
export function compareStamps(a: string, b: string): number {
  const x = nanosOf(a);
  const y = nanosOf(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** The later of two stamps (the first when they are the same instant). */
export function laterOf(a: string, b: string): string {
  return compareStamps(b, a) > 0 ? b : a;
}

/** [stamp] cut back to a whole second. */
export function truncateToSeconds(stamp: string): string {
  const nanos = nanosOf(stamp);
  const seconds = nanos >= 0n ? nanos / NANOS_PER_SECOND : -((-nanos + NANOS_PER_SECOND - 1n) / NANOS_PER_SECOND);
  return formatStamp(seconds * NANOS_PER_SECOND);
}

/** [stamp] moved by [seconds] (negative moves back). */
export function addSeconds(stamp: string, seconds: number): string {
  return formatStamp(nanosOf(stamp) + BigInt(seconds) * NANOS_PER_SECOND);
}
