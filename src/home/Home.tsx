import React, { useState } from 'react';
import { Button } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useToaster } from '@/toast/useToaster';
import PageLayout from '../components/layouts/PageLayout';
import { useAccounts } from '@/data/useAccounts';
import AccountSetup from './AccountSetup';
import AccountSettingsForm from './AccountSettingsForm';
import RecurringItemsPanel from './RecurringItemsPanel';
import ProjectionTable from './ProjectionTable';
import NetWorthTable from './NetWorthTable';

const linkButtonClassName =
  'inline-flex cursor-default items-center justify-center rounded-md px-2 py-1 text-sm text-blue-700 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-blue-400';

const Home: React.FC = () => {
  const { t } = useTranslation();
  const { addToast } = useToaster();
  const { accounts, isLoading, createAccount, updateAccount, deleteAccount } = useAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [isViewingNetWorth, setIsViewingNetWorth] = useState(false);
  const [projectionRefreshToken, setProjectionRefreshToken] = useState(0);
  const [isEditingAccount, setIsEditingAccount] = useState(false);

  if (isLoading) {
    return <PageLayout pageTitle={t('Home')}>{null}</PageLayout>;
  }

  const currentAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0] ?? null;

  const accountSwitcher = accounts.length > 1 && (
    <div className="flex gap-2 p-4 pb-0">
      {accounts.map((account) => (
        <Button
          key={account.id}
          onPress={() => {
            setSelectedAccountId(account.id);
            setIsViewingNetWorth(false);
          }}
          className={`cursor-default rounded-md px-3 py-1.5 text-sm outline-hidden ${
            !isViewingNetWorth && account.id === currentAccount?.id
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-900 dark:bg-zinc-700 dark:text-gray-100'
          }`}
        >
          {account.name}
        </Button>
      ))}
      <Button
        onPress={() => setIsViewingNetWorth(true)}
        className={`cursor-default rounded-md px-3 py-1.5 text-sm outline-hidden ${
          isViewingNetWorth ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900 dark:bg-zinc-700 dark:text-gray-100'
        }`}
      >
        {t('AllAccounts')}
      </Button>
    </div>
  );

  if (isViewingNetWorth) {
    return (
      <PageLayout pageTitle={t('Home')}>
        {accountSwitcher}
        <NetWorthTable />
      </PageLayout>
    );
  }

  if (!currentAccount || !currentAccount.startingBalanceDate) {
    return (
      <PageLayout pageTitle={t('Home')}>
        {accountSwitcher}
        <AccountSetup
          account={currentAccount}
          onCreateAccount={createAccount}
          onSetStartingBalance={(accountId, cents, date) =>
            updateAccount(accountId, { startingBalanceCents: cents, startingBalanceDate: date })
          }
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout pageTitle={t('Home')}>
      {accountSwitcher}
      <div className="flex items-center justify-between p-4 pb-0">
        <h2 className="text-lg font-semibold">{currentAccount.name}</h2>
        {!isEditingAccount && (
          <Button className={linkButtonClassName} onPress={() => setIsEditingAccount(true)}>
            {t('EditAccount')}
          </Button>
        )}
      </div>

      {isEditingAccount ? (
        <AccountSettingsForm
          account={currentAccount}
          onSave={async (patch) => {
            await updateAccount(currentAccount.id, patch);
            addToast(t('AccountUpdated'));
            setIsEditingAccount(false);
          }}
          onDelete={async () => {
            await deleteAccount(currentAccount.id);
            addToast(t('AccountDeleted'));
            setIsEditingAccount(false);
          }}
          onCancel={() => setIsEditingAccount(false)}
        />
      ) : (
        <>
          <RecurringItemsPanel
            accountId={currentAccount.id}
            onItemsChanged={() => setProjectionRefreshToken((token) => token + 1)}
          />
          <ProjectionTable accountId={currentAccount.id} refreshToken={projectionRefreshToken} />
        </>
      )}
    </PageLayout>
  );
};

export default Home;
