export interface ImportBackupResult {
  ok: boolean;
  error?: string;
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

  return { exportBackup, importBackup };
}
