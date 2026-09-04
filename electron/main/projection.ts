export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'semimonthly';

export interface RecurringItemInput {
  id: number;
  name: string;
  amountCents: number;
  frequency: Frequency;
  interval: number;
  startDate: string;
  endDate: string | null;
  semiMonthlyDay1?: number | null;
  semiMonthlyDay2?: number | null;
}

export interface ProjectionDay {
  date: string;
  items: { id: number; name: string; amountCents: number }[];
  dailyTotalCents: number;
  balanceCents: number;
  correctionApplied: boolean;
}

export interface BalanceCheckpoint {
  date: string;
  balanceCents: number;
}

export interface ProjectBalanceParams {
  checkpoints: BalanceCheckpoint[];
  items: RecurringItemInput[];
  from: string;
  to: string;
}

// Merges the account's implicit starting balance with any explicit
// reconciliation checkpoints, an explicit one winning if it shares the exact
// same date as the starting balance.
export function mergeCheckpoints(starting: BalanceCheckpoint, additional: BalanceCheckpoint[]): BalanceCheckpoint[] {
  const byDate = new Map<string, BalanceCheckpoint>();
  byDate.set(starting.date, starting);
  for (const checkpoint of additional) {
    byDate.set(checkpoint.date, checkpoint);
  }
  return [...byDate.values()];
}

