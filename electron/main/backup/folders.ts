import { homedir } from 'os';
import { join } from 'path';
import { readdir, stat, access } from 'fs/promises';
import { constants } from 'fs';

export interface DetectedFolder {
  path: string;
  /** What to call it in the UI, e.g. "Google Drive (sebastien@example.com)". */
  label: string;
  provider: 'google-drive' | 'dropbox' | 'icloud' | 'onedrive' | 'insync';
}

/**
 * Where macOS mounts cloud drives since Big Sur. Each entry is named after the
 * provider and the signed-in account — `GoogleDrive-someone@example.com` — and
 * Google puts the actual files one level further down, in `My Drive`.
 */
const CLOUD_STORAGE = join(homedir(), 'Library', 'CloudStorage');

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

export async function isWritableDirectory(path: string): Promise<boolean> {
  if (!(await isDirectory(path))) {
    return false;
  }
  try {
    await access(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function describeCloudStorageEntry(entry: string): DetectedFolder | null {
  const [provider, account] = [entry.split('-')[0], entry.slice(entry.indexOf('-') + 1)];
  const named = (label: string) => (account && account !== entry ? `${label} (${account})` : label);

  switch (provider) {
    case 'GoogleDrive':
      // Google's mount point isn't itself writable; the shared and personal
      // roots sit inside it, and only "My Drive" is somewhere to put files.
      return { path: join(CLOUD_STORAGE, entry, 'My Drive'), label: named('Google Drive'), provider: 'google-drive' };
    case 'Dropbox':
      return { path: join(CLOUD_STORAGE, entry), label: named('Dropbox'), provider: 'dropbox' };
    case 'OneDrive':
      return { path: join(CLOUD_STORAGE, entry), label: named('OneDrive'), provider: 'onedrive' };
    case 'iCloudDrive':
      return { path: join(CLOUD_STORAGE, entry), label: 'iCloud Drive', provider: 'icloud' };
    default:
      return null;
  }
}

async function macCandidates(): Promise<DetectedFolder[]> {
  const candidates: DetectedFolder[] = [];

  try {
    for (const entry of await readdir(CLOUD_STORAGE)) {
      const detected = describeCloudStorageEntry(entry);
      if (detected) {
        candidates.push(detected);
      }
    }
  } catch {
    // No CloudStorage directory: nothing is mounted.
  }

  // Pre-Big-Sur Google Drive, and Dropbox's own default, both live in $HOME.
  candidates.push(
    { path: join(homedir(), 'Google Drive'), label: 'Google Drive', provider: 'google-drive' },
    { path: join(homedir(), 'Dropbox'), label: 'Dropbox', provider: 'dropbox' },
    { path: join(homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs'), label: 'iCloud Drive', provider: 'icloud' },
  );

  return candidates;
}

function windowsCandidates(): DetectedFolder[] {
  const candidates: DetectedFolder[] = [];

  // OneDrive sets this itself, pointed at the actual synced folder — more
  // reliable than guessing a name, since a work/school account's folder is
  // named "OneDrive - <Company>", not "OneDrive".
  if (process.env.OneDrive) {
    candidates.push({ path: process.env.OneDrive, label: 'OneDrive', provider: 'onedrive' });
  }

  candidates.push(
    // Only "Mirror files" mode creates this; the "Stream files" default
    // (a virtual G:\ drive) has nothing on disk to detect.
    { path: join(homedir(), 'Google Drive', 'My Drive'), label: 'Google Drive', provider: 'google-drive' },
    { path: join(homedir(), 'Dropbox'), label: 'Dropbox', provider: 'dropbox' },
  );

  return candidates;
}

function linuxCandidates(): DetectedFolder[] {
  return [
    { path: join(homedir(), 'Dropbox'), label: 'Dropbox', provider: 'dropbox' },
    // Insync (the most common unofficial Google Drive/OneDrive client on
    // Linux) is configurable per-account; this only catches its default root.
    { path: join(homedir(), 'Insync'), label: 'Insync', provider: 'insync' },
  ];
}

/**
 * Cloud-sync folders this machine already has, offered as one-click choices.
 *
 * Detection only — the app never writes anywhere it wasn't pointed at. It
 * exists because the app deliberately has no native file dialogs (they don't
 * work in a browser tab), and asking someone to type
 * `~/Library/CloudStorage/GoogleDrive-…/My Drive` from memory is not a
 * reasonable substitute for a folder picker.
 */
export async function detectSyncedFolders(): Promise<DetectedFolder[]> {
  const candidates =
    process.platform === 'darwin' ? await macCandidates() : process.platform === 'win32' ? windowsCandidates() : linuxCandidates();

  const existing = await Promise.all(candidates.map(async (folder) => ((await isWritableDirectory(folder.path)) ? folder : null)));

  const seen = new Set<string>();
  return existing.filter((folder): folder is DetectedFolder => folder !== null).filter((folder) => !seen.has(folder.path) && seen.add(folder.path));
}
