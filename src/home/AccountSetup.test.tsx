import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccountSetup from './AccountSetup';
import type { Account } from '@/data/useAccounts';

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

describe('AccountSetup', () => {
  it('renders the create-account form and submits name/currency when there is no account', async () => {
    const user = userEvent.setup();
    const onCreateAccount = vi.fn().mockResolvedValue(undefined);
    render(<AccountSetup account={null} onCreateAccount={onCreateAccount} onSetStartingBalance={vi.fn()} />);

    await user.type(screen.getByLabelText('Account name'), 'Chequing');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(onCreateAccount).toHaveBeenCalledWith('Chequing', 'CAD');
  });

  it('switches to the starting-balance form once an account without one exists', async () => {
    const user = userEvent.setup();
    const onSetStartingBalance = vi.fn().mockResolvedValue(undefined);
    render(<AccountSetup account={account()} onCreateAccount={vi.fn()} onSetStartingBalance={onSetStartingBalance} />);

    expect(screen.queryByLabelText('Account name')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Starting balance'), '250');
    await user.click(screen.getByRole('button', { name: 'Set starting balance' }));

    expect(onSetStartingBalance).toHaveBeenCalledWith(1, 25_000, expect.any(String));
  });
});
