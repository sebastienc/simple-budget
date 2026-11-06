// Inputs for the golden vectors. Only inputs live here; the expected values are
// produced by running the real engine (see generate.ts), never written by hand.
//
// The mobile app (simple-budget-mobile) ports the projection engine to Kotlin
// and checks its port against the generated file, so a case belongs here when
// the *behaviour* is easy to get subtly wrong in a port: month-end clamping,
// leap years, weekend shifts across month boundaries, checkpoint snapping,
// rounding, window edges.
//
// Keep this file free of non-erasable TypeScript (enums, parameter properties):
// scripts/generate-golden-vectors.mjs runs it through Node's type stripping.

import type { BalanceCheckpoint, RecurringItemInput } from '../../electron/main/projection.ts';

export function item(overrides: Partial<RecurringItemInput> = {}): RecurringItemInput {
  return {
    id: 1,
    name: 'Item',
    amountCents: -10000,
    frequency: 'monthly',
    interval: 1,
    startDate: '2026-01-01',
    endDate: null,
    semiMonthlyDay1: null,
    semiMonthlyDay2: null,
    ...overrides,
  };
}

export interface ProjectBalanceCase {
  name: string;
  checkpoints: BalanceCheckpoint[];
  items: RecurringItemInput[];
  from: string;
  to: string;
}

const origin = (date: string, balanceCents = 0): BalanceCheckpoint[] => [{ date, balanceCents }];

