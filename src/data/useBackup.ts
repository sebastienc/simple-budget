export interface ImportBackupResult {
  ok: boolean;
  error?: string;
}

export interface WipeResult {
  ok: boolean;
  /** Where the app saved a snapshot before deleting anything. */
  backupPath?: string;
}

export function useBackup() {
  const exportBackup = () => {
    window.location.href = '/api/backup/export';
  };

  const importBackup = async (file: File): Promise<ImportBackupResult> => {
    const response = await fetch('/api/backup/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { ok: false, error: body.error ?? 'unknown' };
    }
    return { ok: true };
  };

  const wipeAllData = async (): Promise<WipeResult> => {
    const response = await fetch('/api/wipe', { method: 'POST' });
    if (!response.ok) {
      return { ok: false };
    }
    return response.json();
  };

  return { exportBackup, importBackup, wipeAllData };
}
