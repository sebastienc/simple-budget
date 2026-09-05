import React from 'react';
import { Button, Input, Label, TextField } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { addMonths, subMonths } from 'date-fns';
import clsx from 'clsx';
import { toISODate, todayISO } from '@/lib/dates';

export interface RangeControlProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

const field = 'rounded-md border border-rule bg-surface-raised px-2 py-1 font-mono text-xs text-ink-2 outline-hidden focus-visible:ring-2 focus-visible:ring-accent';

const preset = 'cursor-default rounded-md px-2.5 py-1 text-xs whitespace-nowrap outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-accent';
const presetOn = 'bg-surface-raised font-semibold text-ink shadow-sm';
const presetOff = 'text-ink-3 hover:text-ink';

/** The window the chart and ledger cover. Sits beside them, not in the app bar. */
const RangeControl: React.FC<RangeControlProps> = ({ from, to, onFromChange, onToChange }) => {
  const { t } = useTranslation();

  const today = todayISO();
  const ranges = [
    // Corrections are in the past, so the forecast-accuracy markers are only
    // reachable by looking backwards. This is the shortcut for doing that.
    { key: 'LastThreeMonths', from: toISODate(subMonths(new Date(), 3)), to: today },
    { key: 'NextThreeMonths', from: today, to: toISODate(addMonths(new Date(), 3)) },
  ];

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
      <div className="flex items-center gap-1 rounded-lg border border-rule p-1">
        {ranges.map((range) => (
          <Button
            key={range.key}
            // React batches both updates in an event handler, so the range never
            // renders half-applied with `to` before `from`.
            onPress={() => {
              onFromChange(range.from);
              onToChange(range.to);
            }}
            className={clsx(preset, from === range.from && to === range.to ? presetOn : presetOff)}
          >
            {t(range.key)}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <TextField value={from} onChange={onFromChange} type="date" className="flex items-center gap-1.5">
          <Label className="text-xs text-ink-3">{t('From')}</Label>
          <Input type="date" className={field} />
        </TextField>
        <TextField value={to} onChange={onToChange} type="date" className="flex items-center gap-1.5">
          <Label className="text-xs text-ink-3">{t('To')}</Label>
          <Input type="date" className={field} />
        </TextField>
      </div>
    </div>
  );
};

export default RangeControl;
