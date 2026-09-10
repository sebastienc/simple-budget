import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import Money from '@/components/ui/Money';
import { describeRecurrence } from '@/lib/recurrence';
import type { ScratchItem } from '@/data/useProjectionPreview';
import RecurringItemForm from './RecurringItemForm';

export interface WhatIfPanelProps {
  currency: string;
  scratchItems: ScratchItem[];
  onAdd: (item: ScratchItem) => void;
  onRemove: (id: number) => void;
}

/**
 * Hypothetical recurring items overlaid on the real projection, never sent to
 * `/api/accounts/:id/recurring-items` — see useProjectionPreview. Ids count
 * down from -1 so they can never collide with a real (DB-assigned) id.
 */
const WhatIfPanel: React.FC<WhatIfPanelProps> = ({ currency, scratchItems, onAdd, onRemove }) => {
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const nextId = useRef(-1);

  return (
    <Panel
      title={t('WhatIf')}
      note={scratchItems.length > 0 ? String(scratchItems.length) : undefined}
      action={
        !isAdding ? (
          <Button variant="ghost" size="sm" onPress={() => setIsAdding(true)}>
            {t('AddWhatIfItem')}
          </Button>
        ) : undefined
      }
    >
      {isAdding && (
        <RecurringItemForm
          onSubmit={async (input) => {
            onAdd({
              id: nextId.current--,
              name: input.name,
              amountCents: input.amountCents,
              frequency: input.frequency,
              interval: input.interval,
              startDate: input.startDate,
              endDate: input.endDate ?? null,
              semiMonthlyDay1: input.semiMonthlyDay1 ?? null,
              semiMonthlyDay2: input.semiMonthlyDay2 ?? null,
            });
            setIsAdding(false);
          }}
          onCancel={() => setIsAdding(false)}
        />
      )}

      {!isAdding && scratchItems.length === 0 && <p className="text-sm text-ink-3">{t('NoWhatIfItems')}</p>}

      {scratchItems.map((item) => (
        <div key={item.id} className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-ink">{item.name}</span>
            <span className="text-xs text-ink-3">{describeRecurrence(item, t)}</span>
          </div>
          <div className="flex flex-none items-baseline gap-2">
            <Money cents={item.amountCents} currency={currency} signed className="text-sm" />
            <Button variant="link" size="sm" onPress={() => onRemove(item.id)}>
              {t('Delete')}
            </Button>
          </div>
        </div>
      ))}
    </Panel>
  );
};

export default WhatIfPanel;
