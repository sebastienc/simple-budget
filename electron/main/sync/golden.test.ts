import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeSyncFile } from './file.ts';
import { merge, nextStamp } from './merge.ts';
import { planSync } from './plan.ts';
import type { DeviceState, MergedState, ReadResult, RemoteFile, SkipReason, SyncHeader, SyncRow, Tombstone } from './model.ts';

// The contract with the mobile app: three hand-written golden files that both apps must pass (test/golden/sync, copied
// from the mobile repo by scripts/sync-golden-from-mobile.sh). Never edit them here; see the SOURCE file beside them.

const load = (name: string) => JSON.parse(readFileSync(new URL(`../../../test/golden/sync/${name}`, import.meta.url), 'utf8'));

interface GoldenState {
  device: string;
  rows: SyncRow[];
  tombstones: Tombstone[];
}

const toState = (s: GoldenState): DeviceState => ({ deviceId: s.device, rows: s.rows, tombstones: s.tombstones });

/** A deterministic shuffle, so a failure can be repeated. */
function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let state = seed;
  for (let i = out.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

describe('sync-merge.json', () => {
  const golden = load('sync-merge.json');

  it('carries the format version this test reads', () => {
    expect(golden.formatVersion).toBe(1);
    expect(golden.tables).toEqual(['accounts', 'recurring_items', 'balance_checkpoints']);
  });

  for (const c of golden.mergeCases as { name: string; states: GoldenState[]; expected: MergedState }[]) {
    it(`${c.name}, whatever order the devices are given in`, () => {
      const states = c.states.map(toState);
      expect(merge(states)).toEqual(c.expected);
      expect(merge([...states].reverse())).toEqual(c.expected);
      for (let seed = 1; seed <= 5; seed++) expect(merge(shuffled(states, seed))).toEqual(c.expected);
    });
  }

  for (const c of golden.nextStampCases as { name: string; now: string; newestSeen: string | null; expected: string }[]) {
    it(`next stamp: ${c.name}`, () => {
      expect(nextStamp(c.now, c.newestSeen)).toBe(c.expected);
    });
  }
});

describe('sync-plan.json', () => {
  const golden = load('sync-plan.json');
  type GoldenRemote = { device: string; skipped?: SkipReason; name?: string; writtenAt?: string; state?: { rows: SyncRow[]; tombstones: Tombstone[] } };

  const remote = (r: GoldenRemote): RemoteFile => {
    if (r.skipped !== undefined) return { deviceId: r.device, result: { kind: 'skipped', reason: r.skipped, detail: 'golden' } };
    const header: SyncHeader = { deviceId: r.device, deviceName: r.name!, writtenAt: r.writtenAt!, schema: 1 };
    return { deviceId: r.device, result: { kind: 'read', file: { header, rows: r.state!.rows, tombstones: r.state!.tombstones } } };
  };

  /** The plan in the golden file's own words. */
  const describePlan = (plan: ReturnType<typeof planSync>) => ({
    merge: plan.merge.map((s) => s.deviceId),
    statuses: plan.statuses.map((s) => {
      switch (s.kind) {
        case 'merged':
          return { device: s.deviceId, status: 'merged', name: s.deviceName, writtenAt: s.writtenAt };
        case 'waiting':
          return { device: s.deviceId, status: 'waiting', name: s.deviceName, writtenAt: s.writtenAt };
        case 'skipped':
          return { device: s.deviceId, status: 'skipped', reason: s.reason };
        case 'offer':
          return {
            device: s.deviceId,
            status: 'offer',
            name: s.offer.deviceName,
            writtenAt: s.offer.writtenAt,
            suggested: s.offer.suggested,
            remote: s.offer.remote,
            local: s.offer.local,
          };
      }
    }),
  });

  it('carries the format version this test reads', () => {
    expect(golden.formatVersion).toBe(1);
  });

  for (const c of golden.cases as { name: string; local: { rows: SyncRow[]; tombstones: Tombstone[] }; decidedLocal: string[]; remotes: GoldenRemote[]; expected: unknown }[]) {
    it(c.name, () => {
      const local: DeviceState = { deviceId: 'local', rows: c.local.rows, tombstones: c.local.tombstones };
      const remotes = c.remotes.map(remote);
      const plan = planSync(local, remotes, new Set(c.decidedLocal));
      expect(describePlan(plan)).toEqual(c.expected);
      // the order the files were found in does not matter
      expect(describePlan(planSync(local, [...remotes].reverse(), new Set(c.decidedLocal)))).toEqual(c.expected);
    });
  }
});

describe('sync-file.json', () => {
  const golden = load('sync-file.json');
  type GoldenCase = { name: string; file: string; fileDeviceId?: string; expected: { read?: { header: SyncHeader; rows: SyncRow[]; tombstones: Tombstone[] }; skipped?: SkipReason } };

  it('carries the format version this test reads', () => {
    expect(golden.formatVersion).toBe(1);
    expect(golden.supportedFormat).toBe(1);
    expect(golden.supportedSchema).toBe(1);
  });

  for (const c of golden.cases as GoldenCase[]) {
    it(c.name, () => {
      const result: ReadResult = decodeSyncFile(new TextEncoder().encode(c.file), golden.now, {
        supportedSchema: golden.supportedSchema,
        fileDeviceId: c.fileDeviceId ?? null,
      });
      if (c.expected.read !== undefined) {
        expect(result.kind === 'skipped' ? `skipped ${result.reason}: ${result.detail}` : 'read').toBe('read');
        if (result.kind === 'read') expect(result.file).toEqual(c.expected.read);
      } else {
        expect(result.kind === 'skipped' ? result.reason : 'read').toBe(c.expected.skipped);
      }
    });
  }
});