export const projectBalanceCases: ProjectBalanceCase[] = [
  {
    name: 'daily, interval 1, starting inside the window',
    checkpoints: origin('2026-03-01', 50000),
    items: [item({ frequency: 'daily', amountCents: -250, startDate: '2026-03-03' })],
    from: '2026-03-01',
    to: '2026-03-20',
  },
  {
    name: 'daily, interval 3',
    checkpoints: origin('2026-03-01'),
    items: [item({ frequency: 'daily', interval: 3, amountCents: -100, startDate: '2026-03-02' })],
    from: '2026-03-01',
    to: '2026-04-05',
  },
  {
    name: 'weekly, interval 1',
    checkpoints: origin('2026-01-01', 100000),
    items: [item({ frequency: 'weekly', amountCents: -4500, startDate: '2026-01-05' })],
    from: '2026-01-01',
    to: '2026-03-31',
  },
  {
    name: 'weekly, interval 2 (every other week)',
    checkpoints: origin('2026-01-01', 100000),
    items: [item({ frequency: 'weekly', interval: 2, amountCents: 180000, startDate: '2026-01-09' })],
    from: '2026-01-01',
    to: '2026-06-30',
  },
  {
    name: 'monthly on the 31st clamps into short months (2026)',
    checkpoints: origin('2026-01-01'),
    items: [item({ frequency: 'monthly', amountCents: -12345, startDate: '2026-01-31' })],
    from: '2026-01-01',
    to: '2026-12-31',
  },
  {
    name: 'monthly on the 29th, 30th and 31st through a leap February (2028)',
    checkpoints: origin('2028-01-01'),
    items: [
      item({ id: 1, name: 'On the 29th', frequency: 'monthly', amountCents: -100, startDate: '2027-11-29' }),
      item({ id: 2, name: 'On the 30th', frequency: 'monthly', amountCents: -200, startDate: '2027-11-30' }),
      item({ id: 3, name: 'On the 31st', frequency: 'monthly', amountCents: -400, startDate: '2027-10-31' }),
    ],
    from: '2028-01-01',
    to: '2028-04-30',
  },
  {
    name: 'monthly, interval 3 (quarterly)',
    checkpoints: origin('2026-01-01', 500000),
    items: [item({ frequency: 'monthly', interval: 3, amountCents: -90000, startDate: '2026-01-15' })],
    from: '2026-01-01',
    to: '2027-03-31',
  },
  {
    name: 'monthly, interval 5 crossing a year boundary',
    checkpoints: origin('2026-01-01'),
    items: [item({ frequency: 'monthly', interval: 5, amountCents: -7000, startDate: '2026-03-10' })],
    from: '2026-01-01',
    to: '2028-01-31',
  },
  {
    name: 'yearly on Feb 29 across a non-leap and a leap year, window starting long after the anchor',
    checkpoints: origin('2024-02-01', 1000000),
    items: [item({ frequency: 'yearly', amountCents: -29900, startDate: '2024-02-29' })],
    from: '2027-02-01',
    to: '2028-03-05',
  },
  {
    name: 'yearly, interval 2',
    checkpoints: origin('2026-01-01'),
    items: [item({ frequency: 'yearly', interval: 2, amountCents: -60000, startDate: '2026-06-15' })],
    from: '2026-01-01',
    to: '2031-12-31',
  },
  {
    name: 'semi-monthly 15 and last-ish (30) with Saturday and Sunday paydays shifting back',
    checkpoints: origin('2026-01-01', 200000),
    items: [item({ frequency: 'semimonthly', amountCents: 250000, startDate: '2026-01-01', semiMonthlyDay1: 15, semiMonthlyDay2: 30 })],
    from: '2026-01-01',
    to: '2026-12-31',
  },
  {
    name: 'semi-monthly 1 and 15: the 1st falling on a weekend shifts into the previous month',
    checkpoints: origin('2026-06-01'),
    items: [item({ frequency: 'semimonthly', amountCents: 100000, startDate: '2026-06-01', semiMonthlyDay1: 1, semiMonthlyDay2: 15 })],
    from: '2026-06-01',
    to: '2026-11-30',
  },
  {
    name: 'semi-monthly day 31 clamps to the end of a short month before shifting (incl. leap February)',
    checkpoints: origin('2027-12-01'),
    items: [item({ frequency: 'semimonthly', amountCents: 80000, startDate: '2027-12-01', semiMonthlyDay1: 15, semiMonthlyDay2: 31 })],
    from: '2027-12-01',
    to: '2028-04-30',
  },
  {
    name: 'semi-monthly respects start and end dates',
    checkpoints: origin('2026-01-01'),
    items: [item({ frequency: 'semimonthly', amountCents: 50000, startDate: '2026-02-10', endDate: '2026-05-20', semiMonthlyDay1: 5, semiMonthlyDay2: 20 })],
    from: '2026-01-01',
    to: '2026-07-31',
  },
  {
    name: 'semi-monthly with a missing day never occurs',
    checkpoints: origin('2026-01-01', 1000),
    items: [item({ frequency: 'semimonthly', amountCents: 50000, startDate: '2026-01-01', semiMonthlyDay1: 15, semiMonthlyDay2: null })],
    from: '2026-01-01',
    to: '2026-02-28',
  },
  {
    name: 'end date stops an item, and the end day itself is included',
    checkpoints: origin('2026-01-01'),
    items: [item({ frequency: 'monthly', amountCents: -5000, startDate: '2026-01-10', endDate: '2026-04-10' })],
    from: '2026-01-01',
    to: '2026-06-30',
  },
  {
    name: 'one-time payment: end date equals start date',
    checkpoints: origin('2026-01-01', 100000),
    items: [item({ frequency: 'yearly', amountCents: -45000, startDate: '2026-03-12', endDate: '2026-03-12' })],
    from: '2026-01-01',
    to: '2027-06-30',
  },
  {
    name: 'item that starts after the window ends contributes nothing',
    checkpoints: origin('2026-01-01', 100000),
    items: [item({ frequency: 'daily', amountCents: -100, startDate: '2026-12-01' })],
    from: '2026-01-01',
    to: '2026-01-31',
  },
  {
    name: 'item that started before the anchor does not back-fill, only counts from the anchor',
    checkpoints: origin('2026-06-01', 100000),
    items: [item({ frequency: 'weekly', amountCents: -1000, startDate: '2025-01-01' })],
    from: '2026-06-01',
    to: '2026-07-15',
  },
  {
    name: 'several items on the same day, mixed income and expense, in input order',
    checkpoints: origin('2026-01-01', 10000),
    items: [
      item({ id: 7, name: 'Rent', frequency: 'monthly', amountCents: -150000, startDate: '2026-01-01' }),
      item({ id: 3, name: 'Salary', frequency: 'monthly', amountCents: 400000, startDate: '2026-01-01' }),
      item({ id: 5, name: 'Phone', frequency: 'monthly', amountCents: -6500, startDate: '2026-01-01' }),
    ],
    from: '2026-01-01',
    to: '2026-03-05',
  },
  {
    name: 'checkpoint snaps the balance and flags only that day; its own day still applies items',
    checkpoints: [
      { date: '2026-01-01', balanceCents: 100000 },
      { date: '2026-02-15', balanceCents: 55000 },
    ],
    items: [item({ frequency: 'monthly', amountCents: -20000, startDate: '2026-01-15' })],
    from: '2026-01-01',
    to: '2026-03-31',
  },
  {
    name: 'several checkpoints supplied out of order are sorted before use',
    checkpoints: [
      { date: '2026-03-01', balanceCents: 30000 },
      { date: '2026-01-01', balanceCents: 100000 },
      { date: '2026-02-01', balanceCents: 70000 },
    ],
    items: [item({ frequency: 'weekly', amountCents: -2500, startDate: '2026-01-02' })],
    from: '2026-01-01',
    to: '2026-04-15',
  },
  {
    name: 'two checkpoints before the window both apply, accumulation starts from the anchor',
    checkpoints: [
      { date: '2026-01-01', balanceCents: 100000 },
      { date: '2026-02-01', balanceCents: 90000 },
      { date: '2026-03-01', balanceCents: 80000 },
    ],
    items: [item({ frequency: 'daily', amountCents: -100, startDate: '2026-01-01' })],
    from: '2026-03-10',
    to: '2026-03-20',
  },
  {
    name: 'checkpoint after the window end never applies',
    checkpoints: [
      { date: '2026-01-01', balanceCents: 100000 },
      { date: '2026-06-01', balanceCents: 1 },
    ],
    items: [item({ frequency: 'weekly', amountCents: -1000, startDate: '2026-01-01' })],
    from: '2026-01-01',
    to: '2026-02-28',
  },
  {
    name: 'window starting before the anchor is clamped to the anchor',
    checkpoints: origin('2026-02-01', 20000),
    items: [item({ frequency: 'daily', amountCents: -100, startDate: '2026-01-01' })],
    from: '2026-01-15',
    to: '2026-02-10',
  },
  {
    name: 'window ending before it starts is empty',
    checkpoints: origin('2026-01-01', 100000),
    items: [item({ frequency: 'daily', amountCents: -100, startDate: '2026-01-01' })],
    from: '2026-03-10',
    to: '2026-03-01',
  },
  {
    name: 'window ending before the anchor is empty',
    checkpoints: origin('2026-06-01', 100000),
    items: [item({ frequency: 'daily', amountCents: -100, startDate: '2026-01-01' })],
    from: '2026-01-01',
    to: '2026-05-31',
  },
  {
    name: 'single-day window on the anchor',
    checkpoints: origin('2026-06-01', 100000),
    items: [item({ frequency: 'daily', amountCents: -100, startDate: '2026-01-01' })],
    from: '2026-06-01',
    to: '2026-06-01',
  },
  {
    name: 'no items',
    checkpoints: origin('2026-01-01', 12345),
    items: [],
    from: '2026-01-01',
    to: '2026-01-10',
  },
  {
    name: 'negative opening balance with income pulling it back up',
    checkpoints: origin('2026-01-01', -50000),
    items: [item({ frequency: 'weekly', amountCents: 30000, startDate: '2026-01-02' })],
    from: '2026-01-01',
    to: '2026-02-15',
  },
];

