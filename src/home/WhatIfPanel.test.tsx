import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WhatIfPanel from './WhatIfPanel';
import type { ScratchItem } from '@/data/useProjectionPreview';

function scratchItem(overrides: Partial<ScratchItem> = {}): ScratchItem {
  return {
    id: -1,
    name: 'Scratch',
    amountCents: -1000,
    frequency: 'monthly',
    interval: 1,
    startDate: '2026-01-01',
    endDate: null,
    semiMonthlyDay1: null,
    semiMonthlyDay2: null,
    ...overrides,
  };
}

describe('WhatIfPanel', () => {
  it('shows the empty state when there are no scratch items', () => {
    render(<WhatIfPanel currency="CAD" scratchItems={[]} onAdd={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText(/hypothetical bill or income/)).toBeInTheDocument();
  });

  it('shows the item count as the panel note once there are scratch items', () => {
    render(<WhatIfPanel currency="CAD" scratchItems={[scratchItem(), scratchItem({ id: -2 })]} onAdd={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('assigns decreasing negative ids to items added through the form', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<WhatIfPanel currency="CAD" scratchItems={[]} onAdd={onAdd} onRemove={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Add what-if item' }));
    await user.type(screen.getByLabelText('Name'), 'Bonus');
    await user.type(screen.getByLabelText('Amount'), '500');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: -1, name: 'Bonus', amountCents: 50_000 }));
  });

  it('calls onRemove with the item\'s id', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<WhatIfPanel currency="CAD" scratchItems={[scratchItem({ id: -3, name: 'Freelance gig' })]} onAdd={vi.fn()} onRemove={onRemove} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onRemove).toHaveBeenCalledWith(-3);
  });
});
