import { describe, expect, it } from 'vitest';
import { hostSlug, parseSnapshotName, parseSnapshots, selectSnapshotsToPrune, snapshotFileName } from './naming';

const AT = (iso: string) => new Date(iso);

describe('snapshotFileName', () => {
  it('names a snapshot after the machine and the moment', () => {
    expect(snapshotFileName('lookout', AT('2026-09-04T21:30:00Z'))).toBe('simple-budget-lookout-2026-09-04T21-30-00.db');
  });

  it('drops the domain and keeps the machine name readable', () => {
    expect(hostSlug('Sebastiens-MacBook-Pro.local')).toBe('Sebastiens-MacBook-Pro');
  });

  it('replaces anything a filename should not carry', () => {
    expect(hostSlug('my machine (work)')).toBe('my-machine-work');
    expect(hostSlug('')).toBe('unknown');
  });

  it('cannot produce a name that escapes the folder', () => {
    for (const hostile of ['../../etc', '/etc/passwd', '..', 'a/b', 'a\\b', '.hidden']) {
      expect(hostSlug(hostile)).toMatch(/^[A-Za-z0-9-]+$/);
    }
  });

  it('sorts chronologically as plain text, which is what retention relies on', () => {
    const names = [snapshotFileName('a', AT('2026-01-02T00:00:00Z')), snapshotFileName('a', AT('2025-12-31T23:59:59Z')), snapshotFileName('a', AT('2026-01-10T00:00:00Z'))];
    expect([...names].sort()).toEqual([names[1], names[0], names[2]]);
  });
});

describe('parseSnapshotName', () => {
  it('recovers the host and the timestamp', () => {
    expect(parseSnapshotName('simple-budget-lookout-2026-09-04T21-30-00.db')).toEqual({
      name: 'simple-budget-lookout-2026-09-04T21-30-00.db',
      host: 'lookout',
      takenAt: '2026-09-04T21:30:00Z',
    });
  });

  it('finds the boundary even though the host contains dashes', () => {
    expect(parseSnapshotName('simple-budget-Sebastiens-MacBook-Pro-2026-09-04T21-30-00.db')?.host).toBe('Sebastiens-MacBook-Pro');
  });

  it('rejects anything this app did not write', () => {
    expect(parseSnapshotName('simple-budget-before-wipe-2026-09-04T21-30-00.db.bak')).toBeNull();
    expect(parseSnapshotName('holiday-photos.db')).toBeNull();
    expect(parseSnapshotName('simple-budget-lookout.db')).toBeNull();
    expect(parseSnapshotName('simple-budget-lookout-2026-13-45T99-99-99.db')).toBeNull();
  });
});

describe('parseSnapshots', () => {
  it('returns newest first and silently drops foreign files', () => {
    const parsed = parseSnapshots(['simple-budget-a-2026-01-01T00-00-00.db', 'notes.txt', 'simple-budget-a-2026-06-01T00-00-00.db']);
    expect(parsed.map((snapshot) => snapshot.takenAt)).toEqual(['2026-06-01T00:00:00Z', '2026-01-01T00:00:00Z']);
  });
});

describe('selectSnapshotsToPrune', () => {
  const forHost = (host: string, days: number[]) => days.map((day) => `simple-budget-${host}-2026-09-${String(day).padStart(2, '0')}T00-00-00.db`);
  // The delete list is a set — nothing downstream depends on its order.
  const pruned = (names: string[], keep: number) => selectSnapshotsToPrune(names, keep).sort();

  it('keeps the newest N and returns the rest', () => {
    const names = forHost('lookout', [1, 2, 3, 4, 5]);
    expect(pruned(names, 2)).toEqual([names[0], names[1], names[2]].sort());
  });

  it('keeps nothing extra when there are fewer than N', () => {
    expect(pruned(forHost('lookout', [1, 2]), 5)).toEqual([]);
  });

  it('counts per machine, so a busy laptop cannot evict the desktop', () => {
    const laptop = forHost('laptop', [1, 2, 3, 4]);
    const desktop = forHost('desktop', [1, 2]);
    const deleted = pruned([...laptop, ...desktop], 2);

    expect(deleted).toEqual([laptop[0], laptop[1]].sort());
    expect(deleted.some((name) => name.includes('desktop'))).toBe(false);
  });

  it('never touches a file it did not write, however full the folder is', () => {
    const names = [...forHost('lookout', [1, 2, 3]), 'simple-budget-before-wipe-2026-09-04T21-30-00.db.bak', 'taxes.db'];
    expect(pruned(names, 1)).toEqual([names[0], names[1]].sort());
  });

  it('always keeps at least one, whatever it is asked for', () => {
    const names = forHost('lookout', [1, 2, 3]);
    expect(pruned(names, 0)).toEqual([names[0], names[1]].sort());
    expect(pruned(names, -5)).toEqual([names[0], names[1]].sort());
  });
});
