import React, { useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useToaster } from '@/toast/useToaster';
import PageLayout from '@/components/layouts/PageLayout';
import Button from '@/components/ui/Button';
import BalanceChart from '@/components/charts/BalanceChart';
import { useAccounts } from '@/data/useAccounts';
import { useProjection } from '@/data/useProjection';
import { useRecurringItems } from '@/data/useRecurringItems';
import { summarizeProjection } from '@/lib/projection';
import { summarizeSinkingFunds } from '@/lib/sinkingFund';
import { todayISO, toISODate } from '@/lib/dates';
import AccountSwitcher from './AccountSwitcher';
import AccountHero from './AccountHero';
import RangeControl from './RangeControl';
import AccountSetup from './AccountSetup';
import AccountSettingsForm from './AccountSettingsForm';
import RecurringItemsPanel from './RecurringItemsPanel';
import BalanceCheckpointsPanel from './BalanceCheckpointsPanel';
import ProjectionTable from './ProjectionTable';
import UpcomingPanel from './UpcomingPanel';
import NetWorthTable from './NetWorthTable';

const Home: React.FC = () => {
  const { t } = useTranslation();
  const { addToast } = useToaster();
  const { accounts, isLoading, createAccount, updateAccount, deleteAccount } = useAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [isViewingNetWorth, setIsViewingNetWorth] = useState(false);
  const [projectionRefreshToken, setProjectionRefreshToken] = useState(0);
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [from, setFrom] = useState(todayISO);
  const [to, setTo] = useState(() => toISODate(addDays(new Date(), 90)));

  const currentAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0] ?? null;
  const accountId = currentAccount?.startingBalanceDate ? currentAccount.id : null;

  // Fetched once here and shared by the hero, the chart and the ledger, rather
  // than each of them opening its own request for the same days.
  const { days, error } = useProjection(accountId, from, to, projectionRefreshToken);
  const { items } = useRecurringItems(accountId, projectionRefreshToken);

  const summary = useMemo(() => summarizeProjection(days), [days]);
  const chartPoints = useMemo(() => days.map((day) => ({ date: day.date, valueCents: day.balanceCents })), [days]);

  const sinkingFund = useMemo(() => summarizeSinkingFunds(items, todayISO()), [items]);

  const bumpProjection = () => setProjectionRefreshToken((token) => token + 1);

  const toolbar = (
    <AccountSwitcher
      accounts={accounts}
      selectedAccountId={currentAccount?.id ?? null}
      isViewingNetWorth={isViewingNetWorth}
      onSelectAccount={(id) => {
        setSelectedAccountId(id);
        setIsViewingNetWorth(false);
      }}
      onSelectNetWorth={() => setIsViewingNetWorth(true)}
    />
  );

  if (isLoading) {
    return <PageLayout>{null}</PageLayout>;
  }

  if (isViewingNetWorth) {
    return <PageLayout toolbar={toolbar}>{<NetWorthTable />}</PageLayout>;
  }

  if (!currentAccount || !currentAccount.startingBalanceDate) {
    return (
      <PageLayout toolbar={toolbar}>
        <AccountSetup
          account={currentAccount}
          onCreateAccount={createAccount}
          onSetStartingBalance={(id, cents, date) => updateAccount(id, { startingBalanceCents: cents, startingBalanceDate: date })}
        />
      </PageLayout>
    );
  }

  if (isEditingAccount) {
    return (
      <PageLayout toolbar={toolbar}>
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
      </PageLayout>
    );
  }

  return (
    <PageLayout toolbar={toolbar}>
      <div className="flex items-start justify-between gap-6">
        <AccountHero accountName={currentAccount.name} summary={summary} sinkingFund={sinkingFund} />
        <Button variant="link" size="sm" className="flex-none" onPress={() => setIsEditingAccount(true)}>
          {t('EditAccount')}
        </Button>
      </div>

      {error === 'unknown' && <p className="text-sm text-warn">{t('CouldNotLoadProjection')}</p>}

      <div className="flex flex-col gap-3">
        <RangeControl from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        <BalanceChart points={chartPoints} ariaLabel={t('Projection')} />
      </div>

      <div className="grid gap-10 md:grid-cols-[1.15fr_1fr]">
        <RecurringItemsPanel accountId={currentAccount.id} onItemsChanged={bumpProjection} />
        <UpcomingPanel summary={summary} />
      </div>

      <ProjectionTable days={days} summary={summary} />
      <BalanceCheckpointsPanel accountId={currentAccount.id} onCheckpointsChanged={bumpProjection} />
    </PageLayout>
  );
};

export default Home;