export interface MergeCheckpointsCase {
  name: string;
  starting: BalanceCheckpoint;
  additional: BalanceCheckpoint[];
}

export const mergeCheckpointsCases: MergeCheckpointsCase[] = [
  {
    name: 'an explicit checkpoint on the starting date replaces the starting balance',
    starting: { date: '2026-01-01', balanceCents: 100 },
    additional: [{ date: '2026-01-01', balanceCents: 999 }],
  },
  {
    name: 'checkpoints on other dates are kept alongside the starting balance',
    starting: { date: '2026-01-01', balanceCents: 100 },
    additional: [
      { date: '2026-02-01', balanceCents: 200 },
      { date: '2026-03-01', balanceCents: 300 },
    ],
  },
  {
    name: 'a later duplicate date wins over an earlier one',
    starting: { date: '2026-01-01', balanceCents: 100 },
    additional: [
      { date: '2026-02-01', balanceCents: 200 },
      { date: '2026-02-01', balanceCents: 250 },
    ],
  },
  {
    name: 'no additional checkpoints',
    starting: { date: '2026-01-01', balanceCents: 100 },
    additional: [],
  },
];

export interface SumProjectionsCase {
  name: string;
  /** Each series is a projectBalance call over the same window. */
  series: Omit<ProjectBalanceCase, 'name'>[];
}

