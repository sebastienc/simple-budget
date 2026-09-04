import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import { centsToInputValue, parseAmountToCents } from '@/lib/money';
import { todayISO } from '@/lib/dates';
import type { Account, AccountPatch } from '@/data/useAccounts';

export interface AccountSettingsFormProps {
  account: Account;
  onSave: (patch: AccountPatch) => Promise<void>;
  onDelete: () => Promise<void>;
  onCancel: () => void;
}

const AccountSettingsForm: React.FC<AccountSettingsFormProps> = ({ account, onSave, onDelete, onCancel }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(account.name);
  const [balance, setBalance] = useState(centsToInputValue(account.startingBalanceCents));
  const [asOf, setAsOf] = useState(account.startingBalanceDate ?? todayISO());

  return (
    <form
      className="flex max-w-sm flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSave({ name, startingBalanceCents: parseAmountToCents(balance), startingBalanceDate: asOf });
      }}
    >
      <TextField label={t('AccountName')} value={name} onChange={setName} isRequired />
      <TextField label={t('StartingBalance')} type="number" step="0.01" value={balance} onChange={setBalance} isRequired />
      <TextField label={t('StartingBalanceDate')} type="date" value={asOf} onChange={setAsOf} isRequired />

      <div className="flex gap-2">
        <Button type="submit">{t('Save')}</Button>
        <Button type="button" variant="ghost" onPress={onCancel}>
          {t('Cancel')}
        </Button>
      </div>

      <Button
        type="button"
        variant="danger"
        className="mt-4 self-start"
        onPress={async () => {
          if (window.confirm(t('DeleteAccountConfirm'))) {
            await onDelete();
          }
        }}
      >
        {t('DeleteAccount')}
      </Button>
    </form>
  );
};

export default AccountSettingsForm;
