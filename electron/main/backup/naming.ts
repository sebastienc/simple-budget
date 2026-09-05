/**
 * Snapshot file naming and retention, kept free of `fs` and `electron` so the
 * rules can be tested directly.
 *
 * A snapshot is named `simple-budget-<host>-<timestamp>.db`. The host is in
 * there because these files land in a folder two machines may both write to:
 * without it you cannot tell which laptop a snapshot came from, and retention
 * on one machine would quietly delete the other's history.
 */

/** UTC, and `:` swapped for `-`, so the name sorts chronologically as text. */
export function snapshotTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/** Anything a hostname might contain that a filename shouldn't. */
export function hostSlug(hostname: string): string {
  const slug = hostname
    .split('.')[0]
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return slug || 'unknown';
}

export function snapshotFileName(hostname: string, date: Date): string {
  return `simple-budget-${hostSlug(hostname)}-${snapshotTimestamp(date)}.db`;
}

// The host is matched greedily and the timestamp anchored to the end, because a
// hostname contains dashes of its own ("Sebastiens-MacBook-Pro") and splitting
// on them would guess the boundary wrong. The timestamp's shape is rigid, so
// working backwards from it is unambiguous.
const SNAPSHOT_PATTERN = /^simple-budget-(.+)-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.db$/;

export interface ParsedSnapshot {
  name: string;
  host: string;
  /** ISO 8601, UTC. */
  takenAt: string;
}

/** `null` for any name this app didn't write — those are left strictly alone. */
export function parseSnapshotName(name: string): ParsedSnapshot | null {
  const match = SNAPSHOT_PATTERN.exec(name);
  if (!match) {
    return null;
  }
  const [, host, stamp] = match;
  const takenAt = `${stamp.slice(0, 10)}T${stamp.slice(11).replace(/-/g, ':')}Z`;
  if (Number.isNaN(new Date(takenAt).getTime())) {
    return null;
  }
  return { name, host, takenAt };
}

/** Newest first. Names that aren't ours are dropped, not sorted to the end. */
export function parseSnapshots(names: string[]): ParsedSnapshot[] {
  return names
    .map(parseSnapshotName)
    .filter((snapshot): snapshot is ParsedSnapshot => snapshot !== null)
    .sort((a, b) => b.name.localeCompare(a.name));
}

/**
 * Which snapshots retention should delete.
 *
 * Counted per host rather than across the folder: sharing one budget between a
 * laptop and a desktop otherwise means whichever machine runs more often
 * evicts the other one's snapshots, and the machine you actually need to
 * recover has nothing left.
 */
export function selectSnapshotsToPrune(names: string[], keep: number): string[] {
  const limit = Math.max(1, Math.floor(keep));
  const byHost = new Map<string, ParsedSnapshot[]>();

  for (const snapshot of parseSnapshots(names)) {
    const existing = byHost.get(snapshot.host);
    if (existing) {
      existing.push(snapshot);
    } else {
      byHost.set(snapshot.host, [snapshot]);
    }
  }

  return [...byHost.values()].flatMap((snapshots) => snapshots.slice(limit)).map((snapshot) => snapshot.name);
}
