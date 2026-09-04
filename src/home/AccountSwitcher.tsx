import React from 'react';
import { Button } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { Account } from '@/data/useAccounts';

export interface AccountSwitcherProps {
  accounts: Account[];
  selectedAccountId: number | null;
  isViewingNetWorth: boolean;
  onSelectAccount: (accountId: number) => void;
  onSelectNetWorth: () => void;
}

const pill = 'cursor-default rounded-md px-3 py-1.5 text-sm whitespace-nowrap outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-accent';
const selected = 'bg-surface-raised font-semibold text-ink shadow-sm';
const unselected = 'text-ink-2 hover:text-ink';

const AccountSwitcher: React.FC<AccountSwitcherProps> = ({ accounts, selectedAccountId, isViewingNetWorth, onSelectAccount, onSelectNetWorth }) => {
  const { t } = useTranslation();

  if (accounts.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-rule bg-surface p-1">
      {accounts.map((account) => (
        <Button
          key={account.id}
          onPress={() => onSelectAccount(account.id)}
          className={clsx(pill, !isViewingNetWorth && account.id === selectedAccountId ? selected : unselected)}
        >
          {account.name}
        </Button>
      ))}
      {accounts.length > 1 && (
        <Button onPress={onSelectNetWorth} className={clsx(pill, isViewingNetWorth ? selected : unselected)}>
          {t('AllAccounts')}
        </Button>
      )}
    </div>
  );
};

export default AccountSwitcher;
