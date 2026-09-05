import React from 'react';
import { Button, Disclosure, DisclosurePanel, Heading } from 'react-aria-components';
import { ChevronRightIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import clsx from 'clsx';
import Panel from '@/components/ui/Panel';
import Money from '@/components/ui/Money';
import { formatISODate, todayISO } from '@/lib/dates';
import type { ProjectionEvent, ProjectionSummary } from '@/lib/projection';

export interface UpcomingPanelProps {
  summary: ProjectionSummary | null;
}

const MAX_EVENTS = 6;

const row = 'flex w-full items-baseline justify-between gap-3 border-b border-rule py-2.5 text-left';

/**
 * What to call a day.
 *
 * Joining every name reads as a single thing — "Groceries · Car fuel ·
 * Cleaning −360.00" looks like one transaction worth 360 rather than three
 * separate ones. Leading with the largest item keeps the part of the day worth
 * recognising (the 15th is *payday*, not "pay and a loan payment") and the
 * count makes the grouping explicit, and hints there's something to open.
 */
function dayLabel(event: ProjectionEvent, t: TFunction): string {
  if (event.items.length === 1) {
    return event.items[0].name;
  }
  const largest = event.items.reduce((acc, item) => (Math.abs(item.amountCents) > Math.abs(acc.amountCents) ? item : acc), event.items[0]);
  return t('DayWithOthers', { name: largest.name, count: event.items.length - 1 });
}

/** Everything landing that day, and the day's net. */
const DaySummary: React.FC<{ event: ProjectionEvent; t: TFunction }> = ({ event, t }) => (
  <>
    {/* flex-1 so the chevron, name and amount don't get spread evenly by the
        row's justify-between — the name belongs next to the chevron. */}
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-sm text-ink">{dayLabel(event, t)}</span>
      <span className="font-mono text-xs text-ink-3">{formatISODate(event.date, 'EEE d MMM')}</span>
    </div>
    <Money cents={event.dailyTotalCents} signed autoTone className="flex-none text-sm" />
  </>
);

const UpcomingPanel: React.FC<UpcomingPanelProps> = ({ summary }) => {
  const { t } = useTranslation();

  if (!summary) {
    return null;
  }

  const events = summary.events.slice(0, MAX_EVENTS);
  // The range can be moved into the past, where "what's coming" would be
  // describing things that already happened. Keyed off the events rather than
  // the range's end: the "last 3 months" preset ends *on* today, so comparing
  // the end date would never register as history.
  const isHistory = events.length > 0 && events[events.length - 1].date < todayISO();

  return (
    <Panel title={t(isHistory ? 'InThisPeriod' : 'WhatsComing')} note={events.length > 0 ? formatISODate(events[events.length - 1].date, 'd MMM') : undefined}>
      {events.length === 0 && <p className="text-sm text-ink-3">{t('NothingComing')}</p>}

      {events.map((event) =>
        // A day carrying one item has nothing to reveal — its name and amount
        // are already the whole story — so it gets no disclosure to open. The
        // padding keeps it aligned with the days that do.
        event.items.length === 1 ? (
          <div key={event.date} className={clsx(row, 'pl-6')}>
            <DaySummary event={event} t={t} />
          </div>
        ) : (
          <Disclosure key={event.date}>
            {({ isExpanded }) => (
              <>
                <Heading className="contents">
                  <Button slot="trigger" className={clsx(row, 'cursor-default items-center rounded-sm outline-hidden focus-visible:ring-2 focus-visible:ring-accent')}>
                    <ChevronRightIcon className={clsx('h-3 w-3 flex-none text-ink-3 transition-transform', isExpanded && 'rotate-90')} />
                    <DaySummary event={event} t={t} />
                  </Button>
                </Heading>

                {/* The net on the row above hides its parts: a +2,200 day can be
                    +2,700 of pay against a −500 payment. This is where you see that. */}
                <DisclosurePanel className="border-b border-rule pb-2">
                  {event.items.map((item) => (
                    <div key={item.id} className="flex items-baseline justify-between gap-3 py-1 pl-6">
                      <span className="truncate text-xs text-ink-2">{item.name}</span>
                      <Money cents={item.amountCents} signed autoTone className="flex-none text-xs" />
                    </div>
                  ))}
                </DisclosurePanel>
              </>
            )}
          </Disclosure>
        ),
      )}

      {summary.firstNegativeDate && (
        <div className="mt-1 rounded-lg bg-warn-soft px-3.5 py-3 text-sm text-ink-2">
          <b className="mb-0.5 block font-semibold text-warn">{t('GoesNegativeOn', { date: formatISODate(summary.firstNegativeDate, 'd MMMM') })}</b>
          {t('DoesNotRecover', { date: formatISODate(summary.lastDate, 'd MMMM yyyy') })}
        </div>
      )}
    </Panel>
  );
};

export default UpcomingPanel;
