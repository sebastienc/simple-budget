import { describe, expect, it } from 'vitest';
import { merge } from './merge.ts';
import type { DeviceState, MergedState, SyncRow, Tombstone } from './model.ts';
import { addSeconds } from './stamp.ts';

// Properties of the merge that must keep holding (the mobile app's MergeTest checks the same ones): the order of the
// devices never matters, merging again changes nothing, devices that keep merging each other's published states
// converge, and the merged state is consistent. The cases are random but seeded, so a failure repeats.

const BASE = '2026-11-01T00:00:00Z';
const DEVICES = ['A', 'B', 'C'];
const ACCOUNTS = ['a1', 'a2', 'a3'];
const ITEMS: [string, string][] = [
  ['i1', 'a1'],
  ['i2', 'a1'],
  ['i3', 'a2'],
  ['i4', 'a3'],
];
const CORRECTIONS: [string, string, string][] = [
  ['c1', 'a1', '2026-11-01'],
  ['c2', 'a1', '2026-11-01'],
  ['c3', 'a2', '2026-11-01'],
  ['c4', 'a3', '2026-11-02'],
];

function random(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    below: (n: number) => Math.floor(next() * n),
    chance: (percent: number) => next() * 100 < percent,
    shuffled<T>(items: T[]): T[] {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

/** A random world: each device holds some of a small set of rows, each live or deleted. `distinct` gives each device its own stamps, so no ties between devices. */
function world(rng: ReturnType<typeof random>, distinct: boolean): DeviceState[] {
  return DEVICES.map((deviceId, index) => {
    const stamp = () => addSeconds(BASE, rng.below(6) * 3600 + (distinct ? index + 1 : 0));
    const rows: SyncRow[] = [];
    const tombstones: Tombstone[] = [];
    const add = (table: SyncRow['table'], uuid: string, parentUuid: string | null, key: string | null, fields: SyncRow['fields'], skip: number, dead: number) => {
      if (rng.chance(skip)) return;
      if (rng.chance(dead)) tombstones.push({ table, uuid, deletedAt: stamp() });
      else rows.push({ table, uuid, updatedAt: stamp(), parentUuid, key, fields });
    };
    for (const uuid of ACCOUNTS) add('accounts', uuid, null, null, { name: ['x', 'y', 'z'][rng.below(3)] }, 35, 25);
    for (const [uuid, parent] of ITEMS) add('recurring_items', uuid, parent, null, { amountCents: rng.below(6) - 3 }, 40, 25);
    for (const [uuid, parent, day] of CORRECTIONS) add('balance_checkpoints', uuid, parent, day, { balanceCents: rng.below(3) }, 40, 25);
    return { deviceId, rows, tombstones };
  });
}

const asState = (m: MergedState, deviceId: string): DeviceState => ({ deviceId, rows: m.rows, tombstones: m.tombstones });

function forEveryWorld(distinct: boolean, check: (states: DeviceState[], rng: ReturnType<typeof random>) => string | null) {
  const rng = random(20261109);
  for (let round = 0; round < 2000; round++) {
    const states = world(rng, distinct);
    const problem = check(states, rng);
    if (problem !== null) throw new Error(`round ${round}: ${problem}\nstates: ${JSON.stringify(states)}`);
  }
}

describe('merge properties', () => {
  it('the order the devices are given in never matters', () => {
    forEveryWorld(false, (states, rng) => {
      const want = merge(states);
      const got = merge(rng.shuffled(states));
      return JSON.stringify(got) === JSON.stringify(want) ? null : `want ${JSON.stringify(want)} but got ${JSON.stringify(got)}`;
    });
  });

  it('merging again with the merged state changes nothing', () => {
    forEveryWorld(false, (states) => {
      const merged = merge(states);
      const again = merge([...states, asState(merged, '~')]);
      const low = merge([...states, asState(merged, '')]);
      return JSON.stringify(again) === JSON.stringify(merged) && JSON.stringify(low) === JSON.stringify(merged) ? null : 'merging the merged state changed it';
    });
  });

  it("devices that keep merging each other's published states end up holding the same state", () => {
    for (const distinct of [false, true]) {
      forEveryWorld(distinct, (states, rng) => {
        const current = [...states];
        for (let pass = 0; pass < 4; pass++) {
          for (const index of rng.shuffled(current.map((_, i) => i))) current[index] = asState(merge(current), current[index].deviceId);
        }
        const agreed = JSON.stringify({ rows: current[0].rows, tombstones: current[0].tombstones });
        if (current.some((s) => JSON.stringify({ rows: s.rows, tombstones: s.tombstones }) !== agreed)) return 'devices disagree';
        return JSON.stringify(merge(current)) === agreed ? null : 'merging the agreed state changed it';
      });
    }
  });

  it('the merged state is consistent: nothing both live and deleted, no orphan, no duplicate correction, in order', () => {
    forEveryWorld(false, (states) => {
      const merged = merge(states);
      const live = new Set(merged.rows.map((r) => `${r.table}|${r.uuid}`));
      const accounts = new Set(merged.rows.filter((r) => r.table === 'accounts').map((r) => r.uuid));
      const days = merged.rows.filter((r) => r.table === 'balance_checkpoints').map((r) => `${r.parentUuid}|${r.key}`);
      if (merged.tombstones.some((t) => live.has(`${t.table}|${t.uuid}`))) return 'a row is both live and deleted';
      if (merged.rows.some((r) => r.table !== 'accounts' && !accounts.has(r.parentUuid ?? ''))) return 'a child has no account';
      if (days.length !== new Set(days).size) return 'two corrections for one account and day';
      const order = (list: { table: string; uuid: string }[]) => list.map((r) => `${['accounts', 'recurring_items', 'balance_checkpoints'].indexOf(r.table)}|${r.uuid}`);
      const sorted = (list: string[]) => JSON.stringify(list) === JSON.stringify([...list].sort());
      return sorted(order(merged.rows)) && sorted(order(merged.tombstones)) ? null : 'not in order';
    });
  });

  it('a newer version always beats an older one from another device, whichever way round', () => {
    const old: SyncRow = { table: 'accounts', uuid: 'a1', updatedAt: BASE, parentUuid: null, key: null, fields: { name: 'old' } };
    const newer: SyncRow = { ...old, updatedAt: addSeconds(BASE, 1), fields: { name: 'new' } };
    expect(
      merge([
        { deviceId: 'Z', rows: [old], tombstones: [] },
        { deviceId: 'A', rows: [newer], tombstones: [] },
      ]).rows,
    ).toEqual([newer]);
    expect(
      merge([
        { deviceId: 'A', rows: [newer], tombstones: [] },
        { deviceId: 'Z', rows: [old], tombstones: [] },
      ]).rows,
    ).toEqual([newer]);
  });

  it('settles two versions that differ only in content by the content, so the order never matters', () => {
    // can only happen if two states carry the same device id, but the choice must still not depend on the order
    const row = (name: string): SyncRow => ({ table: 'accounts', uuid: 'a1', updatedAt: BASE, parentUuid: null, key: null, fields: { name } });
    const x = { deviceId: 'A', rows: [row('x')], tombstones: [] };
    const y = { deviceId: 'A', rows: [row('y')], tombstones: [] };
    expect(merge([x, y]).rows).toEqual([row('y')]);
    expect(merge([y, x]).rows).toEqual([row('y')]);
  });

  it('compares stamps as instants, not as text', () => {
    const half: SyncRow = { table: 'accounts', uuid: 'a1', updatedAt: '2026-11-01T00:00:00.500Z', parentUuid: null, key: null, fields: { name: 'half' } };
    const whole: SyncRow = { ...half, updatedAt: '2026-11-01T00:00:00Z', fields: { name: 'whole' } };
    // as text "…00Z" sorts after "…00.500Z"; as time the half second is later
    expect(
      merge([
        { deviceId: 'A', rows: [whole], tombstones: [] },
        { deviceId: 'B', rows: [half], tombstones: [] },
      ]).rows,
    ).toEqual([half]);
  });
});
