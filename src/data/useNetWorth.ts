import { useEffect, useState } from 'react';

export interface NetWorthDay {
  date: string;
  totalCents: number;
}

export function useNetWorth(from: string, to: string, refreshToken: number = 0) {
  const [days, setDays] = useState<NetWorthDay[]>([]);
  const [includedAccountIds, setIncludedAccountIds] = useState<number[]>([]);
  const [excludedAccountIds, setExcludedAccountIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!from || !to) {
      setDays([]);
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
      setDays(body.days ?? []);
      setIncludedAccountIds(body.includedAccountIds ?? []);
      setExcludedAccountIds(body.excludedAccountIds ?? []);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [from, to, refreshToken]);

  return { days, includedAccountIds, excludedAccountIds, isLoading };
}
