import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecurringItemForm from './RecurringItemForm';

async function fillMinimum(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Name'), 'Rent');
  await user.type(screen.getByLabelText('Amount'), '1500');
}

describe('RecurringItemForm', () => {
  it('submits a monthly item with the default frequency and interval', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RecurringItemForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await fillMinimum(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Rent',
        amountCents: 150_000,
        frequency: 'monthly',
        interval: 1,
        sinkingFund: false,
      }),
    );
  });

  it('collapses to a single-day payment when One-time payment is checked', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RecurringItemForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await fillMinimum(user);
    await user.click(screen.getByLabelText('One-time payment'));
    await user.type(screen.getByLabelText('Start date'), '2026-03-15');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.frequency).toBe('daily');
    expect(submitted.interval).toBe(1);
    expect(submitted.endDate).toBe(submitted.startDate);
    expect(submitted.semiMonthlyDay1).toBeNull();
    expect(submitted.semiMonthlyDay2).toBeNull();

    // The frequency/end-date fields disappear entirely once one-time is checked.
    expect(screen.queryByLabelText('End date (optional)')).not.toBeInTheDocument();
  });

  it('submits with the checked sinkingFund flag', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RecurringItemForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await fillMinimum(user);
    await user.click(screen.getByLabelText('Sinking fund'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit.mock.calls[0][0].sinkingFund).toBe(true);
  });

  it('calls onCancel without submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    render(<RecurringItemForm onSubmit={onSubmit} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('seeds every field from initialValue when editing', () => {
    render(
      <RecurringItemForm
        initialValue={{
          id: 1,
          accountId: 1,
          name: 'Internet',
          amountCents: -8000,
          frequency: 'monthly',
          interval: 1,
          startDate: '2026-01-01',
          endDate: null,
          semiMonthlyDay1: null,
          semiMonthlyDay2: null,
          sinkingFund: false,
          nextOccurrenceDate: null,
          suggestedMonthlySetAsideCents: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Name')).toHaveValue('Internet');
    expect(screen.getByLabelText('Amount')).toHaveValue(-80);
  });
});
