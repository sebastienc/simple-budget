import React, { useState } from 'react';
import { Button } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useToaster } from '@/toast/useToaster';
import { useRecurringItems, type RecurringItem, type RecurringItemInput } from '@/data/useRecurringItems';
import RecurringItemForm from './RecurringItemForm';

export interface RecurringItemsPanelProps {
  accountId: number;
}

const buttonClassName =
  'inline-flex cursor-default items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white outline-hidden transition-colors hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-blue-600 pressed:bg-blue-700';

const linkButtonClassName =
  'inline-flex cursor-default items-center justify-center rounded-md px-2 py-1 text-sm text-blue-700 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-blue-400';

const RecurringItemsPanel: React.FC<RecurringItemsPanelProps> = ({ accountId }) => {
  const { t } = useTranslation();
  const { addToast } = useToaster();
  const { items, createItem, updateItem, deleteItem } = useRecurringItems(accountId);
  const [mode, setMode] = useState<'idle' | 'adding' | number>('idle');

  const editing = typeof mode === 'number' ? items.find((item) => item.id === mode) : undefined;

  const handleCreate = async (input: RecurringItemInput) => {
    await createItem(input);
    addToast(t('RecurringItemAdded'));
    setMode('idle');
  };

  const handleUpdate = async (id: number, input: RecurringItemInput) => {
    await updateItem(id, input);
    addToast(t('RecurringItemUpdated'));
    setMode('idle');
  };

  const handleDelete = async (item: RecurringItem) => {
    await deleteItem(item.id);
    addToast(t('RecurringItemDeleted'));
  };

  return (
    <div className="flex w-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('RecurringItems')}</h2>
        {mode === 'idle' && (
          <Button className={buttonClassName} onPress={() => setMode('adding')}>
            {t('AddRecurringItem')}
          </Button>
        )}
      </div>

      {mode === 'adding' && <RecurringItemForm onSubmit={handleCreate} onCancel={() => setMode('idle')} />}
      {editing && (
        <RecurringItemForm
          initialValue={editing}
          onSubmit={(input) => handleUpdate(editing.id, input)}
          onCancel={() => setMode('idle')}
        />
      )}

      {items.length === 0 && mode === 'idle' && <p className="text-gray-500 dark:text-gray-400">{t('NoRecurringItems')}</p>}

      {mode === 'idle' && items.length > 0 && (
        <ul className="flex flex-col divide-y divide-gray-200 dark:divide-zinc-700">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2">
              <div className="flex flex-col">
                <span className="font-medium">{item.name}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {(item.amountCents / 100).toFixed(2)} · {t(`Frequency${item.frequency.charAt(0).toUpperCase()}${item.frequency.slice(1)}`)}
                </span>
              </div>
              <div className="flex gap-2">
                <Button className={linkButtonClassName} onPress={() => setMode(item.id)}>
                  {t('Edit')}
                </Button>
                <Button className={linkButtonClassName} onPress={() => handleDelete(item)}>
                  {t('Delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default RecurringItemsPanel;
