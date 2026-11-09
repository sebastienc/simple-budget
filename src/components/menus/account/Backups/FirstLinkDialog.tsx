import React from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { formatInstant } from '@/lib/dates';
import type { FirstLinkOffer, SyncStateSummary } from '@/data/useSync';

// A device's name is whatever its owner called it; React escapes what it shows, so i18next must not do it again.
const RAW = { escapeValue: false } as const;

export interface FirstLinkDialogProps {
  offer: FirstLinkOffer;
  isBusy: boolean;
  onChoose: (winner: 'LOCAL' | 'REMOTE') => void;
  onLater: () => void;
}

const Side: React.FC<{ title: string; summary: SyncStateSummary; suggested: boolean }> = ({ title, summary, suggested }) => {
  const { t } = useTranslation();
  const empty = summary.accounts + summary.items + summary.corrections === 0;
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-lg border border-rule p-3" data-testid="first-link-side">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
        {suggested && <Badge>{t('SyncFirstLinkSuggested')}</Badge>}
      </div>
      {empty ? (
        <p className="text-xs text-ink-3">{t('SyncFirstLinkNothing')}</p>
      ) : (
        <>
          <p className="text-xs text-ink-2">{t('SyncFirstLinkCounts', { accounts: summary.accounts, items: summary.items, corrections: summary.corrections })}</p>
          {summary.lastChange && <p className="text-xs text-ink-3">{t('SyncFirstLinkLastChange', { when: formatInstant(summary.lastChange, 'd MMM yyyy, HH:mm') })}</p>}
        </>
      )}
    </div>
  );
};

/**
 * Two devices that each hold a budget the other has never seen cannot be merged: one must take the other's data. This
 * puts both sides in front of the person, with the more recently changed one suggested, and never decides for them.
 * Closing it is "decide later": nothing is changed.
 */
const FirstLinkDialog: React.FC<FirstLinkDialogProps> = ({ offer, isBusy, onChoose, onLater }) => {
  const { t } = useTranslation();
  return (
    <Modal isOpen onOpenChange={(open) => !open && onLater()} title={t('SyncFirstLinkTitle', { name: offer.deviceName, interpolation: RAW })} closeLabel={t('Cancel')}>
      <p className="text-sm text-ink-2">{t('SyncFirstLinkBody', { name: offer.deviceName, interpolation: RAW })}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Side title={t('SyncFirstLinkThisComputer')} summary={offer.local} suggested={offer.suggested === 'LOCAL'} />
        <Side title={offer.deviceName} summary={offer.remote} suggested={offer.suggested === 'REMOTE'} />
      </div>
      <p className="text-xs text-ink-3">{t('SyncFirstLinkSafety')}</p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="link" size="sm" isDisabled={isBusy} onPress={onLater}>
          {t('SyncFirstLinkLater')}
        </Button>
        <Button variant={offer.suggested === 'LOCAL' ? 'primary' : 'ghost'} size="sm" isDisabled={isBusy} onPress={() => onChoose('LOCAL')}>
          {t('SyncFirstLinkKeepThis')}
        </Button>
        <Button variant={offer.suggested === 'REMOTE' ? 'primary' : 'ghost'} size="sm" isDisabled={isBusy} onPress={() => onChoose('REMOTE')}>
          {t('SyncFirstLinkUseOther', { name: offer.deviceName, interpolation: RAW })}
        </Button>
      </div>
    </Modal>
  );
};

export default FirstLinkDialog;
