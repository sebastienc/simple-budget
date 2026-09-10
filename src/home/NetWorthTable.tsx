import React, { useMemo, useState } from 'react';
import { addMonths } from 'date-fns';
import { useTranslation } from 'react-i18next';
import BalanceChart from '@/components/charts/BalanceChart';
import Panel from '@/components/ui/Panel';
import Money from '@/components/ui/Money';
import { useNetWorth, type NetWorthGroup } from '@/data/useNetWorth';
import { useAccounts, type Account } from '@/data/useAccounts';
import { summarizeProjection } from '@/lib/projection';
import { todayISO, toISODate, formatISODate } from '@/lib/dates';
import AccountHero from './AccountHero';
import RangeControl from './RangeControl';

interface CurrencyGroupProps {
  group: NetWorthGroup;
  accounts: Account[];
  /** "Net worth", qualified with the currency when there's more than one group to tell apart. */
  heading: string;
}

// A separate component so each group's summary/chart-points can be memoized
// per its own `days` — the groups themselves are never mixed or summed.
const CurrencyGroup: React.FC<CurrencyGroupProps> = ({ group, accounts, heading }) => {
  const { t } = useTranslation();
  const includedAccounts = accounts.filter((account) => group.includedAccountIds.includes(account.id));

  // The net-worth endpoint returns only per-day totals — no items — so the
  // shared summary is built over days with empty item lists. The hero's
  // "what caused it" line simply has nothing to name, which is correct here.
  const summary = useMemo(
    () => summarizeProjection(group.days.map((day) => ({ date: day.date, items: [], dailyTotalCents: 0, balanceCents: day.totalCents, correctionApplied: false }))),
    [group.days],
  );

  const chartPoints = useMemo(() => group.days.map((day) => ({ date: day.date, valueCents: day.totalCents })), [group.days]);

  return (
    <>
      <AccountHero accountName={heading} currency={group.currency} summary={summary} sinkingFund={null} accuracy={null} />
      <BalanceChart points={chartPoints} currency={group.currency} ariaLabel={heading} />

      {includedAccounts.length > 0 && (
        <Panel title={t('AllAccounts')} note={String(includedAccounts.length)}>
          {includedAccounts.map((account) => (
            <div key={account.id} className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm text-ink">{account.name}</span>
                {account.startingBalanceDate && <span className="font-mono text-xs text-ink-3">{formatISODate(account.startingBalanceDate, 'd MMM yyyy')}</span>}
              </div>
              <Money cents={account.startingBalanceCents} currency={account.currency} autoTone className="text-sm" />
            </div>
          ))}
        </Panel>
      )}
    </>
  );
};

const NetWorthTable: React.FC = () => {
  const { t } = useTranslation();
  const { accounts } = useAccounts();
  const [from, setFrom] = useState(todayISO);
  const [to, setTo] = useState(() => toISODate(addMonths(new Date(), 3)));
  const { groups, excludedAccountIds } = useNetWorth(from, to);

  const excludedNames = excludedAccountIds.map((id) => accounts.find((account) => account.id === id)?.name).filter((name): name is string => !!name);

  return (
    <>
      {excludedNames.length > 0 && <p className="text-sm text-ink-3">{t('ExcludesAccounts', { names: excludedNames.join(', ') })}</p>}

      <RangeControl from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

      {groups.length === 0 ? (
        <AccountHero accountName={t('NetWorth')} currency="CAD" summary={null} sinkingFund={null} accuracy={null} />
      ) : (
        groups.map((group) => (
          <CurrencyGroup key={group.currency} group={group} accounts={accounts} heading={groups.length > 1 ? `${t('NetWorth')} (${group.currency})` : t('NetWorth')} />
        ))
      )}
    </>
  );
};

export default NetWorthTable;
