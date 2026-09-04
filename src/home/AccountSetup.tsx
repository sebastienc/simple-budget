import React, { useState } from 'react';
import { Button } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import type { Account } from '@/data/useAccounts';

export interface AccountSetupProps {
  account: Account | null;
  onCreateAccount: (name: string) => Promise<void>;
  onSetStartingBalance: (accountId: number, cents: number, date: string) => Promise<void>;
}

const buttonClassName =
  'inline-flex cursor-default items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-white outline-hidden transition-colors hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-blue-600 pressed:bg-blue-700';

const inputClassName =
  'rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-gray-100';

const AccountSetup: React.FC<AccountSetupProps> = ({ account, onCreateAccount, onSetStartingBalance }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));

  if (!account) {
    return (
      <form
        className="flex max-w-sm flex-col gap-3 p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          await onCreateAccount(name);
        }}
      >
        <label className="flex flex-col gap-1">
          <span>{t('AccountName')}</span>
          <input className={inputClassName} value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <Button type="submit" className={buttonClassName}>
          {t('CreateAccount')}
        </Button>
      </form>
    );
  }

  return (
    <form
      className="flex max-w-sm flex-col gap-3 p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const cents = Math.round(parseFloat(balance || '0') * 100);
        await onSetStartingBalance(account.id, cents, asOf);
      }}
    >
      <label className="flex flex-col gap-1">
        <span>{t('StartingBalance')}</span>
        <input
          className={inputClassName}
          type="number"
          step="0.01"
          value={balance}
          onChange={(event) => setBalance(event.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-1">
        <span>{t('StartingBalanceDate')}</span>
        <input className={inputClassName} type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} required />
      </label>
      <Button type="submit" className={buttonClassName}>
        {t('SetStartingBalance')}
      </Button>
    </form>
  );
};

export default AccountSetup;
