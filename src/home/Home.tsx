import React, { useEffect, useMemo, useState } from 'react';
import { addMonths } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useToaster } from '@/toast/useToaster';
import PageLayout from '@/components/layouts/PageLayout';
import Button from '@/components/ui/Button';
import BalanceChart from '@/components/charts/BalanceChart';
import { useAccounts } from '@/data/useAccounts';
import { useProjection } from '@/data/useProjection';
import { useProjectionPreview, type ScratchItem } from '@/data/useProjectionPreview';
import { useRecurringItems } from '@/data/useRecurringItems';
import { summarizeProjection } from '@/lib/projection';
import { summarizeSinkingFunds } from '@/lib/sinkingFund';
import { summarizeAccuracy } from '@/lib/accuracy';
import { useBalanceCheckpoints } from '@/data/useBalanceCheckpoints';
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
import WhatIfPanel from './WhatIfPanel';

const Home: React.FC = () => {
  const { t } = useTranslation();
  const { addToast } = useToaster();
  const { accounts, isLoading, createAccount, updateAccount, deleteAccount } = useAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [isViewingNetWorth, setIsViewingNetWorth] = useState(false);
  const [projectionRefreshToken, setProjectionRefreshToken] = useState(0);
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [from, setFrom] = useState(todayISO);
  const [to, setTo] = useState(() => toISODate(addMonths(new Date(), 3)));

  const currentAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0] ?? null;
  const accountId = currentAccount?.startingBalanceDate ? currentAccount.id : null;

  // Fetched once here and shared by the hero, the chart and the ledger, rather
  // than each of them opening its own request for the same days.
  const { days, error } = useProjection(accountId, from, to, projectionRefreshToken);
  const { items } = useRecurringItems(accountId, projectionRefreshToken);

  // Hypothetical items, never persisted — see WhatIfPanel/useProjectionPreview.
  // Scoped to one account at a time: switching accounts starts a fresh scenario.
  const [scratchItems, setScratchItems] = useState<ScratchItem[]>([]);
  useEffect(() => setScratchItems([]), [accountId]);
  const { days: previewDays } = useProjectionPreview(accountId, from, to, scratchItems);

  const summary = useMemo(() => summarizeProjection(days), [days]);
  const chartPoints = useMemo(() => days.map((day) => ({ date: day.date, valueCents: day.balanceCents })), [days]);
  const comparisonPoints = useMemo(
    () => (scratchItems.length > 0 ? previewDays.map((day) => ({ date: day.date, valueCents: day.balanceCents })) : undefined),
    [scratchItems, previewDays],
  );

  const sinkingFund = useMemo(() => summarizeSinkingFunds(items, todayISO()), [items]);

  // Corrections are the record of what actually happened; the hero uses them to
  // qualify its own headline, and the chart marks where they fall.
  const { checkpoints } = useBalanceCheckpoints(accountId);
  const accuracy = useMemo(() => summarizeAccuracy(checkpoints), [checkpoints]);
  const chartMarkers = useMemo(() => checkpoints.map((c) => ({ date: c.date, driftCents: c.driftCents })), [checkpoints]);

  const bumpProjection = () => setProjectionRefreshToken((token) => token + 1);

  const toolbar = (
    <AccountSwitcher
      accounts={accounts}
      selectedAccountId={currentAccount?.id ?? null}
      isViewingNetWorth={isViewingNetWorth}
      onSelectAccount={(id) => {
        setSelectedAccountId(id);
        setIsViewingNetWorth(false);
        setIsCreatingAccount(false);
      }}
      onSelectNetWorth={() => {
        setIsViewingNetWorth(true);
        setIsCreatingAccount(false);
      }}
      onAddAccount={() => {
        setIsViewingNetWorth(false);
        setIsCreatingAccount(true);
      }}
    />
  );

  if (isLoading) {
    return <PageLayout>{null}</PageLayout>;
  }

  if (isViewingNetWorth) {
    return <PageLayout toolbar={toolbar}>{<NetWorthTable />}</PageLayout>;
  }

  if (isCreatingAccount || !currentAccount || !currentAccount.startingBalanceDate) {
    return (
      <PageLayout toolbar={toolbar}>
        <AccountSetup
          account={isCreatingAccount ? null : currentAccount}
          onCreateAccount={async (name, currency) => {
            const created = await createAccount(name, currency);
            setSelectedAccountId(created.id);
            setIsCreatingAccount(false);
          }}
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
        <AccountHero accountName={currentAccount.name} currency={currentAccount.currency} summary={summary} sinkingFund={sinkingFund} accuracy={accuracy} />
        <Button variant="link" size="sm" className="flex-none" onPress={() => setIsEditingAccount(true)}>
          {t('EditAccount')}
        </Button>
      </div>

      {error === 'unknown' && <p className="text-sm text-warn">{t('CouldNotLoadProjection')}</p>}

      <div className="flex flex-col gap-3">
        <RangeControl from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        <BalanceChart points={chartPoints} currency={currentAccount.currency} comparisonPoints={comparisonPoints} markers={chartMarkers} ariaLabel={t('Projection')} />
        {comparisonPoints && <p className="text-xs text-ink-3">{t('WhatIfLegend')}</p>}
      </div>

      <WhatIfPanel
        currency={currentAccount.currency}
        scratchItems={scratchItems}
        onAdd={(item) => setScratchItems((current) => [...current, item])}
        onRemove={(id) => setScratchItems((current) => current.filter((item) => item.id !== id))}
      />

      <div className="grid gap-10 md:grid-cols-[1.15fr_1fr]">
        <RecurringItemsPanel accountId={currentAccount.id} currency={currentAccount.currency} onItemsChanged={bumpProjection} />
        <UpcomingPanel currency={currentAccount.currency} summary={summary} />
      </div>

      <ProjectionTable days={days} currency={currentAccount.currency} summary={summary} />
      <BalanceCheckpointsPanel accountId={currentAccount.id} currency={currentAccount.currency} onCheckpointsChanged={bumpProjection} />
    </PageLayout>
  );
};

export default Home;
