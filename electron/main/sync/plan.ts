import { compareStamps } from './stamp.ts';
import type { DeviceState, RemoteFile, SkipReason, SyncTable } from './model.ts';

// Which of the other devices' files to merge, which to ask about, and which to leave (ADR-0008 "first link",
// ADR-0009 "Joining" in the mobile repo). Pure: the files have already been read and decoded. A port of the mobile
// app's `domain/sync/SyncPlan.kt`; both pass test/golden/sync/sync-plan.json.

/** Which side of a first link keeps its data. */
export type Winner = 'LOCAL' | 'REMOTE';

/** What one side of a first link holds, so the person can choose with the facts in front of them. */
export interface StateSummary {
  accounts: number;
  items: number;
  corrections: number;
  /** The newest `updatedAt` or `deletedAt` on that side, or null if it holds nothing. */
  lastChange: string | null;
}

/** Two devices that hold different budgets and share no history: one must replace the other. */
export interface FirstLinkOffer {
  deviceId: string;
  deviceName: string;
  writtenAt: string;
  remote: StateSummary;
  local: StateSummary;
  /** The side that changed more recently; the local side on a tie, so nothing is replaced by accident. */
  suggested: Winner;
}

/** What was found for one other device. */
export type DeviceStatus =
  /** Merged in. */
  | { kind: 'merged'; deviceId: string; deviceName: string; writtenAt: string }
  /** Holds a different budget: waiting for the person to choose which side wins. */
  | { kind: 'offer'; deviceId: string; offer: FirstLinkOffer }
  /** The person chose to keep this device's data; the other has yet to take it, and is left alone until then. */
  | { kind: 'waiting'; deviceId: string; deviceName: string; writtenAt: string }
  /** Not merged this time; the next sync tries again. */
  | { kind: 'skipped'; deviceId: string; reason: SkipReason; detail: string };

/** `merge` is what to merge with the local state; `statuses` has one entry per other device, by device id. */
export interface SyncPlan {
  merge: DeviceState[];
  statuses: DeviceStatus[];
}

const identities = (state: DeviceState): Set<string> => {
  const key = (table: SyncTable, uuid: string) => `${table}|${uuid}`;
  return new Set([...state.rows.map((row) => key(row.table, row.uuid)), ...state.tombstones.map((tombstone) => key(tombstone.table, tombstone.uuid))]);
};

/** Counts and the newest change of a state, as shown when two devices meet for the first time. */
export function summarise(state: DeviceState): StateSummary {
  let lastChange: string | null = null;
  for (const stamp of [...state.rows.map((row) => row.updatedAt), ...state.tombstones.map((tombstone) => tombstone.deletedAt)]) {
    if (lastChange === null || compareStamps(stamp, lastChange) > 0) lastChange = stamp;
  }
  return {
    accounts: state.rows.filter((row) => row.table === 'accounts').length,
    items: state.rows.filter((row) => row.table === 'recurring_items').length,
    corrections: state.rows.filter((row) => row.table === 'balance_checkpoints').length,
    lastChange,
  };
}

/**
 * Sorts the other devices' files into those to merge, those that need a decision, and those to leave.
 *
 * A file that was read is merged when the local device holds no rows (nothing to lose), when the file holds nothing,
 * or when the two share history: some uuid, live or deleted, appears on both sides. Otherwise the two hold different
 * budgets that have never met, and it is a first link: unless the person already chose `decidedLocal` for that device
 * (keep the local data), it is offered to them, and either way it is not merged.
 */
export function planSync(local: DeviceState, remotes: RemoteFile[], decidedLocal: ReadonlySet<string> = new Set()): SyncPlan {
  const mine = identities(local);
  const merge: DeviceState[] = [];
  const statuses: DeviceStatus[] = [];
  const sorted = [...remotes].sort((a, b) => (a.deviceId < b.deviceId ? -1 : a.deviceId > b.deviceId ? 1 : 0));
  for (const remote of sorted) {
    const { result } = remote;
    if (result.kind === 'skipped') {
      statuses.push({ kind: 'skipped', deviceId: remote.deviceId, reason: result.reason, detail: result.detail });
      continue;
    }
    const { file } = result;
    const { header } = file;
    const state: DeviceState = { deviceId: header.deviceId, rows: file.rows, tombstones: file.tombstones };
    const theirs = identities(state);
    const isFirstLink = local.rows.length > 0 && theirs.size > 0 && ![...mine].some((id) => theirs.has(id));
    if (!isFirstLink) {
      merge.push(state);
      statuses.push({ kind: 'merged', deviceId: remote.deviceId, deviceName: header.deviceName, writtenAt: header.writtenAt });
    } else if (decidedLocal.has(remote.deviceId)) {
      statuses.push({ kind: 'waiting', deviceId: remote.deviceId, deviceName: header.deviceName, writtenAt: header.writtenAt });
    } else {
      const here = summarise(local);
      const there = summarise(state);
      const newer = there.lastChange !== null && (here.lastChange === null || compareStamps(there.lastChange, here.lastChange) > 0);
      statuses.push({
        kind: 'offer',
        deviceId: remote.deviceId,
        offer: { deviceId: remote.deviceId, deviceName: header.deviceName, writtenAt: header.writtenAt, remote: there, local: here, suggested: newer ? 'REMOTE' : 'LOCAL' },
      });
    }
  }
  return { merge, statuses };
}
