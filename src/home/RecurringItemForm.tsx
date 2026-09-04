import React, { useState } from 'react';
import { Button as AriaButton, Label, ListBox, ListBoxItem, Popover, Select, SelectValue, type Key } from 'react-aria-components';
import { ChevronUpDownIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import { centsToInputValue, parseAmountToCents } from '@/lib/money';
import { todayISO } from '@/lib/dates';
import type { Frequency, RecurringItem, RecurringItemInput } from '@/data/useRecurringItems';

export interface RecurringItemFormProps {
  initialValue?: RecurringItem;
  onSubmit: (input: RecurringItemInput) => Promise<void>;
  onCancel: () => void;
}

const FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly', 'yearly', 'semimonthly'];

const checkboxRow = 'flex items-center gap-2 text-sm text-ink';

const RecurringItemForm: React.FC<RecurringItemFormProps> = ({ initialValue, onSubmit, onCancel }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initialValue?.name ?? '');
  const [amount, setAmount] = useState(initialValue ? centsToInputValue(initialValue.amountCents) : '');
  const [frequency, setFrequency] = useState<Frequency>(initialValue?.frequency ?? 'monthly');
  const [interval, setInterval] = useState(String(initialValue?.interval ?? 1));
  const [startDate, setStartDate] = useState(initialValue?.startDate ?? todayISO());
  const [endDate, setEndDate] = useState(initialValue?.endDate ?? '');
  const [semiMonthlyDay1, setSemiMonthlyDay1] = useState(String(initialValue?.semiMonthlyDay1 ?? 15));
  const [semiMonthlyDay2, setSemiMonthlyDay2] = useState(String(initialValue?.semiMonthlyDay2 ?? 31));
  const [sinkingFund, setSinkingFund] = useState(initialValue?.sinkingFund ?? false);
  const [isOneTime, setIsOneTime] = useState(initialValue ? initialValue.endDate !== null && initialValue.endDate === initialValue.startDate : false);

  const isSemiMonthly = frequency === 'semimonthly';

  return (
    <form
      className="flex max-w-sm flex-col gap-4 border-b border-rule pb-6"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit({
          name,
          amountCents: parseAmountToCents(amount),
          frequency: isOneTime ? 'daily' : frequency,
          interval: isOneTime || isSemiMonthly ? 1 : parseInt(interval, 10) || 1,
          startDate,
          endDate: isOneTime ? startDate : endDate || null,
          semiMonthlyDay1: !isOneTime && isSemiMonthly ? parseInt(semiMonthlyDay1, 10) : null,
          semiMonthlyDay2: !isOneTime && isSemiMonthly ? parseInt(semiMonthlyDay2, 10) : null,
          sinkingFund,
        });
      }}
    >
      <TextField label={t('Name')} value={name} onChange={setName} isRequired />
      <TextField label={t('Amount')} type="number" step="0.01" value={amount} onChange={setAmount} isRequired />

      <label className={checkboxRow}>
        <input type="checkbox" checked={isOneTime} onChange={(event) => setIsOneTime(event.target.checked)} className="accent-accent" />
        <span>{t('OneTimePayment')}</span>
      </label>

      {!isOneTime && (
        <>
          <Select selectedKey={frequency} onSelectionChange={(key: Key | null) => key && setFrequency(key as Frequency)} className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium tracking-wide text-ink-2">{t('Frequency')}</Label>
            <AriaButton className="inline-flex cursor-default items-center justify-between rounded-md border border-rule-strong bg-surface-raised px-3 py-2 text-left text-sm text-ink outline-hidden focus-visible:ring-2 focus-visible:ring-accent">
              <SelectValue />
              <ChevronUpDownIcon className="h-4 w-4 text-ink-3" />
            </AriaButton>
            <Popover className="w-(--trigger-width) rounded-lg border border-rule bg-surface-raised shadow-lg">
              <ListBox className="p-1 outline-hidden">
                {FREQUENCIES.map((value) => (
                  <ListBoxItem key={value} id={value} className="cursor-default rounded-md px-3 py-2 text-sm text-ink outline-hidden focus:bg-accent-soft focus:text-accent">
                    {t(`Frequency${value.charAt(0).toUpperCase()}${value.slice(1)}`)}
                  </ListBoxItem>
                ))}
              </ListBox>
            </Popover>
          </Select>

          {isSemiMonthly ? (
            <>
              <TextField label={t('SemiMonthlyDay1')} type="number" min={1} max={31} value={semiMonthlyDay1} onChange={setSemiMonthlyDay1} isRequired />
              <TextField label={t('SemiMonthlyDay2')} type="number" min={1} max={31} value={semiMonthlyDay2} onChange={setSemiMonthlyDay2} isRequired />
            </>
          ) : (
            <TextField label={t('Every')} type="number" min={1} value={interval} onChange={setInterval} isRequired />
          )}
        </>
      )}

      <TextField label={t('StartDate')} type="date" value={startDate} onChange={setStartDate} isRequired />
      {!isOneTime && <TextField label={t('EndDate')} type="date" value={endDate} onChange={setEndDate} />}

      <label className={checkboxRow}>
        <input type="checkbox" checked={sinkingFund} onChange={(event) => setSinkingFund(event.target.checked)} className="accent-accent" />
        <span>{t('SinkingFund')}</span>
      </label>

      <div className="flex gap-2">
        <Button type="submit">{t('Save')}</Button>
        <Button type="button" variant="ghost" onPress={onCancel}>
          {t('Cancel')}
        </Button>
      </div>
    </form>
  );
};

export default RecurringItemForm;
