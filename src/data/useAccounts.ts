import { useCallback, useEffect, useState } from 'react';

export interface Account {
  id: number;
  name: string;
  startingBalanceCents: number;
  startingBalanceDate: string | null;
  createdAt: string;
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const response = await fetch('/api/accounts');
    setAccounts(await response.json());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createAccount = useCallback(
    async (name: string) => {
      await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      await refresh();
    },
    [refresh],
  );

  const updateStartingBalance = useCallback(
    async (accountId: number, startingBalanceCents: number, startingBalanceDate: string) => {
      await fetch(`/api/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startingBalanceCents, startingBalanceDate }),
      });
      await refresh();
    },
    [refresh],
  );

  return { accounts, isLoading, createAccount, updateStartingBalance };
}
