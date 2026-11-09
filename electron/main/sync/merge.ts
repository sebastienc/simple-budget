import { compareStamps, laterOf, truncateToSeconds } from './stamp.ts';
import { tableIndex } from './model.ts';
import type { DeviceState, MergedState, SyncRow, SyncTable, Tombstone } from './model.ts';

// The merge of ADR-0008 (mobile repo): every device publishes the state it holds and every device merges what the
// others published. Pure: no database, no files, no clock. The caller turns what it finds into DeviceStates, calls
// merge(), and applies the difference to the database.
//
// This is a port of the mobile app's `domain/sync/Merge.kt` and must behave exactly like it: both pass the same hand
// written golden file (test/golden/sync/sync-merge.json). A row's columns are opaque here; the merge only needs a
// row's identity, its version, the row it hangs off and, for a correction, its natural key.

/**
 * A new write is stamped with the later of the device's clock and the newest stamp it has seen from any device, so a
 * device whose clock runs slow still wins over an older edit made elsewhere. Stamps are whole seconds.
 */
export function nextStamp(now: string, newestSeen: string | null): string {
  return truncateToSeconds(newestSeen === null ? now : laterOf(now, newestSeen));
}

interface Candidate {
  stamp: string;
  holder: string;
  deleted: boolean;
  /** Breaks the last tie, so the choice never depends on the order the states were given in. */
  content: string;
  row?: SyncRow;
  tombstone?: Tombstone;
}

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function liveContent(row: SyncRow): string {
  const fields = Object.keys(row.fields)
    .sort()
    .map((name) => `${name}=${String(row.fields[name])}`)
    .join('|');
  return `${row.parentUuid}|${row.key}|${fields}`;
}

/** The higher stamp wins; at the same stamp a deletion beats a live row, then the higher device id wins. */
function compareCandidates(a: Candidate, b: Candidate): number {
  return compareStamps(a.stamp, b.stamp) || Number(a.deleted) - Number(b.deleted) || compareText(a.holder, b.holder) || compareText(a.content, b.content);
}

const compareByTableThenUuid = (a: { table: SyncTable; uuid: string }, b: { table: SyncTable; uuid: string }) => tableIndex(a.table) - tableIndex(b.table) || compareText(a.uuid, b.uuid);

/**
 * Merges what the devices hold (the local device's own state included) into one state.
 *
 * Per row, by uuid: the version with the highest stamp wins, a deletion counting as a version. Then, from the live
 * rows that remain:
 *
 * - a recurring item or correction whose account did not survive is dropped, even if it was edited more recently than
 *   the account was deleted. Nothing is recorded for it: every device that learns the account is gone drops the same
 *   rows by itself, and a deletion made by a person already wrote its own tombstones;
 * - two corrections for the same account and day cannot both stay: the later one wins (the larger uuid at the same
 *   stamp) and the other is recorded as deleted, at its own stamp, so it cannot come back if the winner is deleted
 *   later. The stamp is the loser's own so that it does not depend on which merge noticed first.
 *
 * The result does not depend on the order of `states`, and merging it again with the states it came from changes
 * nothing. Devices that keep merging each other's published states end up holding the same state.
 */
export function merge(states: DeviceState[]): MergedState {
  const winners = new Map<string, Candidate>();
  const offer = (table: SyncTable, uuid: string, candidate: Candidate) => {
    const id = `${table}|${uuid}`;
    const current = winners.get(id);
    if (current === undefined || compareCandidates(current, candidate) < 0) winners.set(id, candidate);
  };
  for (const state of states) {
    for (const row of state.rows) {
      offer(row.table, row.uuid, { stamp: row.updatedAt, holder: state.deviceId, deleted: false, content: liveContent(row), row });
    }
    for (const tombstone of state.tombstones) {
      offer(tombstone.table, tombstone.uuid, { stamp: tombstone.deletedAt, holder: state.deviceId, deleted: true, content: '', tombstone });
    }
  }

  const tombstones: Tombstone[] = [];
  const live: SyncRow[] = [];
  for (const winner of winners.values()) {
    if (winner.row !== undefined) live.push(winner.row);
    else if (winner.tombstone !== undefined) tombstones.push(winner.tombstone);
  }

  const accounts = live.filter((row) => row.table === 'accounts');
  const accountUuids = new Set(accounts.map((row) => row.uuid));
  const kept = live.filter((row) => row.table !== 'accounts' && row.parentUuid !== null && accountUuids.has(row.parentUuid));

  const corrections = new Map<string, SyncRow[]>();
  for (const row of kept) {
    if (row.table !== 'balance_checkpoints') continue;
    const day = JSON.stringify([row.parentUuid, row.key]);
    corrections.set(day, [...(corrections.get(day) ?? []), row]);
  }
  const losers = new Set<string>();
  for (const group of corrections.values()) {
    if (group.length < 2) continue;
    const winner = group.reduce((best, row) => ((compareStamps(row.updatedAt, best.updatedAt) || compareText(row.uuid, best.uuid)) > 0 ? row : best));
    for (const loser of group) {
      if (loser === winner) continue;
      losers.add(loser.uuid);
      tombstones.push({ table: loser.table, uuid: loser.uuid, deletedAt: loser.updatedAt });
    }
  }

  const rows = [...accounts, ...kept.filter((row) => !(row.table === 'balance_checkpoints' && losers.has(row.uuid)))];
  return { rows: rows.sort(compareByTableThenUuid), tombstones: tombstones.sort(compareByTableThenUuid) };
}
