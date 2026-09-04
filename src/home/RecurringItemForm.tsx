import React, { useState } from 'react';
import { Button, Label, ListBox, ListBoxItem, Popover, Select, SelectValue, type Key } from 'react-aria-components';
import { ChevronUpDownIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import type { Frequency, RecurringItem, RecurringItemInput } from '@/data/useRecurringItems';

export interface RecurringItemFormProps {
  initialValue?: RecurringItem;
  onSubmit: (input: RecurringItemInput) => Promise<void>;
  onCancel: () => void;
}

const FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly', 'yearly', 'semimonthly'];

const inputClassName =
  'rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-gray-100';

const buttonClassName =
  'inline-flex cursor-default items-center justify-center rounded-md px-4 py-2 outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-blue-600';

const RecurringItemForm: React.FC<RecurringItemFormProps> = ({ initialValue, onSubmit, onCancel }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initialValue?.name ?? '');
  const [amount, setAmount] = useState(initialValue ? String(initialValue.amountCents / 100) : '');
  const [frequency, setFrequency] = useState<Frequency>(initialValue?.frequency ?? 'monthly');
  const [interval, setInterval] = useState(String(initialValue?.interval ?? 1));
  const [startDate, setStartDate] = useState(initialValue?.startDate ?? new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(initialValue?.endDate ?? '');
  const [semiMonthlyDay1, setSemiMonthlyDay1] = useState(String(initialValue?.semiMonthlyDay1 ?? 15));
  const [semiMonthlyDay2, setSemiMonthlyDay2] = useState(String(initialValue?.semiMonthlyDay2 ?? 31));
  const [sinkingFund, setSinkingFund] = useState(initialValue?.sinkingFund ?? false);

  const isSemiMonthly = frequency === 'semimonthly';

  return (
    <form
      className="flex flex-col gap-3 p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit({
          name,
          amountCents: Math.round(parseFloat(amount || '0') * 100),
          frequency,
          interval: isSemiMonthly ? 1 : parseInt(interval, 10) || 1,
          startDate,
          endDate: endDate || null,
          semiMonthlyDay1: isSemiMonthly ? parseInt(semiMonthlyDay1, 10) : null,
          semiMonthlyDay2: isSemiMonthly ? parseInt(semiMonthlyDay2, 10) : null,
          sinkingFund,
        });
      }}
    >
      <label className="flex flex-col gap-1">
        <span>{t('Name')}</span>
        <input className={inputClassName} value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label className="flex flex-col gap-1">
        <span>{t('Amount')}</span>
        <input
          className={inputClassName}
          type="number"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
      </label>
      <div className="flex flex-col gap-1">
        <Select
          selectedKey={frequency}
          onSelectionChange={(key: Key | null) => {
            if (key) {
              setFrequency(key as Frequency);
            }
          }}
          className="flex flex-col gap-1"
        >
          <Label>{t('Frequency')}</Label>
          <Button
            className="inline-flex items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-gray-900 outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-gray-100"
          >
            <SelectValue />
            <ChevronUpDownIcon className="h-4 w-4" />
          </Button>
          <Popover className="w-(--trigger-width) rounded-md bg-white shadow-lg ring-1 ring-black/5 dark:bg-zinc-800">
            <ListBox className="p-1 outline-hidden">
              {FREQUENCIES.map((value) => (
                <ListBoxItem
                  key={value}
                  id={value}
                  className="cursor-default rounded-md px-3 py-2 text-gray-900 outline-hidden focus:bg-blue-500 focus:text-white dark:text-gray-100"
                >
                  {t(`Frequency${value.charAt(0).toUpperCase()}${value.slice(1)}`)}
                </ListBoxItem>
              ))}
            </ListBox>
          </Popover>
        </Select>
      </div>
      {isSemiMonthly ? (
        <>
          <label className="flex flex-col gap-1">
            <span>{t('SemiMonthlyDay1')}</span>
            <input
              className={inputClassName}
              type="number"
              min={1}
              max={31}
              value={semiMonthlyDay1}
              onChange={(event) => setSemiMonthlyDay1(event.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>{t('SemiMonthlyDay2')}</span>
            <input
              className={inputClassName}
              type="number"
              min={1}
              max={31}
              value={semiMonthlyDay2}
              onChange={(event) => setSemiMonthlyDay2(event.target.value)}
              required
            />
          </label>
        </>
      ) : (
        <label className="flex flex-col gap-1">
          <span>{t('Every')}</span>
          <input
            className={inputClassName}
            type="number"
            min={1}
            value={interval}
            onChange={(event) => setInterval(event.target.value)}
            required
          />
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span>{t('StartDate')}</span>
        <input className={inputClassName} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
      </label>
      <label className="flex flex-col gap-1">
        <span>{t('EndDate')}</span>
        <input className={inputClassName} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={sinkingFund}
          onChange={(event) => setSinkingFund(event.target.checked)}
        />
        <span>{t('SinkingFund')}</span>
      </label>
      <div className="flex gap-2">
        <Button type="submit" className={`${buttonClassName} bg-blue-600 text-white hover:bg-blue-500 pressed:bg-blue-700`}>
          {t('Save')}
        </Button>
        <Button
          type="button"
          onPress={onCancel}
          className={`${buttonClassName} bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-zinc-700 dark:text-gray-100 dark:hover:bg-zinc-600`}
        >
          {t('Cancel')}
        </Button>
      </div>
    </form>
  );
};

export default RecurringItemForm;
