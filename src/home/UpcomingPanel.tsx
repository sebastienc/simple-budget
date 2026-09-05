import React from 'react';
import { useTranslation } from 'react-i18next';
import Panel from '@/components/ui/Panel';
import Money from '@/components/ui/Money';
import { formatISODate, todayISO } from '@/lib/dates';
import type { ProjectionSummary } from '@/lib/projection';

export interface UpcomingPanelProps {
  summary: ProjectionSummary | null;
}

const MAX_EVENTS = 6;

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

      {events.map((event) => (
        <div key={event.date} className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm text-ink">{event.items.map((item) => item.name).join(' · ')}</span>
            <span className="font-mono text-xs text-ink-3">{formatISODate(event.date, 'EEE d MMM')}</span>
          </div>
          <Money cents={event.dailyTotalCents} signed autoTone className="text-sm" />
        </div>
      ))}

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
