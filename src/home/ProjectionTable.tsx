import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import Panel from '@/components/ui/Panel';
import Money from '@/components/ui/Money';
import { formatISODate } from '@/lib/dates';
import type { ProjectionDay } from '@/data/useProjection';
import type { ProjectionSummary } from '@/lib/projection';

export interface ProjectionTableProps {
  days: ProjectionDay[];
  currency: string;
  summary: ProjectionSummary | null;
}

type LedgerRow = { kind: 'day'; day: ProjectionDay } | { kind: 'quiet'; from: string; to: string; balanceCents: number };

const DAY_FORMAT = 'd MMM';

/**
 * Collapses runs of days where nothing happens.
 *
 * A statement lists what moved, not every date on the calendar — and across a
 * 90-day window the overwhelming majority of rows are unchanged balances. A
 * run's balance is necessarily constant (no items means no change), so folding
 * it into one row loses nothing.
 */
function toLedgerRows(days: ProjectionDay[]): LedgerRow[] {
  const rows: LedgerRow[] = [];
  let run: ProjectionDay[] = [];

  const flush = () => {
    if (run.length === 0) {
      return;
    }
    if (run.length === 1) {
      rows.push({ kind: 'day', day: run[0] });
    } else {
      rows.push({ kind: 'quiet', from: run[0].date, to: run[run.length - 1].date, balanceCents: run[0].balanceCents });
    }
    run = [];
  };

  for (const day of days) {
    if (day.items.length === 0 && !day.correctionApplied) {
      run.push(day);
    } else {
      flush();
      rows.push({ kind: 'day', day });
    }
  }
  flush();

  return rows;
}

const ProjectionTable: React.FC<ProjectionTableProps> = ({ days, currency, summary }) => {
  const { t } = useTranslation();
  const rows = useMemo(() => toLedgerRows(days), [days]);

  if (days.length === 0 || !summary) {
    return null;
  }

  return (
    <Panel title={t('Projection')} note={`${formatISODate(days[0].date, DAY_FORMAT)} — ${formatISODate(summary.lastDate, 'd MMM yyyy')}`}>
      <div className="max-h-[60vh] overflow-auto pr-2">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b border-rule-strong">
              <th className="w-36 py-2 pr-4 text-[10px] font-semibold tracking-widest text-ink-3 uppercase">{t('Date')}</th>
              <th className="py-2 pr-4 text-[10px] font-semibold tracking-widest text-ink-3 uppercase">{t('Detail')}</th>
              <th className="w-32 py-2 text-right text-[10px] font-semibold tracking-widest text-ink-3 uppercase">{t('Balance')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.kind === 'quiet') {
                return (
                  <tr key={`quiet-${row.from}`} className="border-b border-rule text-ink-3">
                    <td className="py-1.5 pr-4 font-mono text-xs whitespace-nowrap">
                      {formatISODate(row.from, DAY_FORMAT)} – {formatISODate(row.to, DAY_FORMAT)}
                    </td>
                    <td className="py-1.5 pr-4">—</td>
                    <td className="py-1.5 text-right">
                      <Money cents={row.balanceCents} currency={currency} tone={row.balanceCents < 0 ? 'warn' : 'quiet'} />
                    </td>
                  </tr>
                );
              }

              const { day } = row;
              const isNegative = day.balanceCents < 0;
              return (
                <tr key={day.date} className="border-b border-rule">
                  {/* A rule in the margin rather than a filled row: red stays
                      meaningful, and the figures keep their own contrast. */}
                  <td className={clsx('py-1.5 pr-4 font-mono text-xs whitespace-nowrap text-ink-2', isNegative && 'border-l-2 border-warn pl-2')}>{formatISODate(day.date, DAY_FORMAT)}</td>
                  <td className="py-1.5 pr-4">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      {day.correctionApplied && <span className="text-xs font-semibold text-accent">{t('BalanceCorrectionApplied')}</span>}
                      {day.items.map((item) => (
                        <span key={item.id} className="whitespace-nowrap">
                          {item.name} <Money cents={item.amountCents} currency={currency} signed tone="quiet" className="text-xs" />
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="py-1.5 text-right">
                    <Money cents={day.balanceCents} currency={currency} autoTone />
                  </td>
                </tr>
              );
            })}

            {/* Accounting convention: a double rule closes the column. */}
            <tr>
              <td className="border-t-[3px] border-double border-rule-strong py-2 pr-4 text-xs tracking-wide text-ink-2">{t('LowestPoint')}</td>
              <td className="border-t-[3px] border-double border-rule-strong py-2 pr-4 text-xs text-ink-2">{formatISODate(summary.lowest.date, 'd MMMM yyyy')}</td>
              <td className="border-t-[3px] border-double border-rule-strong py-2 text-right">
                <Money cents={summary.lowest.cents} currency={currency} autoTone className="font-semibold" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  );
};

export default ProjectionTable;
