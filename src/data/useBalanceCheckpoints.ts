import { useCallback, useEffect, useState } from 'react';

export interface BalanceCheckpoint {
  id: number;
  accountId: number;
  date: string;
  balanceCents: number;
  /** What the forecast predicted for this date; null on the earliest correction. */
  projectedCents: number | null;
  /** projected − actual. Positive means the forecast ran high. */
  driftCents: number | null;
  daysSincePrevious: number | null;
  createdAt: string;
}

export function useBalanceCheckpoints(accountId: number | null) {
  const [checkpoints, setCheckpoints] = useState<BalanceCheckpoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (accountId === null) {
      setCheckpoints([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const response = await fetch(`/api/accounts/${accountId}/checkpoints`);
    setCheckpoints(await response.json());
    setIsLoading(false);
  }, [accountId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createOrUpdateCheckpoint = useCallback(
    async (date: string, balanceCents: number) => {
      if (accountId === null) {
        return;
      }
      await fetch(`/api/accounts/${accountId}/checkpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, balanceCents }),
      });
      await refresh();
    },
    [accountId, refresh],
  );

  const deleteCheckpoint = useCallback(
    async (id: number) => {
      await fetch(`/api/checkpoints/${id}`, { method: 'DELETE' });
      await refresh();
    },
    [refresh],
  );

  return { checkpoints, isLoading, createOrUpdateCheckpoint, deleteCheckpoint };
}
