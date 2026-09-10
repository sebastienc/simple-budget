import React, { useState } from 'react';
import { Button as AriaButton, Label, ListBox, ListBoxItem, Popover, Select, SelectValue, type Key } from 'react-aria-components';
import { ChevronUpDownIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import { parseAmountToCents } from '@/lib/money';
import { todayISO } from '@/lib/dates';
import type { Account } from '@/data/useAccounts';

const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP'];

export interface AccountSetupProps {
  account: Account | null;
  onCreateAccount: (name: string, currency: string) => Promise<void>;
  onSetStartingBalance: (accountId: number, cents: number, date: string) => Promise<void>;
}

const AccountSetup: React.FC<AccountSetupProps> = ({ account, onCreateAccount, onSetStartingBalance }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<string>(CURRENCIES[0]);
  const [balance, setBalance] = useState('');
  const [asOf, setAsOf] = useState(todayISO);

  if (!account) {
    return (
      <form
        className="flex max-w-sm flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          await onCreateAccount(name, currency);
        }}
      >
        <TextField label={t('AccountName')} value={name} onChange={setName} isRequired />

        <Select selectedKey={currency} onSelectionChange={(key: Key | null) => key && setCurrency(key as string)} className="flex flex-col gap-1.5">
          <Label className="text-xs font-medium tracking-wide text-ink-2">{t('Currency')}</Label>
          <AriaButton className="inline-flex cursor-default items-center justify-between rounded-md border border-rule-strong bg-surface-raised px-3 py-2 text-left text-sm text-ink outline-hidden focus-visible:ring-2 focus-visible:ring-accent">
            <SelectValue />
            <ChevronUpDownIcon className="h-4 w-4 text-ink-3" />
          </AriaButton>
          <Popover className="w-(--trigger-width) rounded-lg border border-rule bg-surface-raised shadow-lg">
            <ListBox className="p-1 outline-hidden">
              {CURRENCIES.map((value) => (
                <ListBoxItem key={value} id={value} className="cursor-default rounded-md px-3 py-2 text-sm text-ink outline-hidden focus:bg-accent-soft focus:text-accent">
                  {value}
                </ListBoxItem>
              ))}
            </ListBox>
          </Popover>
        </Select>

        <Button type="submit" className="self-start">
          {t('CreateAccount')}
        </Button>
      </form>
    );
  }

  return (
    <form
      className="flex max-w-sm flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSetStartingBalance(account.id, parseAmountToCents(balance), asOf);
      }}
    >
      <p className="text-sm text-ink-2">{t('StartingBalanceNotSet')}</p>
      <TextField label={t('StartingBalance')} type="number" step="0.01" value={balance} onChange={setBalance} isRequired />
      <TextField label={t('StartingBalanceDate')} type="date" value={asOf} onChange={setAsOf} isRequired />
      <Button type="submit" className="self-start">
        {t('SetStartingBalance')}
      </Button>
    </form>
  );
};

export default AccountSetup;
