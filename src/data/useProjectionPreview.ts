import { useEffect, useState } from 'react';
import type { Frequency } from './useRecurringItems';
import type { ProjectionDay } from './useProjection';

/** A hypothetical recurring item, never persisted — the client assigns a negative id so it can't collide with a real one. */
export interface ScratchItem {
  id: number;
  name: string;
  amountCents: number;
  frequency: Frequency;
  interval: number;
  startDate: string;
  endDate: string | null;
  semiMonthlyDay1: number | null;
  semiMonthlyDay2: number | null;
}

export function useProjectionPreview(accountId: number | null, from: string, to: string, scratchItems: ScratchItem[]) {
  const [days, setDays] = useState<ProjectionDay[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (accountId === null || !from || !to || scratchItems.length === 0) {
      setDays([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      const response = await fetch(`/api/accounts/${accountId}/projection/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, scratchItems }),
      });
      if (cancelled) {
        return;
      }
      if (!response.ok) {
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
  }, [accountId, from, to, scratchItems]);

  return { days, isLoading };
}
