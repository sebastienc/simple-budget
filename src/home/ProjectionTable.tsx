import React, { useState } from 'react';
import { addDays, format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useProjection } from '@/data/useProjection';

export interface ProjectionTableProps {
  accountId: number;
  refreshToken?: number;
}

const inputClassName =
  'rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-gray-100';

function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

// Formats an ISO "YYYY-MM-DD" calendar date for display without any timezone
// conversion — building the Date from local Y/M/D components (not a UTC
// timestamp) keeps date-fns' locale-time `format` from shifting the day.
function formatISODate(isoDate: string, pattern: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return format(new Date(year, month - 1, day), pattern);
}

const ProjectionTable: React.FC<ProjectionTableProps> = ({ accountId, refreshToken }) => {
  const { t } = useTranslation();
  const [from, setFrom] = useState(() => toISODate(new Date()));
  const [to, setTo] = useState(() => toISODate(addDays(new Date(), 90)));
  const { days, isLoading, error } = useProjection(accountId, from, to, refreshToken);

  if (error === 'starting_balance_not_set') {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('Projection')}</h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1">
            <span>{t('From')}</span>
            <input className={inputClassName} type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="flex items-center gap-1">
            <span>{t('To')}</span>
            <input className={inputClassName} type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
      </div>

      {!isLoading && (
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-300 dark:border-zinc-600">
                <th className="py-2 pr-4">{t('Date')}</th>
                <th className="py-2 pr-4">{t('RecurringItems')}</th>
                <th className="py-2 pr-4 text-right">{t('Balance')}</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const parts = [
                  ...(day.correctionApplied ? [t('BalanceCorrectionApplied')] : []),
                  ...day.items.map((item) => `${item.name} (${(item.amountCents / 100).toFixed(2)})`),
                ];
                return (
                  <tr
                    key={day.date}
                    className={
                      day.balanceCents < 0
                        ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
                        : day.correctionApplied
                          ? 'bg-blue-50 dark:bg-blue-950/40'
                          : 'border-b border-gray-100 dark:border-zinc-800'
                    }
                  >
                    <td className="py-1.5 pr-4">{formatISODate(day.date, 'MMM d, yyyy')}</td>
                    <td className="py-1.5 pr-4">{parts.length === 0 ? '—' : parts.join(', ')}</td>
                    <td className="py-1.5 pr-4 text-right">{(day.balanceCents / 100).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ProjectionTable;
