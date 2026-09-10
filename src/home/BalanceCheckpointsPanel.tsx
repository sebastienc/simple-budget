import React, { useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useToaster } from '@/toast/useToaster';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import Money from '@/components/ui/Money';
import TextField from '@/components/ui/TextField';
import { formatCents, parseAmountToCents } from '@/lib/money';
import { formatISODate, todayISO } from '@/lib/dates';
import { summarizeAccuracy } from '@/lib/accuracy';
import { useBalanceCheckpoints, type BalanceCheckpoint } from '@/data/useBalanceCheckpoints';

export interface BalanceCheckpointsPanelProps {
  accountId: number;
  currency: string;
  onCheckpointsChanged?: () => void;
}

const BalanceCheckpointsPanel: React.FC<BalanceCheckpointsPanelProps> = ({ accountId, currency, onCheckpointsChanged }) => {
  const { t } = useTranslation();
  const { addToast } = useToaster();
  const { checkpoints, createOrUpdateCheckpoint, deleteCheckpoint } = useBalanceCheckpoints(accountId);
  const [isAdding, setIsAdding] = useState(false);
  const [date, setDate] = useState(todayISO);
  const [balance, setBalance] = useState('');

  const sortedCheckpoints = [...checkpoints].sort((a, b) => b.date.localeCompare(a.date));
  const accuracy = summarizeAccuracy(checkpoints);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    await createOrUpdateCheckpoint(date, parseAmountToCents(balance));
    addToast(t('CorrectionAdded'));
    setIsAdding(false);
    setBalance('');
    onCheckpointsChanged?.();
  };

  const handleDelete = async (checkpoint: BalanceCheckpoint) => {
    if (!window.confirm(t('DeleteCorrectionConfirm'))) {
      return;
    }
    await deleteCheckpoint(checkpoint.id);
    addToast(t('CorrectionDeleted'));
    onCheckpointsChanged?.();
  };

  return (
    <Panel
      title={t('BalanceCorrections')}
      note={
        accuracy
          ? t(accuracy.runsHigh ? 'ForecastRunsHighPerMonth' : 'ForecastRunsLowPerMonth', {
              amount: formatCents(Math.abs(accuracy.driftPerMonthCents), currency),
              count: accuracy.measuredCount,
            })
          : undefined
      }
      action={
        !isAdding ? (
          <Button variant="ghost" size="sm" onPress={() => setIsAdding(true)}>
            {t('AddCorrection')}
          </Button>
        ) : undefined
      }
    >
      {isAdding && (
        <form className="flex max-w-sm flex-col gap-3" onSubmit={handleAdd}>
          <TextField label={t('Date')} type="date" value={date} onChange={setDate} isRequired />
          <TextField label={t('Balance')} type="number" step="0.01" value={balance} onChange={setBalance} isRequired />
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              {t('Save')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onPress={() => setIsAdding(false)}>
              {t('Cancel')}
            </Button>
          </div>
        </form>
      )}

      {sortedCheckpoints.length === 0 && !isAdding && <p className="text-sm text-ink-3">{t('NoCorrections')}</p>}

      {sortedCheckpoints.map((checkpoint) => (
        <div key={checkpoint.id} className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-mono text-xs text-ink-2">{formatISODate(checkpoint.date, 'd MMMM yyyy')}</span>
            <span className={clsx('text-xs', checkpoint.driftCents !== null && checkpoint.driftCents > 0 ? 'text-warn' : 'text-ink-3')}>
              {checkpoint.driftCents === null
                ? t('AccuracyStartingPoint')
                : checkpoint.driftCents === 0
                  ? t('ForecastExact')
                  : t(checkpoint.driftCents > 0 ? 'ForecastRanHigh' : 'ForecastRanLow', { amount: formatCents(Math.abs(checkpoint.driftCents), currency) })}
            </span>
          </div>
          <div className="flex flex-none items-baseline gap-3">
            <Money cents={checkpoint.balanceCents} currency={currency} autoTone className="text-sm" />
            <Button variant="link" size="sm" onPress={() => handleDelete(checkpoint)}>
              {t('Delete')}
            </Button>
          </div>
        </div>
      ))}
    </Panel>
  );
};

export default BalanceCheckpointsPanel;
