import { useCallback, useEffect, useState } from 'react';

// Syncing with the phone and other computers (ADR-0008 and ADR-0009 in simple-budget-mobile). The server does the
// syncing; this only asks how it is going and passes on what the person decides.

export interface SyncStateSummary {
  accounts: number;
  items: number;
  corrections: number;
  /** ISO 8601, UTC; null if that side holds nothing. */
  lastChange: string | null;
}

/** Two devices that hold different budgets and share no history: one must take the other's data. */
export interface FirstLinkOffer {
  deviceId: string;
  deviceName: string;
  writtenAt: string;
  remote: SyncStateSummary;
  local: SyncStateSummary;
  /** The side that changed more recently; this computer on a tie. */
  suggested: 'LOCAL' | 'REMOTE';
}

export type SkipReason = 'UNREADABLE' | 'CHECKSUM' | 'NEWER_FORMAT' | 'NEWER_SCHEMA' | 'TOO_LARGE' | 'INVALID' | 'FUTURE_STAMP';

export type SyncDevice =
  | { kind: 'merged'; deviceId: string; deviceName: string; writtenAt: string }
  | { kind: 'waiting'; deviceId: string; deviceName: string; writtenAt: string }
  | { kind: 'offer'; deviceId: string; offer: FirstLinkOffer }
  | { kind: 'skipped'; deviceId: string; reason: SkipReason };

export type SyncProblem = 'folder-unreachable' | 'failed' | 'publish-failed';

export interface SyncStatus {
  enabled: boolean;
  /** The backup folder sync goes through, or null if none is chosen. */
  folder: string | null;
  running: boolean;
  devices: SyncDevice[];
  problem: SyncProblem | null;
  /** Rows the last sync changed here, or null before the first. */
  changesBroughtIn: number | null;
  /** ISO 8601, UTC. */
  lastRead: string | null;
  lastWrite: string | null;
}

export interface SyncResult {
  ok: boolean;
  error?: string;
}

/** How often to look again while sync is on, so that a sync that ran in the background shows. */
export const SYNC_POLL_MS = 5000;

/** The server's answer, if it is one; anything else (an error body, a different resource) is "not available". */
function coerce(body: unknown): SyncStatus | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const status = body as Partial<SyncStatus>;
  if (typeof status.enabled !== 'boolean' || !Array.isArray(status.devices)) {
    return null;
  }
  return status as SyncStatus;
}

export function useSync(isOpen: boolean, folder: string | null) {
  const [status, setStatus] = useState<SyncStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/sync');
      const next = response.ok ? coerce(await response.json()) : null;
      if (next) {
        setStatus(next);
      }
    } catch {
      // Keep showing what was shown: a failed look is not a change in how sync is going.
    }
  }, []);

  // Only worth asking once there is a folder to sync through.
  useEffect(() => {
    if (isOpen && folder !== null) {
      refresh();
    }
  }, [isOpen, folder, refresh]);

  const enabled = status?.enabled === true;
  useEffect(() => {
    if (!isOpen || !enabled) {
      return;
    }
    const timer = setInterval(refresh, SYNC_POLL_MS);
    return () => clearInterval(timer);
  }, [isOpen, enabled, refresh]);

  const post = useCallback(async (path: string, body?: unknown): Promise<SyncResult> => {
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { ok: false, error: json.error ?? 'unknown' };
      }
      const next = coerce(json);
      if (next) {
        setStatus(next);
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'unknown' };
    }
  }, []);

  return {
    status,
    refresh,
    enable: useCallback(() => post('/api/sync/enable'), [post]),
    disable: useCallback(() => post('/api/sync/disable'), [post]),
    syncNow: useCallback(() => post('/api/sync/now'), [post]),
    resolve: useCallback((offer: FirstLinkOffer, winner: 'LOCAL' | 'REMOTE') => post('/api/sync/resolve', { deviceId: offer.deviceId, writtenAt: offer.writtenAt, winner }), [post]),
  };
}

/** Whether sync is on, for a screen that is not the sync section (a confirmation that should mention it). False if unknown. */
export async function fetchSyncEnabled(): Promise<boolean> {
  try {
    const response = await fetch('/api/sync');
    return response.ok && coerce(await response.json())?.enabled === true;
  } catch {
    return false;
  }
}