export const sumProjectionsCases: SumProjectionsCase[] = [
  {
    name: 'two accounts over the same window add positionally',
    series: [
      { checkpoints: origin('2026-01-01', 100000), items: [item({ frequency: 'weekly', amountCents: -2000, startDate: '2026-01-02' })], from: '2026-01-01', to: '2026-01-31' },
      { checkpoints: origin('2026-01-01', 500000), items: [item({ frequency: 'monthly', amountCents: 150000, startDate: '2026-01-15' })], from: '2026-01-01', to: '2026-01-31' },
    ],
  },
  {
    name: 'a single account is returned as totals',
    series: [{ checkpoints: origin('2026-01-01', 1000), items: [], from: '2026-01-01', to: '2026-01-05' }],
  },
  {
    name: 'no accounts gives nothing',
    series: [],
  },
];

export interface SinkingFundCase {
  name: string;
  item: RecurringItemInput;
  today: string;
}

export const sinkingFundCases: SinkingFundCase[] = [
  { name: 'yearly bill amortizes over twelve months', item: item({ frequency: 'yearly', amountCents: -120000, startDate: '2026-12-01' }), today: '2026-09-04' },
  { name: 'yearly interval 2 amortizes over twenty-four months', item: item({ frequency: 'yearly', interval: 2, amountCents: -240000, startDate: '2027-05-01' }), today: '2026-09-04' },
  { name: 'monthly interval 3 (quarterly) amortizes over three months', item: item({ frequency: 'monthly', interval: 3, amountCents: -30000, startDate: '2026-10-01' }), today: '2026-09-04' },
  { name: 'semi-monthly counts half a month', item: item({ frequency: 'semimonthly', amountCents: -50000, semiMonthlyDay1: 15, semiMonthlyDay2: 30 }), today: '2026-09-04' },
  { name: 'weekly uses 30.4368 days per month', item: item({ frequency: 'weekly', amountCents: -10000, startDate: '2026-09-07' }), today: '2026-09-04' },
  { name: 'weekly interval 2', item: item({ frequency: 'weekly', interval: 2, amountCents: -10000, startDate: '2026-09-07' }), today: '2026-09-04' },
  { name: 'daily uses 30.4368 days per month', item: item({ frequency: 'daily', amountCents: -100, startDate: '2026-01-01' }), today: '2026-09-04' },
  { name: 'daily interval 10', item: item({ frequency: 'daily', interval: 10, amountCents: -1000, startDate: '2026-01-01' }), today: '2026-09-04' },
  { name: 'the figure is the same a month out', item: item({ frequency: 'yearly', amountCents: -120000, startDate: '2026-12-01' }), today: '2026-11-01' },
  { name: 'the figure is the same the day before it is due', item: item({ frequency: 'yearly', amountCents: -120000, startDate: '2026-12-01' }), today: '2026-11-30' },
  { name: 'due today counts as the next occurrence', item: item({ frequency: 'yearly', amountCents: -120000, startDate: '2026-12-01' }), today: '2026-12-01' },
  { name: 'income gives a positive set-aside', item: item({ frequency: 'yearly', amountCents: 120000, startDate: '2026-12-01' }), today: '2026-09-04' },
  { name: 'half a cent rounds toward positive infinity (negative: -2.5 becomes -2)', item: item({ frequency: 'monthly', interval: 2, amountCents: -5, startDate: '2026-10-01' }), today: '2026-09-04' },
  { name: 'half a cent rounds toward positive infinity (positive: 2.5 becomes 3)', item: item({ frequency: 'monthly', interval: 2, amountCents: 5, startDate: '2026-10-01' }), today: '2026-09-04' },
  { name: 'a fraction below half a cent rounds to zero', item: item({ frequency: 'monthly', interval: 3, amountCents: -1, startDate: '2026-10-01' }), today: '2026-09-04' },
  { name: 'an item that already ended has no next occurrence', item: item({ frequency: 'yearly', amountCents: -120000, startDate: '2020-01-01', endDate: '2021-01-01' }), today: '2026-09-04' },
  { name: 'a one-time item in the past has no next occurrence', item: item({ frequency: 'yearly', amountCents: -1000, startDate: '2026-03-01', endDate: '2026-03-01' }), today: '2026-09-04' },
  { name: 'yearly Feb 29 finds the next real occurrence', item: item({ frequency: 'yearly', amountCents: -29900, startDate: '2024-02-29' }), today: '2026-09-04' },
  { name: 'the search stops after 3660 days, so a first occurrence beyond that is not found', item: item({ frequency: 'yearly', amountCents: -120000, startDate: '2040-01-01' }), today: '2026-09-04' },
  { name: 'semi-monthly with a missing day has no next occurrence', item: item({ frequency: 'semimonthly', amountCents: -50000, semiMonthlyDay1: 15, semiMonthlyDay2: null }), today: '2026-09-04' },
];

