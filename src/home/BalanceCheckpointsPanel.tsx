import React, { useState } from 'react';
import { Button } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useToaster } from '@/toast/useToaster';
import { useBalanceCheckpoints, type BalanceCheckpoint } from '@/data/useBalanceCheckpoints';

export interface BalanceCheckpointsPanelProps {
  accountId: number;
  onCheckpointsChanged?: () => void;
}

const buttonClassName =
  'inline-flex cursor-default items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white outline-hidden transition-colors hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-blue-600 pressed:bg-blue-700';

const linkButtonClassName =
  'inline-flex cursor-default items-center justify-center rounded-md px-2 py-1 text-sm text-blue-700 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-blue-400';

const inputClassName =
  'rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-gray-100';

const BalanceCheckpointsPanel: React.FC<BalanceCheckpointsPanelProps> = ({ accountId, onCheckpointsChanged }) => {
  const { t } = useTranslation();
  const { addToast } = useToaster();
  const { checkpoints, createOrUpdateCheckpoint, deleteCheckpoint } = useBalanceCheckpoints(accountId);
  const [isAdding, setIsAdding] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [balance, setBalance] = useState('');

  const sortedCheckpoints = [...checkpoints].sort((a, b) => b.date.localeCompare(a.date));

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    await createOrUpdateCheckpoint(date, Math.round(parseFloat(balance || '0') * 100));
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
    <div className="flex w-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('BalanceCorrections')}</h2>
        {!isAdding && (
          <Button className={buttonClassName} onPress={() => setIsAdding(true)}>
            {t('AddCorrection')}
          </Button>
        )}
      </div>

      {isAdding && (
        <form className="flex flex-col gap-3" onSubmit={handleAdd}>
          <label className="flex flex-col gap-1">
            <span>{t('Date')}</span>
            <input className={inputClassName} type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
          <label className="flex flex-col gap-1">
            <span>{t('Balance')}</span>
            <input
              className={inputClassName}
              type="number"
              step="0.01"
              value={balance}
              onChange={(event) => setBalance(event.target.value)}
              required
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit" className={buttonClassName}>
              {t('Save')}
            </Button>
            <Button
              type="button"
              onPress={() => setIsAdding(false)}
              className="inline-flex cursor-default items-center justify-center rounded-md bg-gray-200 px-4 py-2 text-gray-900 outline-hidden transition-colors hover:bg-gray-300 focus-visible:ring-2 focus-visible:ring-blue-600 dark:bg-zinc-700 dark:text-gray-100 dark:hover:bg-zinc-600"
            >
              {t('Cancel')}
            </Button>
          </div>
        </form>
      )}

      {sortedCheckpoints.length === 0 && !isAdding && <p className="text-gray-500 dark:text-gray-400">{t('NoCorrections')}</p>}

      {sortedCheckpoints.length > 0 && (
        <ul className="flex flex-col divide-y divide-gray-200 dark:divide-zinc-700">
          {sortedCheckpoints.map((checkpoint) => (
            <li key={checkpoint.id} className="flex items-center justify-between py-2">
              <span>
                {checkpoint.date} · {(checkpoint.balanceCents / 100).toFixed(2)}
              </span>
              <Button className={linkButtonClassName} onPress={() => handleDelete(checkpoint)}>
                {t('Delete')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default BalanceCheckpointsPanel;
