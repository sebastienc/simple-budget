import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAccounts } from './useAccounts';
import type { Account } from './useAccounts';

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 1,
    name: 'Chequing',
    currency: 'CAD',
    startingBalanceCents: 0,
    startingBalanceDate: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('useAccounts', () => {
  it('fetches accounts on mount', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([account()])));

    const { result } = renderHook(() => useAccounts());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.accounts).toEqual([account()]);

    vi.unstubAllGlobals();
  });

  it('createAccount posts the new account, then refetches the list', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([])) // initial mount fetch
      .mockResolvedValueOnce(jsonResponse(account({ id: 2, name: 'Savings' }))) // POST response
      .mockResolvedValueOnce(jsonResponse([account({ id: 2, name: 'Savings' })])); // refetch after create
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAccounts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.createAccount('Savings', 'CAD');
    });

    expect(result.current.accounts).toEqual([account({ id: 2, name: 'Savings' })]);
    const [postUrl, postInit] = fetchMock.mock.calls[1];
    expect(postUrl).toBe('/api/accounts');
    expect(postInit.method).toBe('POST');
    expect(JSON.parse(postInit.body)).toEqual({ name: 'Savings', currency: 'CAD' });

    vi.unstubAllGlobals();
  });

  it('deleteAccount sends a DELETE for the given id, then refetches', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([account()]))
      .mockResolvedValueOnce({ ok: true, status: 204 } as Response)
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAccounts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.deleteAccount(1);
    });

    expect(result.current.accounts).toEqual([]);
    const [deleteUrl, deleteInit] = fetchMock.mock.calls[1];
    expect(deleteUrl).toBe('/api/accounts/1');
    expect(deleteInit.method).toBe('DELETE');

    vi.unstubAllGlobals();
  });
});
