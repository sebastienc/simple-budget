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
}

export interface ProjectBalanceParams {
  startingBalanceCents: number;
  startingBalanceDate: string;
  items: RecurringItemInput[];
  from: string;
  to: string;
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
  const anchor = parseISODate(params.startingBalanceDate);
  const requestedFrom = parseISODate(params.from);
  const to = parseISODate(params.to);
  const outputFrom = requestedFrom.getTime() < anchor.getTime() ? anchor : requestedFrom;

  if (to.getTime() < outputFrom.getTime()) {
    return [];
  }

  // Walk every day from the anchor (not just from `outputFrom`) so the running
  // balance correctly accounts for days before the requested window, then only
  // emit rows from `outputFrom` onward.
  const days: ProjectionDay[] = [];
  let balanceCents = params.startingBalanceCents;

  for (let cursor = new Date(anchor); cursor.getTime() <= to.getTime(); cursor = addDays(cursor, 1)) {
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
      });
    }
  }

  return days;
}
