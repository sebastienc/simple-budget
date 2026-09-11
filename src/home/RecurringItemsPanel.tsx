import React, { useState } from 'react';
import { Button as AriaButton, Input, Label, ListBox, ListBoxItem, Popover, SearchField, Select, SelectValue, type Key } from 'react-aria-components';
import { ChevronUpDownIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import { useToaster } from '@/toast/useToaster';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import Money from '@/components/ui/Money';
import Badge from '@/components/ui/Badge';
import { inputStyles } from '@/components/ui/TextField';
import { formatCents } from '@/lib/money';
import { formatISODate } from '@/lib/dates';
import { describeRecurrence } from '@/lib/recurrence';
import { useRecurringItems, type RecurringItem, type RecurringItemInput } from '@/data/useRecurringItems';
import RecurringItemForm from './RecurringItemForm';

export interface RecurringItemsPanelProps {
  accountId: number;
  currency: string;
  onItemsChanged?: () => void;
}

type SortBy = 'name' | 'amount' | 'frequency';

const SORT_OPTIONS: SortBy[] = ['name', 'amount', 'frequency'];

export function sortItems(items: RecurringItem[], sortBy: SortBy): RecurringItem[] {
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

export function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

const RecurringItemsPanel: React.FC<RecurringItemsPanelProps> = ({ accountId, currency, onItemsChanged }) => {
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
    <Panel
      title={t('RecurringItems')}
      action={
        mode === 'idle' ? (
          <Button size="sm" onPress={() => setMode('adding')}>
            {t('AddRecurringItem')}
          </Button>
        ) : undefined
      }
    >
      {mode === 'adding' && <RecurringItemForm onSubmit={handleCreate} onCancel={() => setMode('idle')} />}
      {editing && <RecurringItemForm initialValue={editing} onSubmit={(input) => handleUpdate(editing.id, input)} onCancel={() => setMode('idle')} />}

      {mode === 'idle' && items.length === 0 && <p className="text-sm text-ink-3">{t('NoRecurringItems')}</p>}

      {mode === 'idle' && sinkingFundItems.length > 0 && (
        <p className="text-sm text-ink-2">{t('SinkingFundTotal', { amount: formatCents(sinkingFundTotalCents, currency), count: sinkingFundItems.length })}</p>
      )}

      {mode === 'idle' && items.length > 0 && (
        <div className="flex items-center gap-2">
          <SearchField aria-label={t('SearchRecurringItems')} value={search} onChange={setSearch} className="flex-1">
            <Input placeholder={t('SearchRecurringItems')} className={inputStyles} />
          </SearchField>
          <Select
            selectedKey={sortBy}
            onSelectionChange={(key: Key | null) => key && setSortBy(key as SortBy)}
            className="flex flex-none flex-col"
            aria-label={t('SortBy')}
          >
            <Label className="sr-only">{t('SortBy')}</Label>
            <AriaButton className="inline-flex cursor-default items-center justify-between gap-1.5 rounded-md border border-rule-strong bg-surface-raised px-3 py-2 text-sm text-ink outline-hidden focus-visible:ring-2 focus-visible:ring-accent">
              <SelectValue />
              <ChevronUpDownIcon className="h-4 w-4 text-ink-3" />
            </AriaButton>
            <Popover className="w-(--trigger-width) rounded-lg border border-rule bg-surface-raised shadow-lg">
              <ListBox className="p-1 outline-hidden">
                {SORT_OPTIONS.map((value) => (
                  <ListBoxItem key={value} id={value} className="cursor-default rounded-md px-3 py-2 text-sm text-ink outline-hidden focus:bg-accent-soft focus:text-accent">
                    {t(`SortBy${capitalize(value)}`)}
                  </ListBoxItem>
                ))}
              </ListBox>
            </Popover>
          </Select>
        </div>
      )}

      {mode === 'idle' && items.length > 0 && visibleItems.length === 0 && <p className="text-sm text-ink-3">{t('NoRecurringItemsMatch')}</p>}

      {mode === 'idle' &&
        visibleItems.map((item) => (
          <div key={item.id} className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-baseline gap-2 text-sm text-ink">
                <span className="truncate font-medium">{item.name}</span>
                {item.sinkingFund && <Badge>{t('SinkingFund')}</Badge>}
              </span>
              <span className="text-xs text-ink-3">
                {describeRecurrence(item, t)}
                {item.sinkingFund && item.nextOccurrenceDate && item.suggestedMonthlySetAsideCents !== null && (
                  <>
                    {' · '}
                    {t('NextOccurrence')} {formatISODate(item.nextOccurrenceDate, 'd MMM yyyy')}
                    {' · '}
                    {t('SuggestedMonthlySetAside')} {formatCents(Math.abs(item.suggestedMonthlySetAsideCents), currency)}
                  </>
                )}
              </span>
            </div>
            <div className="flex flex-none items-baseline gap-1">
              <Money cents={item.amountCents} currency={currency} signed autoTone className="mr-2 text-sm" />
              <Button variant="link" size="sm" onPress={() => setMode(item.id)}>
                {t('Edit')}
              </Button>
              <Button variant="link" size="sm" onPress={() => handleDelete(item)}>
                {t('Delete')}
              </Button>
            </div>
          </div>
        ))}
    </Panel>
  );
};

export default RecurringItemsPanel;
