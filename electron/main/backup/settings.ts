import { dirname, join } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dbPath } from '../db';

export interface BackupSettings {
  /** Absolute path to a folder a cloud client syncs, or `null` when off. */
  folder: string | null;
  /** How many snapshots to keep per machine. */
  keep: number;
}

export const DEFAULT_SETTINGS: BackupSettings = { folder: null, keep: 10 };

const MAX_KEEP = 200;

/**
 * Beside the database rather than inside it.
 *
 * Which folder to back up into describes *this machine*, not this budget: a
 * snapshot restored onto a second computer would otherwise arrive pointing at
 * the first computer's folder, which may not exist there. Keeping it next to
 * the database file also means `SIMPLE_BUDGET_DB` isolates it, so a demo run
 * can't rewrite the real settings or drop demo snapshots into a real Drive.
 */
function settingsPath(): string {
  return join(dirname(dbPath()), 'backup-settings.json');
}

export function coerce(raw: unknown): BackupSettings {
  if (typeof raw !== 'object' || raw === null) {
    return DEFAULT_SETTINGS;
  }
  const { folder, keep } = raw as Partial<BackupSettings>;
  return {
    folder: typeof folder === 'string' && folder.trim() ? folder : null,
    keep: typeof keep === 'number' && Number.isFinite(keep) ? Math.min(Math.max(Math.floor(keep), 1), MAX_KEEP) : DEFAULT_SETTINGS.keep,
  };
}

export async function readBackupSettings(): Promise<BackupSettings> {
  try {
    return coerce(JSON.parse(await readFile(settingsPath(), 'utf8')));
  } catch {
    // Missing on first run, and unreadable or corrupt is not worth failing
    // over — backups being off is a safe state to fall back to.
    return DEFAULT_SETTINGS;
  }
}

export async function writeBackupSettings(settings: BackupSettings): Promise<BackupSettings> {
  const coerced = coerce(settings);
  const path = settingsPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(coerced, null, 2)}\n`, 'utf8');
  return coerced;
}
