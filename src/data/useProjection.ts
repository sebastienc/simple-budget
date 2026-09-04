import { useEffect, useState } from 'react';

export interface ProjectionDay {
  date: string;
  items: { id: number; name: string; amountCents: number }[];
  dailyTotalCents: number;
  balanceCents: number;
  correctionApplied: boolean;
}

export type ProjectionError = 'starting_balance_not_set' | 'unknown';

export function useProjection(accountId: number | null, from: string, to: string, refreshToken: number = 0) {
  const [days, setDays] = useState<ProjectionDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ProjectionError | null>(null);

  useEffect(() => {
    if (accountId === null || !from || !to) {
      setDays([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/accounts/${accountId}/projection?from=${from}&to=${to}`);
      if (cancelled) {
        return;
      }
      if (response.status === 422) {
        const body = await response.json();
        setError(body.error === 'starting_balance_not_set' ? 'starting_balance_not_set' : 'unknown');
        setDays([]);
        setIsLoading(false);
        return;
      }
      if (!response.ok) {
        setError('unknown');
        setDays([]);
        setIsLoading(false);
        return;
      }
      setDays(await response.json());
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId, from, to, refreshToken]);

  return { days, isLoading, error };
}
