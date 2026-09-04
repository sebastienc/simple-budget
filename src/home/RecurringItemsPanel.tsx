import React, { useState } from 'react';
import { Button, Label, ListBox, ListBoxItem, Popover, Select, SelectValue, type Key } from 'react-aria-components';
import { ChevronUpDownIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import { useToaster } from '@/toast/useToaster';
import { useRecurringItems, type RecurringItem, type RecurringItemInput } from '@/data/useRecurringItems';
import RecurringItemForm from './RecurringItemForm';

export interface RecurringItemsPanelProps {
  accountId: number;
  onItemsChanged?: () => void;
}

type SortBy = 'name' | 'amount' | 'frequency';

const SORT_OPTIONS: SortBy[] = ['name', 'amount', 'frequency'];

const buttonClassName =
  'inline-flex cursor-default items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white outline-hidden transition-colors hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-blue-600 pressed:bg-blue-700';

const linkButtonClassName =
  'inline-flex cursor-default items-center justify-center rounded-md px-2 py-1 text-sm text-blue-700 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-blue-400';

const inputClassName =
  'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-gray-100';

function sortItems(items: RecurringItem[], sortBy: SortBy): RecurringItem[] {
  const sorted = [...items];
  switch (sortBy) {
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'amount':
      return sorted.sort((a, b) => a.amountCents - b.amountCents);
    case 'frequency':
      return sorted.sort((a, b) => a.frequency.localeCompare(b.frequency));
  }
}

const RecurringItemsPanel: React.FC<RecurringItemsPanelProps> = ({ accountId, onItemsChanged }) => {
  const { t } = useTranslation();
  const { addToast } = useToaster();
  const { items, createItem, updateItem, deleteItem } = useRecurringItems(accountId);
  const [mode, setMode] = useState<'idle' | 'adding' | number>('idle');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('name');

  const editing = typeof mode === 'number' ? items.find((item) => item.id === mode) : undefined;

  const visibleItems = sortItems(
    items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())),
    sortBy,
  );

  const sinkingFundItems = items.filter((item) => item.sinkingFund && item.suggestedMonthlySetAsideCents !== null);
  // A set-aside is a magnitude, not a signed flow — see the note in Home.tsx.
  const sinkingFundTotalCents = sinkingFundItems.reduce((sum, item) => sum + Math.abs(item.suggestedMonthlySetAsideCents ?? 0), 0);

  const handleCreate = async (input: RecurringItemInput) => {
    await createItem(input);
    addToast(t('RecurringItemAdded'));
    setMode('idle');
    onItemsChanged?.();
  };

  const handleUpdate = async (id: number, input: RecurringItemInput) => {
    await updateItem(id, input);
    addToast(t('RecurringItemUpdated'));
    setMode('idle');
    onItemsChanged?.();
  };

  const handleDelete = async (item: RecurringItem) => {
    if (!window.confirm(t('DeleteRecurringItemConfirm', { name: item.name }))) {
      return;
    }
    await deleteItem(item.id);
    addToast(t('RecurringItemDeleted'));
    onItemsChanged?.();
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

      {mode === 'idle' && sinkingFundItems.length > 0 && (
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('SinkingFundTotal', {
            amount: (sinkingFundTotalCents / 100).toFixed(2),
            count: sinkingFundItems.length,
          })}
        </p>
      )}

      {mode === 'idle' && items.length > 0 && (
        <div className="flex items-center gap-2">
          <input
            className={`${inputClassName} flex-1`}
            type="text"
            placeholder={t('SearchRecurringItems')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select
            selectedKey={sortBy}
            onSelectionChange={(key: Key | null) => {
              if (key) {
                setSortBy(key as SortBy);
              }
            }}
            className="flex flex-col"
            aria-label={t('SortBy')}
          >
            <Label className="sr-only">{t('SortBy')}</Label>
            <Button className="inline-flex items-center justify-between gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-gray-100">
              <SelectValue />
              <ChevronUpDownIcon className="h-4 w-4" />
            </Button>
            <Popover className="w-(--trigger-width) rounded-md bg-white shadow-lg ring-1 ring-black/5 dark:bg-zinc-800">
              <ListBox className="p-1 outline-hidden">
                {SORT_OPTIONS.map((value) => (
                  <ListBoxItem
                    key={value}
                    id={value}
                    className="cursor-default rounded-md px-3 py-2 text-sm text-gray-900 outline-hidden focus:bg-blue-500 focus:text-white dark:text-gray-100"
                  >
                    {t(`SortBy${value.charAt(0).toUpperCase()}${value.slice(1)}`)}
                  </ListBoxItem>
                ))}
              </ListBox>
            </Popover>
          </Select>
        </div>
      )}

      {mode === 'idle' && items.length > 0 && visibleItems.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400">{t('NoRecurringItemsMatch')}</p>
      )}

      {mode === 'idle' && visibleItems.length > 0 && (
        <ul className="flex flex-col divide-y divide-gray-200 dark:divide-zinc-700">
          {visibleItems.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2">
              <div className="flex flex-col">
                <span className="font-medium">{item.name}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {(item.amountCents / 100).toFixed(2)} ·{' '}
                  {item.endDate && item.endDate === item.startDate
                    ? t('OneTimePayment')
                    : t(`Frequency${item.frequency.charAt(0).toUpperCase()}${item.frequency.slice(1)}`)}
                  {item.frequency === 'semimonthly' && ` (${item.semiMonthlyDay1}, ${item.semiMonthlyDay2})`}
                  {item.sinkingFund && item.nextOccurrenceDate && item.suggestedMonthlySetAsideCents !== null && (
                    <>
                      {' · '}
                      {t('NextOccurrence')}: {item.nextOccurrenceDate} · {t('SuggestedMonthlySetAside')}:{' '}
                      {(Math.abs(item.suggestedMonthlySetAsideCents) / 100).toFixed(2)}
                    </>
                  )}
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
