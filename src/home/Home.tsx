import React, { useState } from 'react';
import { Button } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import PageLayout from '../components/layouts/PageLayout';
import { useAccounts } from '@/data/useAccounts';
import AccountSetup from './AccountSetup';
import RecurringItemsPanel from './RecurringItemsPanel';
import ProjectionTable from './ProjectionTable';

const Home: React.FC = () => {
  const { t } = useTranslation();
  const { accounts, isLoading, createAccount, updateStartingBalance } = useAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  if (isLoading) {
    return <PageLayout pageTitle={t('Home')}>{null}</PageLayout>;
  }

  const currentAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0] ?? null;

  const accountSwitcher = accounts.length > 1 && (
    <div className="flex gap-2 p-4 pb-0">
      {accounts.map((account) => (
        <Button
          key={account.id}
          onPress={() => setSelectedAccountId(account.id)}
          className={`cursor-default rounded-md px-3 py-1.5 text-sm outline-hidden ${
            account.id === currentAccount?.id
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-900 dark:bg-zinc-700 dark:text-gray-100'
          }`}
        >
          {account.name}
        </Button>
      ))}
    </div>
  );

  if (!currentAccount || !currentAccount.startingBalanceDate) {
    return (
      <PageLayout pageTitle={t('Home')}>
        {accountSwitcher}
        <AccountSetup account={currentAccount} onCreateAccount={createAccount} onSetStartingBalance={updateStartingBalance} />
      </PageLayout>
    );
  }

  return (
    <PageLayout pageTitle={t('Home')}>
      {accountSwitcher}
      <RecurringItemsPanel accountId={currentAccount.id} />
      <ProjectionTable accountId={currentAccount.id} />
    </PageLayout>
  );
};

export default Home;
