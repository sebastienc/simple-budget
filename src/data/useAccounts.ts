import { useCallback, useEffect, useState } from 'react';

export interface Account {
  id: number;
  name: string;
  currency: string;
  startingBalanceCents: number;
  startingBalanceDate: string | null;
  createdAt: string;
}

export interface AccountPatch {
  name?: string;
  currency?: string;
  startingBalanceCents?: number;
  startingBalanceDate?: string;
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
    async (name: string, currency: string) => {
      await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, currency }),
      });
      await refresh();
    },
    [refresh],
  );

  const updateAccount = useCallback(
    async (accountId: number, patch: AccountPatch) => {
      await fetch(`/api/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await refresh();
    },
    [refresh],
  );

  const deleteAccount = useCallback(
    async (accountId: number) => {
      await fetch(`/api/accounts/${accountId}`, { method: 'DELETE' });
      await refresh();
    },
    [refresh],
  );

  return { accounts, isLoading, createAccount, updateAccount, deleteAccount };
}