function parseISODate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function daysBetween(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function shiftToPrecedingBusinessDay(date: Date): Date {
  const day = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
  if (day === 6) {
    return addDays(date, -1);
  }
  if (day === 0) {
    return addDays(date, -2);
  }
  return date;
}

function occursOn(item: RecurringItemInput, date: Date): boolean {
  const start = parseISODate(item.startDate);
  if (date.getTime() < start.getTime()) {
    return false;
  }
  if (item.endDate && date.getTime() > parseISODate(item.endDate).getTime()) {
    return false;
  }

  switch (item.frequency) {
    case 'daily':
      return daysBetween(start, date) % item.interval === 0;
    case 'weekly':
      return daysBetween(start, date) % (7 * item.interval) === 0;
    case 'monthly': {
      const months = monthsBetween(start, date);
      if (months % item.interval !== 0) {
        return false;
      }
      const targetDay = Math.min(start.getUTCDate(), lastDayOfMonth(date.getUTCFullYear(), date.getUTCMonth()));
      return date.getUTCDate() === targetDay;
    }
    case 'yearly': {
      const years = date.getUTCFullYear() - start.getUTCFullYear();
      if (years % item.interval !== 0) {
        return false;
      }
      const isStartFeb29 = start.getUTCMonth() === 1 && start.getUTCDate() === 29;
      const targetMonth = start.getUTCMonth();
      const targetDay = isStartFeb29 ? Math.min(29, lastDayOfMonth(date.getUTCFullYear(), 1)) : start.getUTCDate();
      return date.getUTCMonth() === targetMonth && date.getUTCDate() === targetDay;
    }
    case 'semimonthly': {
      if (!item.semiMonthlyDay1 || !item.semiMonthlyDay2) {
        return false;
      }
      // Check the surrounding months too: a weekend shift can cross a month
      // boundary (e.g. day 1 falling on a Saturday shifts back into the
      // previous month).
      for (const monthOffset of [-1, 0, 1]) {
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth() + monthOffset;
        const last = lastDayOfMonth(year, month);
        for (const rawDay of [item.semiMonthlyDay1, item.semiMonthlyDay2]) {
          const clamped = Math.min(rawDay, last);
          const candidate = shiftToPrecedingBusinessDay(new Date(Date.UTC(year, month, clamped)));
          if (candidate.getTime() === date.getTime()) {
            return true;
          }
        }
      }
      return false;
    }
  }
}

export function projectBalance(params: ProjectBalanceParams): ProjectionDay[] {
  const sortedCheckpoints = [...params.checkpoints].sort((a, b) => a.date.localeCompare(b.date));
  const anchor = parseISODate(sortedCheckpoints[0].date);
  const requestedFrom = parseISODate(params.from);
  const to = parseISODate(params.to);
  const outputFrom = requestedFrom.getTime() < anchor.getTime() ? anchor : requestedFrom;

  if (to.getTime() < outputFrom.getTime()) {
    return [];
  }

  // Walk every day from the anchor (not just from `outputFrom`) so the running
  // balance correctly accounts for days before the requested window, then only
  // emit rows from `outputFrom` onward. Whenever the cursor reaches a later
  // checkpoint's date, snap the running balance to it — discarding any
  // accumulated recurring-item drift, since a checkpoint represents a known
  // real value that should override the projection from that point forward.
  const days: ProjectionDay[] = [];
  let balanceCents = sortedCheckpoints[0].balanceCents;
  let nextCheckpointIndex = 1;

  for (let cursor = new Date(anchor); cursor.getTime() <= to.getTime(); cursor = addDays(cursor, 1)) {
    let correctionApplied = false;
    while (
      nextCheckpointIndex < sortedCheckpoints.length &&
      parseISODate(sortedCheckpoints[nextCheckpointIndex].date).getTime() <= cursor.getTime()
    ) {
      balanceCents = sortedCheckpoints[nextCheckpointIndex].balanceCents;
      nextCheckpointIndex += 1;
      correctionApplied = true;
    }

    const items = params.items
      .filter((item) => occursOn(item, cursor))
      .map((item) => ({ id: item.id, name: item.name, amountCents: item.amountCents }));
    const dailyTotalCents = items.reduce((sum, item) => sum + item.amountCents, 0);
    balanceCents += dailyTotalCents;

    if (cursor.getTime() >= outputFrom.getTime()) {
      days.push({
        date: formatISODate(cursor),
        items,
        dailyTotalCents,
        balanceCents,
        correctionApplied,
      });
    }
  }

  return days;
}

export interface NetWorthDay {
  date: string;
  totalCents: number;
}

// Every series passed in must be computed over the exact same [from, to]
// range, so they're always the same length with positionally-aligned dates —
// no date-matching by string needed.
export function sumProjections(seriesList: ProjectionDay[][]): NetWorthDay[] {
  if (seriesList.length === 0) {
    return [];
  }
  return seriesList[0].map((_, i) => ({
    date: seriesList[0][i].date,
    totalCents: seriesList.reduce((sum, series) => sum + series[i].balanceCents, 0),
  }));
}

function findNextOccurrence(item: RecurringItemInput, from: Date, maxDays = 3660): Date | null {
  for (let i = 0; i <= maxDays; i++) {
    const candidate = addDays(from, i);
    if (occursOn(item, candidate)) {
      return candidate;
    }
  }
  return null;
}

const DAYS_PER_MONTH = 30.4368;

/**
 * The item's own recurrence period, in months — a yearly bill is 12, a
 * quarterly one (monthly × 3) is 3, a semi-monthly one is 0.5.
 */
function periodInMonths(item: RecurringItemInput): number {
  const interval = Math.max(item.interval, 1);
  switch (item.frequency) {
    case 'daily':
      return interval / DAYS_PER_MONTH;
    case 'weekly':
      return (interval * 7) / DAYS_PER_MONTH;
    case 'monthly':
      return interval;
    case 'yearly':
      return interval * 12;
    case 'semimonthly':
      return 0.5;
  }
}

export interface SinkingFundContribution {
  nextOccurrenceDate: string | null;
  suggestedMonthlySetAsideCents: number | null;
}

/**
 * What a lump-sum recurring item costs per month, amortized over its full
 * period: a 1,200 yearly tax bill is 100 a month.
 *
 * Deliberately derived from the recurrence rule rather than from the gap to the
 * next occurrence. Measuring the remaining gap would make the figure creep
 * upward every single day as the due date approaches — and for an item whose
 * first occurrence hasn't happened yet, it would compress the whole bill into
 * however few months happen to be left. Amortizing over the period gives a
 * stable number that means "this is what this bill costs me monthly".
 *
 * For sub-monthly frequencies this is correctly greater than one occurrence:
 * a weekly 100 costs about 433 a month.
 */
export function computeSinkingFundContribution(item: RecurringItemInput, todayIso: string): SinkingFundContribution {
  const next = findNextOccurrence(item, parseISODate(todayIso));
  if (!next) {
    return { nextOccurrenceDate: null, suggestedMonthlySetAsideCents: null };
  }
  return {
    nextOccurrenceDate: formatISODate(next),
    suggestedMonthlySetAsideCents: Math.round(item.amountCents / periodInMonths(item)),
  };
}
