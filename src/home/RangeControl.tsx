import React from 'react';
import { Input, Label, TextField } from 'react-aria-components';
import { useTranslation } from 'react-i18next';

export interface RangeControlProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

const field = 'rounded-md border border-rule bg-surface-raised px-2 py-1 font-mono text-xs text-ink-2 outline-hidden focus-visible:ring-2 focus-visible:ring-accent';

/** Sits next to the chart it controls, rather than up in the app bar. */
const RangeControl: React.FC<RangeControlProps> = ({ from, to, onFromChange, onToChange }) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-end gap-2">
      <TextField value={from} onChange={onFromChange} type="date" className="flex items-center gap-1.5">
        <Label className="text-xs text-ink-3">{t('From')}</Label>
        <Input type="date" className={field} />
      </TextField>
      <TextField value={to} onChange={onToChange} type="date" className="flex items-center gap-1.5">
        <Label className="text-xs text-ink-3">{t('To')}</Label>
        <Input type="date" className={field} />
      </TextField>
    </div>
  );
};

export default RangeControl;
