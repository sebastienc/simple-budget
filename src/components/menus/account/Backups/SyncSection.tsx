import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Button from '@/components/ui/Button';
import { formatInstant } from '@/lib/dates';
import { useSync, type SkipReason, type SyncDevice, type SyncProblem } from '@/data/useSync';
import { useToaster } from '@/toast/useToaster';
import FirstLinkDialog from './FirstLinkDialog';

export interface SyncSectionProps {
  isOpen: boolean;
  /** The backup folder, which sync goes through; null if none is saved yet. */
  folder: string | null;
}

const when = (iso: string) => formatInstant(iso, 'd MMM yyyy, HH:mm');

// A device's name is whatever its owner called it ("Sebastien's Pixel"). React already escapes what it shows, so i18next
// must not escape it a second time, or the person would read "Sebastien&#39;s Pixel".
const RAW = { escapeValue: false } as const;

const SKIP_KEYS: Record<SkipReason, string> = {
  UNREADABLE: 'SyncSkipUnreadable',
  CHECKSUM: 'SyncSkipChecksum',
  NEWER_FORMAT: 'SyncSkipNewer',
  NEWER_SCHEMA: 'SyncSkipNewer',
  TOO_LARGE: 'SyncSkipTooLarge',
  INVALID: 'SyncSkipInvalid',
  FUTURE_STAMP: 'SyncSkipFuture',
};

const PROBLEM_KEYS: Record<SyncProblem, string> = {
  'folder-unreachable': 'SyncProblemUnreachable',
  failed: 'SyncProblemFailed',
  'publish-failed': 'SyncProblemPublish',
};

/**
 * Sync with the phone and other computers, through the backup folder (ADR-0008 and ADR-0009 in simple-budget-mobile).
 * It says only what this computer did: it cannot know whether the cloud client, or another device, has received anything.
 */
const SyncSection: React.FC<SyncSectionProps> = ({ isOpen, folder }) => {
  const { t } = useTranslation();
  const { addToast } = useToaster();
  const { status, refresh, enable, disable, syncNow, resolve } = useSync(isOpen, folder);
  const [isBusy, setIsBusy] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);

  const busy = async (action: () => Promise<void>) => {
    setIsBusy(true);
    try {
      await action();
    } finally {
      setIsBusy(false);
    }
  };

  const handleTurnOn = () =>
    busy(async () => {
      const result = await enable();
      addToast(t(result.ok ? 'SyncTurnedOn' : 'SyncEnableFailed'));
    });

  const handleTurnOff = () =>
    busy(async () => {
      const result = await disable();
      addToast(t(result.ok ? 'SyncTurnedOff' : 'SyncEnableFailed'));
    });

  const handleSyncNow = () =>
    busy(async () => {
      await syncNow();
    });

  const offer = status?.devices.find((device): device is Extract<SyncDevice, { kind: 'offer' }> => device.kind === 'offer' && device.deviceId === reviewing)?.offer;

  const handleChoose = (winner: 'LOCAL' | 'REMOTE') =>
    busy(async () => {
      if (!offer) return;
      const result = await resolve(offer, winner);
      setReviewing(null);
      if (!result.ok) {
        addToast(t(result.error === 'offer_expired' ? 'SyncOfferExpired' : 'SyncResolveFailed'));
        // Show how things stand now: the offer the person decided about may be gone, or a newer one waiting.
        await refresh();
        return;
      }
      if (winner === 'REMOTE') {
        // The data was replaced under every hook in the tree, as a restore does: reload rather than refetch.
        window.location.reload();
      }
    });

  const deviceLine = (device: SyncDevice) => {
    switch (device.kind) {
      case 'merged':
        return t('SyncDeviceMerged', { name: device.deviceName, when: when(device.writtenAt), interpolation: RAW });
      case 'waiting':
        return t('SyncDeviceWaiting', { name: device.deviceName, interpolation: RAW });
      case 'offer':
        return t('SyncDeviceOffer', { name: device.offer.deviceName, interpolation: RAW });
      case 'skipped':
        return t('SyncDeviceSkipped', { name: t('SyncUnknownDevice', { id: device.deviceId.slice(0, 8) }), reason: t(SKIP_KEYS[device.reason]) });
    }
  };

  return (
    <div className="flex flex-col gap-2" data-testid="sync-section">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule-strong pb-2">
        <h3 className="text-sm font-semibold text-ink">{t('SyncTitle')}</h3>
        {status?.enabled && (
          <Button variant="link" size="sm" isDisabled={isBusy || status.running} onPress={handleSyncNow}>
            <ArrowPathIcon className="h-3.5 w-3.5" />
            {isBusy || status.running ? t('SyncSyncing') : t('SyncNow')}
          </Button>
        )}
      </div>

      {folder === null && <p className="text-sm text-ink-3">{t('SyncNeedsFolder')}</p>}

      {folder !== null && !status?.enabled && (
        <>
          <p className="text-xs text-ink-3">{t('SyncExplanation')}</p>
          <div>
            <Button size="sm" isDisabled={isBusy || status === null} onPress={handleTurnOn}>
              {t('SyncTurnOn')}
            </Button>
          </div>
        </>
      )}

      {folder !== null && status?.enabled && (
        <>
          {status.problem && (
            <p className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-ink-2" role="alert">
              <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-none text-warn" />
              {t(PROBLEM_KEYS[status.problem])}
            </p>
          )}

          <div className="flex flex-col gap-0.5 text-xs text-ink-2">
            <span>{status.lastRead ? t('SyncLastRead', { when: when(status.lastRead) }) : t('SyncNeverRead')}</span>
            <span>{status.lastWrite ? t('SyncLastWrite', { when: when(status.lastWrite) }) : t('SyncNeverWrote')}</span>
            {status.changesBroughtIn !== null && <span>{status.changesBroughtIn === 0 ? t('SyncNothingNew') : t('SyncChangesBrought', { count: status.changesBroughtIn })}</span>}
          </div>
          <p className="text-xs text-ink-3">{t('SyncNote')}</p>

          <h4 className="pt-2 text-xs font-semibold tracking-wider text-ink-3 uppercase">{t('SyncOtherDevices')}</h4>
          {status.devices.length === 0 && <p className="text-sm text-ink-3">{t('SyncNoOtherDevices')}</p>}
          {status.devices.map((device) => (
            <div key={device.deviceId} className="flex items-baseline justify-between gap-3 border-b border-rule py-2" data-testid={`sync-device-${device.deviceId}`}>
              <span className="min-w-0 flex-1 text-sm text-ink">{deviceLine(device)}</span>
              {device.kind === 'offer' && (
                <Button variant="link" size="sm" isDisabled={isBusy} onPress={() => setReviewing(device.deviceId)}>
                  {t('SyncReview')}
                </Button>
              )}
            </div>
          ))}

          <div className="flex items-baseline justify-between gap-4 pt-1">
            <p className="text-xs text-ink-3">{t('SyncTurnOffNote')}</p>
            <Button variant="link" size="sm" isDisabled={isBusy} onPress={handleTurnOff}>
              {t('SyncTurnOff')}
            </Button>
          </div>
        </>
      )}

      {offer && <FirstLinkDialog offer={offer} isBusy={isBusy} onChoose={handleChoose} onLater={() => setReviewing(null)} />}
    </div>
  );
};

export default SyncSection;
