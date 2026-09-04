import React, { useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import { useTranslation } from 'react-i18next';
import BalanceChart from '@/components/charts/BalanceChart';
import Panel from '@/components/ui/Panel';
import Money from '@/components/ui/Money';
import { useNetWorth } from '@/data/useNetWorth';
import { useAccounts } from '@/data/useAccounts';
import { summarizeProjection } from '@/lib/projection';
import { todayISO, toISODate, formatISODate } from '@/lib/dates';
import AccountHero from './AccountHero';
import RangeControl from './RangeControl';

const NetWorthTable: React.FC = () => {
  const { t } = useTranslation();
  const { accounts } = useAccounts();
  const [from, setFrom] = useState(todayISO);
  const [to, setTo] = useState(() => toISODate(addDays(new Date(), 90)));
  const { days, includedAccountIds, excludedAccountIds } = useNetWorth(from, to);

  const excludedNames = excludedAccountIds.map((id) => accounts.find((account) => account.id === id)?.name).filter((name): name is string => !!name);
  const includedAccounts = accounts.filter((account) => includedAccountIds.includes(account.id));

  // The net-worth endpoint returns only per-day totals — no items — so the
  // shared summary is built over days with empty item lists. The hero's
  // "what caused it" line simply has nothing to name, which is correct here.
  const summary = useMemo(
    () => summarizeProjection(days.map((day) => ({ date: day.date, items: [], dailyTotalCents: 0, balanceCents: day.totalCents, correctionApplied: false }))),
    [days],
  );

  const chartPoints = useMemo(() => days.map((day) => ({ date: day.date, valueCents: day.totalCents })), [days]);

  return (
    <>
      <AccountHero accountName={t('NetWorth')} summary={summary} sinkingFundTotalCents={null} />

      {excludedNames.length > 0 && <p className="-mt-6 text-sm text-ink-3">{t('ExcludesAccounts', { names: excludedNames.join(', ') })}</p>}

      <div className="flex flex-col gap-3">
        <RangeControl from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        <BalanceChart points={chartPoints} ariaLabel={t('NetWorth')} />
      </div>

      {includedAccounts.length > 0 && (
        <Panel title={t('AllAccounts')} note={String(includedAccounts.length)}>
          {includedAccounts.map((account) => (
            <div key={account.id} className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm text-ink">{account.name}</span>
                {account.startingBalanceDate && <span className="font-mono text-xs text-ink-3">{formatISODate(account.startingBalanceDate, 'd MMM yyyy')}</span>}
              </div>
              <Money cents={account.startingBalanceCents} autoTone className="text-sm" />
            </div>
          ))}
        </Panel>
      )}
    </>
  );
};

export default NetWorthTable;
