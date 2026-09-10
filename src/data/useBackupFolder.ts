import { useCallback, useEffect, useState } from 'react';

export interface DetectedFolder {
  path: string;
  label: string;
  provider: 'google-drive' | 'dropbox' | 'icloud' | 'onedrive' | 'insync';
}

export interface Snapshot {
  name: string;
  path: string;
  host: string;
  /** ISO 8601, UTC. */
  takenAt: string;
  sizeBytes: number;
  isThisMachine: boolean;
}

export interface BackupFolder {
  folder: string | null;
  keep: number;
  /** False when the configured folder has since gone away. */
  folderAvailable: boolean;
  detected: DetectedFolder[];
  snapshots: Snapshot[];
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  /** The folder was accepted but the first snapshot into it failed. */
  snapshotFailed?: boolean;
}

export interface RestoreResult {
  ok: boolean;
  error?: string;
  /** Where the database being replaced was saved first. */
  backupPath?: string;
}

const EMPTY: BackupFolder = { folder: null, keep: 10, folderAvailable: true, detected: [], snapshots: [] };

export function useBackupFolder(enabled: boolean) {
  const [data, setData] = useState<BackupFolder>(EMPTY);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/backup/folder');
      setData(response.ok ? await response.json() : EMPTY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Detection walks the filesystem, so it waits until the panel is actually
  // open rather than running on every app start.
  useEffect(() => {
    if (enabled) {
      refresh();
    }
  }, [enabled, refresh]);

  const save = useCallback(async (folder: string | null, keep: number): Promise<SaveResult> => {
    const response = await fetch('/api/backup/folder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, keep }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: body.error ?? 'unknown' };
    }
    setData((current) => ({ ...current, ...body, folderAvailable: true }));
    return { ok: true, snapshotFailed: body.snapshotFailed };
  }, []);

  const snapshotNow = useCallback(async (): Promise<boolean> => {
    const response = await fetch('/api/backup/snapshot', { method: 'POST' });
    if (!response.ok) {
      return false;
    }
    const body = await response.json();
    setData((current) => ({ ...current, snapshots: body.snapshots }));
    return true;
  }, []);

  const restore = useCallback(async (name: string): Promise<RestoreResult> => {
    const response = await fetch('/api/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const body = await response.json().catch(() => ({}));
    return response.ok ? { ok: true, backupPath: body.backupPath } : { ok: false, error: body.error ?? 'unknown' };
  }, []);

  return { ...data, isLoading, refresh, save, snapshotNow, restore };
}
