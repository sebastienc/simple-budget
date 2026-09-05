import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import { formatInstant } from '@/lib/dates';
import { useBackupFolder, type Snapshot } from '@/data/useBackupFolder';
import { useToaster } from '@/toast/useToaster';

export interface BackupsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/** Sizes here are tens of kilobytes; the point is only "this file isn't empty". */
function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const BackupsDialog: React.FC<BackupsDialogProps> = ({ isOpen, onOpenChange }) => {
  const { t } = useTranslation();
  const { addToast } = useToaster();
  const { folder, keep, folderAvailable, detected, snapshots, isLoading, save, snapshotNow, restore } = useBackupFolder(isOpen);

  const [folderInput, setFolderInput] = useState('');
  const [keepInput, setKeepInput] = useState('10');
  const [isBusy, setIsBusy] = useState(false);

  // Seeded from the server rather than held in a single source of truth: the
  // field is a draft until saved, and reopening the panel should discard it.
  useEffect(() => {
    setFolderInput(folder ?? '');
    setKeepInput(String(keep));
  }, [folder, keep]);

  const handleSave = async (nextFolder: string | null) => {
    setIsBusy(true);
    const result = await save(nextFolder, parseInt(keepInput, 10) || 10);
    setIsBusy(false);

    if (!result.ok) {
      addToast(t(result.error === 'folder_not_writable' ? 'BackupFolderNotWritable' : 'BackupSettingsFailed'));
      return;
    }
    addToast(t(nextFolder ? (result.snapshotFailed ? 'BackupSettingsSavedNoSnapshot' : 'BackupSettingsSaved') : 'BackupsTurnedOff'));
  };

  const handleSnapshotNow = async () => {
    setIsBusy(true);
    const ok = await snapshotNow();
    setIsBusy(false);
    addToast(t(ok ? 'SnapshotTaken' : 'SnapshotFailed'));
  };

  const handleRestore = async (snapshot: Snapshot) => {
    const when = formatInstant(snapshot.takenAt, 'd MMMM yyyy, HH:mm');
    if (!window.confirm(t('RestoreConfirm', { when, host: snapshot.host }))) {
      return;
    }

    setIsBusy(true);
    const result = await restore(snapshot.name);
    setIsBusy(false);

    if (!result.ok) {
      addToast(t('RestoreFailed'));
      return;
    }
    // Reloading rather than refetching: every hook in the tree is holding data
    // from the database that was just replaced.
    window.alert(`${t('RestoreDone')}\n\n${t('WipeBackupSavedTo', { path: result.backupPath })}`);
    window.location.reload();
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} title={t('Backups')} description={t('BackupsDescription')} closeLabel={t('Cancel')}>
      <div className="flex flex-col gap-3">
        <TextField label={t('BackupFolder')} value={folderInput} onChange={setFolderInput} placeholder={t('BackupFolderPlaceholder')} inputClassName="font-mono text-xs" />

        {detected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-3">{t('DetectedFolders')}</span>
            {detected.map((candidate) => (
              <Button key={candidate.path} variant="ghost" size="sm" onPress={() => setFolderInput(candidate.path)}>
                {candidate.label}
              </Button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-3">
          <TextField label={t('KeepSnapshots')} type="number" min={1} value={keepInput} onChange={setKeepInput} className="w-32" />
          <div className="flex flex-1 items-center justify-end gap-2">
            {folder && (
              <Button variant="link" size="sm" isDisabled={isBusy} onPress={() => handleSave(null)}>
                {t('TurnOffBackups')}
              </Button>
            )}
            <Button size="sm" isDisabled={isBusy || !folderInput.trim()} onPress={() => handleSave(folderInput.trim())}>
              {t('Save')}
            </Button>
          </div>
        </div>

        {folder && !folderAvailable && (
          <p className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-ink-2">
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-none text-warn" />
            {t('BackupFolderMissing')}
          </p>
        )}
      </div>

      {folder && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-4 border-b border-rule-strong pb-2">
            <h3 className="text-sm font-semibold text-ink">{t('Snapshots')}</h3>
            <Button variant="link" size="sm" isDisabled={isBusy} onPress={handleSnapshotNow}>
              <ArrowPathIcon className="h-3.5 w-3.5" />
              {t('BackUpNow')}
            </Button>
          </div>

          {isLoading && snapshots.length === 0 && <p className="text-sm text-ink-3">{t('Loading')}</p>}
          {!isLoading && snapshots.length === 0 && <p className="text-sm text-ink-3">{t('NoSnapshotsYet')}</p>}

          {snapshots.map((snapshot) => (
            <div key={snapshot.name} className="flex items-baseline justify-between gap-3 border-b border-rule py-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-ink">{formatInstant(snapshot.takenAt, 'd MMM yyyy, HH:mm')}</span>
                <span className="font-mono text-xs text-ink-3">
                  {snapshot.isThisMachine ? t('FromThisMachine') : t('FromMachine', { host: snapshot.host })} · {formatSize(snapshot.sizeBytes)}
                </span>
              </div>
              <Button variant="link" size="sm" isDisabled={isBusy} onPress={() => handleRestore(snapshot)}>
                {t('Restore')}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default BackupsDialog;