export interface CorrectionAccuracyCase {
  name: string;
  checkpoints: BalanceCheckpoint[];
  items: RecurringItemInput[];
}

const mortgage = item({ id: 1, name: 'Mortgage', frequency: 'monthly', startDate: '2026-01-15', amountCents: -124000 });

export const correctionAccuracyCases: CorrectionAccuracyCase[] = [
  {
    name: 'compares against the close of the day before the correction, not the correction day',
    checkpoints: [
      { date: '2026-01-01', balanceCents: 100000 },
      { date: '2026-02-15', balanceCents: 100000 },
    ],
    items: [mortgage],
  },
  {
    name: 'forecast ran high: less money than predicted',
    checkpoints: [
      { date: '2026-01-01', balanceCents: 500000 },
      { date: '2026-01-31', balanceCents: 300000 },
    ],
    items: [mortgage],
  },
  {
    name: 'forecast ran low: more money than predicted',
    checkpoints: [
      { date: '2026-01-01', balanceCents: 500000 },
      { date: '2026-01-31', balanceCents: 700000 },
    ],
    items: [mortgage],
  },
  {
    name: 'items landing between two corrections are accounted for',
    checkpoints: [
      { date: '2026-01-01', balanceCents: 200000 },
      { date: '2026-04-01', balanceCents: 100000 },
    ],
    items: [mortgage, item({ id: 2, name: 'Pay', frequency: 'weekly', startDate: '2026-01-02', amountCents: 30000 })],
  },
  {
    name: 'each correction is measured from the previous one, not the origin',
    checkpoints: [
      { date: '2026-01-01', balanceCents: 100000 },
      { date: '2026-02-01', balanceCents: 90000 },
      { date: '2026-03-01', balanceCents: 40000 },
    ],
    items: [item({ frequency: 'weekly', startDate: '2026-01-02', amountCents: -5000 })],
  },
  {
    name: 'corrections supplied out of order are sorted',
    checkpoints: [
      { date: '2026-03-01', balanceCents: 40000 },
      { date: '2026-01-01', balanceCents: 100000 },
      { date: '2026-02-01', balanceCents: 90000 },
    ],
    items: [item({ frequency: 'weekly', startDate: '2026-01-02', amountCents: -5000 })],
  },
  {
    name: 'corrections on consecutive days',
    checkpoints: [
      { date: '2026-01-14', balanceCents: 100000 },
      { date: '2026-01-15', balanceCents: 100000 },
      { date: '2026-01-16', balanceCents: 0 },
    ],
    items: [mortgage],
  },
  {
    name: 'only an origin: nothing to compare',
    checkpoints: [{ date: '2026-01-01', balanceCents: 100000 }],
    items: [mortgage],
  },
  {
    name: 'no checkpoints at all',
    checkpoints: [],
    items: [mortgage],
  },
];
