import type { ProjectionDay } from '@/data/useProjection';

export interface ProjectionEvent {
  date: string;
  items: { id: number; name: string; amountCents: number }[];
  dailyTotalCents: number;
}

export interface ProjectionSummary {
  /** Balance on the first day of the projected window. */
  openingCents: number;
  /** Balance on the last day of the projected window. */
  closingCents: number;
  /** The lowest end-of-day balance in the window, and the day it happens. */
  lowest: { cents: number; date: string };
  /** First day the balance is below zero, if any. */
  firstNegativeDate: string | null;
  /** The day the projection ends — what the copy means by "through". */
  lastDate: string;
  /** Days carrying at least one recurring item, soonest first. */
  events: ProjectionEvent[];
}

/**
 * Everything the hero and the "what's coming" panel need, derived purely from
 * the day-by-day array the projection endpoint already returns. Rows are
 * contiguous (one per calendar day) and ascending, so a single pass is enough.
 *
 * Note every figure is scoped to the *requested window*: "lowest" means lowest
 * between `from` and `to`, not lowest ever. The copy should say so.
 */
export function summarizeProjection(days: ProjectionDay[]): ProjectionSummary | null {
  if (days.length === 0) {
    return null;
  }

  let lowest = days[0];
  let firstNegativeDate: string | null = null;
  const events: ProjectionEvent[] = [];

  for (const day of days) {
    if (day.balanceCents < lowest.balanceCents) {
      lowest = day;
    }
    if (firstNegativeDate === null && day.balanceCents < 0) {
      firstNegativeDate = day.date;
    }
    if (day.items.length > 0) {
      events.push({ date: day.date, items: day.items, dailyTotalCents: day.dailyTotalCents });
    }
  }

  return {
    openingCents: days[0].balanceCents,
    closingCents: days[days.length - 1].balanceCents,
    lowest: { cents: lowest.balanceCents, date: lowest.date },
    firstNegativeDate,
    lastDate: days[days.length - 1].date,
    events,
  };
}
