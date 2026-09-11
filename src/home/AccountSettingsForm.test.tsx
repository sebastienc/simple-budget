import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccountSettingsForm from './AccountSettingsForm';
import type { Account } from '@/data/useAccounts';

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 1,
    name: 'Chequing',
    currency: 'CAD',
    startingBalanceCents: 150_000,
    startingBalanceDate: '2026-01-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('AccountSettingsForm', () => {
  it('seeds fields from the account and submits the parsed balance in cents', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<AccountSettingsForm account={account()} onSave={onSave} onDelete={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText('Account name')).toHaveValue('Chequing');
    expect(screen.getByLabelText('Starting balance')).toHaveValue(1500);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({
      name: 'Chequing',
      currency: 'CAD',
      startingBalanceCents: 150_000,
      startingBalanceDate: '2026-01-01',
    });
  });

  it('calls onDelete only after the user confirms the native dialog', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AccountSettingsForm account={account()} onSave={vi.fn()} onDelete={onDelete} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Delete account' }));
    expect(onDelete).not.toHaveBeenCalled();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Delete account' }));
    expect(onDelete).toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('calls onCancel without saving', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<AccountSettingsForm account={account()} onSave={onSave} onDelete={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
