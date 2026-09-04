import { useCallback, useEffect, useState } from 'react';

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurringItem {
  id: number;
  accountId: number;
  name: string;
  amountCents: number;
  frequency: Frequency;
  interval: number;
  startDate: string;
  endDate: string | null;
  createdAt: string;
}

export interface RecurringItemInput {
  name: string;
  amountCents: number;
  frequency: Frequency;
  interval: number;
  startDate: string;
  endDate?: string | null;
}

export function useRecurringItems(accountId: number | null) {
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (accountId === null) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const response = await fetch(`/api/accounts/${accountId}/recurring-items`);
    setItems(await response.json());
    setIsLoading(false);
  }, [accountId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createItem = useCallback(
    async (input: RecurringItemInput) => {
      if (accountId === null) {
        return;
      }
      await fetch(`/api/accounts/${accountId}/recurring-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      await refresh();
    },
    [accountId, refresh],
  );

  const updateItem = useCallback(
    async (id: number, input: Partial<RecurringItemInput>) => {
      await fetch(`/api/recurring-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      await refresh();
    },
    [refresh],
  );

  const deleteItem = useCallback(
    async (id: number) => {
      await fetch(`/api/recurring-items/${id}`, { method: 'DELETE' });
      await refresh();
    },
    [refresh],
  );

  return { items, isLoading, createItem, updateItem, deleteItem };
}
