import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatISODate } from '@/lib/dates';
import type { ProjectionDay } from '@/data/useProjection';

export interface ProjectionTableProps {
  days: ProjectionDay[];
}

const ProjectionTable: React.FC<ProjectionTableProps> = ({ days }) => {
  const { t } = useTranslation();

  if (days.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <h2 className="text-lg font-semibold">{t('Projection')}</h2>
      <div className="max-h-[60vh] overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-rule-strong">
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
                <tr key={day.date} className={day.balanceCents < 0 ? 'bg-warn-soft text-warn' : 'border-b border-rule'}>
                  <td className="py-1.5 pr-4">{formatISODate(day.date, 'MMM d, yyyy')}</td>
                  <td className="py-1.5 pr-4">{parts.length === 0 ? '—' : parts.join(', ')}</td>
                  <td className="py-1.5 pr-4 text-right">{(day.balanceCents / 100).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProjectionTable;
