import React, { useState } from 'react';
import { Button } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import type { Account, AccountPatch } from '@/data/useAccounts';

export interface AccountSettingsFormProps {
  account: Account;
  onSave: (patch: AccountPatch) => Promise<void>;
  onDelete: () => Promise<void>;
  onCancel: () => void;
}

const inputClassName =
  'rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-gray-100';

const buttonClassName =
  'inline-flex cursor-default items-center justify-center rounded-md px-4 py-2 outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-blue-600';

const AccountSettingsForm: React.FC<AccountSettingsFormProps> = ({ account, onSave, onDelete, onCancel }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(account.name);
  const [balance, setBalance] = useState(String(account.startingBalanceCents / 100));
  const [asOf, setAsOf] = useState(account.startingBalanceDate ?? new Date().toISOString().slice(0, 10));

  return (
    <form
      className="flex max-w-sm flex-col gap-3 p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSave({
          name,
          startingBalanceCents: Math.round(parseFloat(balance || '0') * 100),
          startingBalanceDate: asOf,
        });
      }}
    >
      <label className="flex flex-col gap-1">
        <span>{t('AccountName')}</span>
        <input className={inputClassName} value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
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
      <Button
        type="button"
        onPress={async () => {
          if (window.confirm(t('DeleteAccountConfirm'))) {
            await onDelete();
          }
        }}
        className={`${buttonClassName} self-start bg-red-600 text-white hover:bg-red-500 pressed:bg-red-700`}
      >
        {t('DeleteAccount')}
      </Button>
    </form>
  );
};

export default AccountSettingsForm;
