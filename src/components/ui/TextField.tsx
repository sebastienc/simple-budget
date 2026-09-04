import React from 'react';
import { Input, Label, TextField as AriaTextField } from 'react-aria-components';
import clsx from 'clsx';

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'date';
  step?: string;
  min?: number;
  max?: number;
  isRequired?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export const inputStyles =
  'w-full rounded-md border border-rule-strong bg-surface-raised px-3 py-2 text-sm text-ink outline-hidden placeholder:text-ink-3 focus-visible:ring-2 focus-visible:ring-accent';

const TextField: React.FC<TextFieldProps> = ({ label, value, onChange, type = 'text', step, min, max, isRequired, placeholder, className, inputClassName }) => (
  <AriaTextField value={value} onChange={onChange} isRequired={isRequired} type={type} className={clsx('flex flex-col gap-1.5', className)}>
    <Label className="text-xs font-medium tracking-wide text-ink-2">{label}</Label>
    <Input type={type} step={step} min={min} max={max} placeholder={placeholder} className={clsx(inputStyles, inputClassName)} />
  </AriaTextField>
);

export default TextField;
