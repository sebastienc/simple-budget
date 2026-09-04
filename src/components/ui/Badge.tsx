import React from 'react';
import clsx from 'clsx';

export type BadgeTone = 'accent' | 'quiet';

export interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}

const tones: Record<BadgeTone, string> = {
  accent: 'bg-accent-soft text-accent',
  quiet: 'border border-rule-strong text-ink-2',
};

const Badge: React.FC<BadgeProps> = ({ children, tone = 'accent', className }) => (
  <span className={clsx('inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase', tones[tone], className)}>{children}</span>
);

export default Badge;
