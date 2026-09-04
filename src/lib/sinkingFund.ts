import { monthsBetweenISO } from './dates';

/** The parts of a recurring item this calculation needs. */
export interface SinkingFundItem {
  sinkingFund: boolean;
  amountCents: number;
  nextOccurrenceDate: string | null;
  suggestedMonthlySetAsideCents: number | null;
}

export interface SinkingFundSummary {
  /** What these bills cost per month, amortized over their own periods. */
  ongoingCents: number;
  /** What you'd need to set aside monthly, starting today, to have each one covered when it lands. */
  catchUpCents: number;
  /** True when nothing has been put aside yet and the ongoing rate won't get there in time. */
  isBehind: boolean;
}

/**
 * The two numbers worth knowing about a set of sinking-fund bills, and the gap
 * between them.
 *
 * `ongoing` is the steady-state cost — what the bills are worth per month once
 * you've been saving all along. `catchUp` is what it takes from today, given
 * that nothing has been set aside yet. When a bill is three months out but
 * amortizes over twelve, the second number is four times the first, and that
 * difference is precisely the "you are behind" signal.
 *
 * Each bill catches up at its own rate against its own due date, so the total
 * is correct even when they land in different months. A bill due within a month
 * is floored at one month, which reads as "you need the whole thing now" rather
 * than an inflated multiple of it.
 */
export function summarizeSinkingFunds(items: SinkingFundItem[], todayISO: string): SinkingFundSummary | null {
  const funded = items.filter((item) => item.sinkingFund && item.suggestedMonthlySetAsideCents !== null && item.nextOccurrenceDate !== null);
  if (funded.length === 0) {
    return null;
  }

  // Set-aside figures carry the sign of the outflow they came from; a set-aside
  // is a magnitude.
  const ongoingCents = funded.reduce((sum, item) => sum + Math.abs(item.suggestedMonthlySetAsideCents ?? 0), 0);

  const catchUpCents = Math.round(
    funded.reduce((sum, item) => {
      const months = Math.max(monthsBetweenISO(todayISO, item.nextOccurrenceDate ?? todayISO), 1);
      return sum + Math.abs(item.amountCents) / months;
    }, 0),
  );

  // Months are measured in real days against an average month length, so a bill
  // exactly one period away lands a fraction of a percent off its ongoing rate.
  // Require a material gap, or every account would permanently read "behind".
  const MATERIAL_GAP = 1.05;

  return { ongoingCents, catchUpCents, isBehind: catchUpCents > ongoingCents * MATERIAL_GAP };
}
