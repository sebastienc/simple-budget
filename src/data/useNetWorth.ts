import { useEffect, useState } from 'react';

export interface NetWorthDay {
  date: string;
  totalCents: number;
}

/** One currency's worth of the combined view — accounts in different currencies are never summed together. */
export interface NetWorthGroup {
  currency: string;
  includedAccountIds: number[];
  days: NetWorthDay[];
}

export function useNetWorth(from: string, to: string, refreshToken: number = 0) {
  const [groups, setGroups] = useState<NetWorthGroup[]>([]);
  const [excludedAccountIds, setExcludedAccountIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!from || !to) {
      setGroups([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      const response = await fetch(`/api/net-worth?from=${from}&to=${to}`);
      if (cancelled) {
        return;
      }
      const body = await response.json();
      setGroups(body.groups ?? []);
      setExcludedAccountIds(body.excludedAccountIds ?? []);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [from, to, refreshToken]);

  return { groups, excludedAccountIds, isLoading };
}
