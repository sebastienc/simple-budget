import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { formatCents } from '@/lib/money';
import { formatISODate } from '@/lib/dates';
import type { ProjectionSummary } from '@/lib/projection';

export interface AccountHeroProps {
  accountName: string;
  summary: ProjectionSummary | null;
  /** Suggested monthly set-aside across sinking-fund items, if any. */
  sinkingFundTotalCents: number | null;
}

const DATE_FORMAT = 'd MMMM yyyy';

/**
 * The answer, in words, before any table. Three states, because the useful
 * thing to say changes completely depending on whether the account runs dry.
 */
const AccountHero: React.FC<AccountHeroProps> = ({ accountName, summary, sinkingFundTotalCents }) => {
  const { t } = useTranslation();

  if (!summary) {
    return (
      <header className="flex flex-col gap-3">
        <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">{accountName}</p>
        <h1 className="max-w-[20ch] font-display text-4xl leading-tight font-semibold text-balance text-ink">{t('NothingScheduledYet')}</h1>
        <p className="max-w-[58ch] text-ink-2">{t('AddFirstItem')}</p>
      </header>
    );
  }

  const shortfall = summary.firstNegativeDate !== null;
  const lowestDate = formatISODate(summary.lowest.date, DATE_FORMAT);

  // What actually causes the trouble: the items landing the day it turns.
  const trigger = shortfall ? summary.events.find((event) => event.date === summary.firstNegativeDate) : undefined;
  const triggerNames = trigger?.items.map((item) => item.name).join(' · ');

  return (
    <header className="flex flex-col gap-3">
      <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">{t('InRangeUntil', { name: accountName, date: formatISODate(summary.lastDate, 'd MMM yyyy') })}</p>

      <h1 className="max-w-[20ch] font-display text-4xl leading-tight font-semibold text-balance text-ink">
        {shortfall ? (
          // <Trans> rather than string-splicing: French puts the amount in a
          // different place in the sentence, so the markup has to travel with
          // the translation.
          <Trans
            i18nKey="ShortByOn"
            values={{ amount: formatCents(Math.abs(summary.lowest.cents)), date: lowestDate }}
            components={{ amount: <span className="text-warn" /> }}
          />
        ) : (
          t('LowestPointOn', { amount: formatCents(summary.lowest.cents), date: lowestDate })
        )}
      </h1>

      <p className="max-w-[58ch] text-ink-2">
        {shortfall
          ? [triggerNames ? t('LandsOn', { names: triggerNames, date: formatISODate(summary.firstNegativeDate!, DATE_FORMAT) }) : null, t('DoesNotRecover', { date: formatISODate(summary.lastDate, DATE_FORMAT) })]
              .filter(Boolean)
              .join(' ')
          : t('StaysAboveZero', { date: formatISODate(summary.lastDate, DATE_FORMAT) })}
      </p>

      {shortfall && sinkingFundTotalCents !== null && sinkingFundTotalCents > 0 && (
        <span className="inline-flex items-center gap-2 self-start rounded-full bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {t('AddPerMonthToCover', { amount: formatCents(sinkingFundTotalCents) })}
        </span>
      )}
    </header>
  );
};

export default AccountHero;
