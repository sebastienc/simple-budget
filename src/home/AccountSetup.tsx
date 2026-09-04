import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import { parseAmountToCents } from '@/lib/money';
import { todayISO } from '@/lib/dates';
import type { Account } from '@/data/useAccounts';

export interface AccountSetupProps {
  account: Account | null;
  onCreateAccount: (name: string) => Promise<void>;
  onSetStartingBalance: (accountId: number, cents: number, date: string) => Promise<void>;
}

const AccountSetup: React.FC<AccountSetupProps> = ({ account, onCreateAccount, onSetStartingBalance }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [asOf, setAsOf] = useState(todayISO);

  if (!account) {
    return (
      <form
        className="flex max-w-sm flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          await onCreateAccount(name);
        }}
      >
        <TextField label={t('AccountName')} value={name} onChange={setName} isRequired />
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
