import { hostname } from 'os';
import { backupBeforeDestructiveChange } from '../db';
import { syncStore } from '../db/syncStore';
import { readBackupSettings } from '../backup/settings';
import { SyncCoordinator } from './coordinator';
import { SyncEngine } from './engine';
import { DirectorySyncFolder } from './folder';
import { engineSettings, readSyncSettings, updateSyncSettings } from './settings';

// The real sync of this app: the engine over the backup folder, and the coordinator that runs it. Made on first use,
// so that importing this module (the API router does) starts nothing.

/** What this computer is called to the other devices. */
export function computerName(): string {
  return hostname().split('.')[0] || 'Desktop';
}

let instance: SyncCoordinator | undefined;

export function getSyncCoordinator(): SyncCoordinator {
  instance ??= new SyncCoordinator({
    engine: new SyncEngine({
      // The folder the backups already go to: one place to set up, and it is already one a cloud client keeps in step.
      folder: async () => {
        const [sync, backup] = await Promise.all([readSyncSettings(), readBackupSettings()]);
        return sync.enabled && backup.folder !== null ? new DirectorySyncFolder(backup.folder) : null;
      },
      store: syncStore,
      settings: engineSettings,
      safetyCopy: () => backupBeforeDestructiveChange('before-sync-replace'),
      now: () => new Date(),
      deviceName: computerName(),
    }),
    settings: { read: readSyncSettings, update: updateSyncSettings },
    folderPath: async () => (await readBackupSettings()).folder,
  });
  return instance;
}
