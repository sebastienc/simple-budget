const DAYS_PER_MONTH = 30.4368;

/** The parts of a balance correction this calculation needs. */
export interface AccuracyInput {
  driftCents: number | null;
  daysSincePrevious: number | null;
}

export interface AccuracySummary {
  /** Corrections that actually have a drift measurement behind them. */
  measuredCount: number;
  totalDriftCents: number;
  /** Drift expressed as a monthly rate, so it stays comparable as corrections accumulate. */
  driftPerMonthCents: number;
  /** True when the forecast has been optimistic — there is less money than it said. */
  runsHigh: boolean;
}

/**
 * How the forecast has been performing overall.
 *
 * Reported as a rate rather than a total: a total grows simply because time
 * passes, so it can't tell you whether the model is getting better or worse.
 * Dividing the accumulated drift by the days it accumulated over gives a figure
 * that means the same thing after one correction as after twenty.
 *
 * Returns null until there is something to say — the earliest correction is an
 * origin with nothing behind it, so a freshly reconciled account has no rate.
 */
export function summarizeAccuracy(corrections: AccuracyInput[]): AccuracySummary | null {
  const measured = corrections.filter(
    (correction): correction is { driftCents: number; daysSincePrevious: number } =>
      correction.driftCents !== null && correction.daysSincePrevious !== null && correction.daysSincePrevious > 0,
  );

  if (measured.length === 0) {
    return null;
  }

  const totalDriftCents = measured.reduce((sum, correction) => sum + correction.driftCents, 0);
  const totalDays = measured.reduce((sum, correction) => sum + correction.daysSincePrevious, 0);

  return {
    measuredCount: measured.length,
    totalDriftCents,
    driftPerMonthCents: Math.round((totalDriftCents / totalDays) * DAYS_PER_MONTH),
    runsHigh: totalDriftCents > 0,
  };
}
