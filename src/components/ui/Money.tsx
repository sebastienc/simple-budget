import React from 'react';
import clsx from 'clsx';
import { formatCents, formatCentsSigned } from '@/lib/money';

export type MoneyTone = 'default' | 'quiet' | 'accent' | 'warn';

export interface MoneyProps {
  cents: number;
  /** Always show an explicit + or −, for per-item amounts in a list. */
  signed?: boolean;
  /** Colour the figure by whether it is a shortfall. Ignored when `tone` is set. */
  autoTone?: boolean;
  tone?: MoneyTone;
  className?: string;
}

const tones: Record<MoneyTone, string> = {
  default: 'text-ink',
  quiet: 'text-ink-3',
  accent: 'text-accent',
  warn: 'text-warn',
};

/**
 * A monetary figure set in the mono face with tabular figures, so columns of
 * numbers line up on the decimal down a ledger.
 */
const Money: React.FC<MoneyProps> = ({ cents, signed, autoTone, tone, className }) => {
  const resolvedTone: MoneyTone = tone ?? (autoTone && cents < 0 ? 'warn' : 'default');
  return <span className={clsx('font-mono tabular-nums', tones[resolvedTone], className)}>{signed ? formatCentsSigned(cents) : formatCents(cents)}</span>;
};

export default Money;
