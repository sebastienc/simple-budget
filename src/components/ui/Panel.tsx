import React from 'react';
import clsx from 'clsx';

export interface PanelProps {
  title: string;
  /** Quiet text sitting opposite the title, e.g. a count or a range. */
  note?: React.ReactNode;
  /** A control sitting opposite the title, e.g. an "Add" button. */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * A titled section separated by a hairline rule rather than a card. Borders and
 * fills are spent on the few things that genuinely need lifting off the page;
 * everything else is set on the ground with typographic hierarchy.
 */
const Panel: React.FC<PanelProps> = ({ title, note, action, children, className }) => (
  <section className={clsx('flex flex-col gap-3', className)}>
    <div className="flex items-baseline justify-between gap-4 border-b border-rule-strong pb-2">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {note && <span className="text-xs text-ink-3">{note}</span>}
      {action}
    </div>
    {children}
  </section>
);

export default Panel;
