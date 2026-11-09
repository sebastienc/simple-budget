import { afterEach, describe, expect, it } from 'vitest';
import { withTestDb } from '../../../test/dbFixture';
import { T0, account, correction, item, remote, tomb } from '../../../test/syncRows';
import { accountsQueries, recurringItemsQueries } from '../db/queries';
import { setClockForTests } from '../db/stamps';
import { syncStore } from '../db/syncStore';
import { MAX_SYNC_FILE_BYTES, SYNC_SCHEMA, decodeSyncFile, encodeSyncFile, syncFileName } from '../sync/file';
import type { DeviceState, SyncFile } from '../sync/model';
import type { DeviceStatus } from '../sync/plan';
import { SyncEngine } from './engine';
import type { EngineDeps, SyncOutcome } from './engine';
import type { SyncFolder } from './folder';
import { engineSettings, readSyncSettings, syncDeviceId } from './settings';

const NOW = '2026-11-09T12:00:00Z';

/** A folder in memory that can be told to fail, and to wait. */
class MemoryFolder implements SyncFolder {
  files = new Map<string, Uint8Array>();
  failList: Error | null = null;
  failRead: ((name: string) => Error | null) | null = null;
  failWrite: Error | null = null;
  gate: Promise<void> | null = null;
  listCalls = 0;
  writes: string[] = [];

  async list() {
    this.listCalls++;
    if (this.failList) throw this.failList;
    if (this.gate) await this.gate;
    return [...this.files.keys()];
  }
  async read(name: string, limit: number) {
    const error = this.failRead?.(name);
    if (error) throw error;
    const bytes = this.files.get(name);
    return bytes === undefined ? null : bytes.slice(0, limit);
  }
  async write(name: string, bytes: Uint8Array) {
    if (this.failWrite) throw this.failWrite;
    this.writes.push(name);
    this.files.set(name, bytes);
  }
}

const header = (deviceId: string, deviceName: string, writtenAt = '2026-11-09T11:00:00Z') => ({ deviceId, deviceName, writtenAt, schema: SYNC_SCHEMA });
const fileOf = (state: DeviceState, deviceName: string, writtenAt?: string): SyncFile => ({ header: header(state.deviceId, deviceName, writtenAt), rows: state.rows, tombstones: state.tombstones });
/** What another device would have written into the folder. */
const put = (folder: MemoryFolder, state: DeviceState, deviceName = 'Phone', writtenAt?: string) =>
  folder.files.set(syncFileName(state.deviceId), encodeSyncFile(fileOf(state, deviceName, writtenAt)));
const decodeOwn = async (folder: MemoryFolder) => {
  const result = decodeSyncFile(folder.files.get(syncFileName(await syncDeviceId()))!, NOW);
  if (result.kind !== 'read') throw new Error(`own file skipped: ${result.reason}`);
  return result.file;
};

let copies = 0;
function engineFor(folder: MemoryFolder | null, extra: Partial<EngineDeps> = {}): SyncEngine {
  return new SyncEngine({
    folder: async () => folder,
    store: syncStore,
    settings: engineSettings,
    safetyCopy: async () => {
      copies++;
    },
    now: () => new Date(NOW),
    deviceName: 'Desktop',
    ...extra,
  });
}

const done = (outcome: SyncOutcome) => {
  if (outcome.kind !== 'done') throw new Error(`expected done, got ${outcome.kind}`);
  return outcome.report;
};
const status = (devices: DeviceStatus[], id: string) => devices.find((d) => d.deviceId === id);
const names = async () => (await accountsQueries.list()).map((a) => a.name);

afterEach(() => {
  setClockForTests(null);
  copies = 0;
});

describe('SyncEngine.sync', () => {
  it('does nothing when there is no folder', async () => {
    await withTestDb(async () => {
      expect(await engineFor(null).sync()).toEqual({ kind: 'not-set-up' });
      expect((await readSyncSettings()).lastRead).toBeNull();
    });
  });

  it("writes this device's file the first time, even when there is nothing to say, and leaves it alone after", async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      const engine = engineFor(folder);

      const first = done(await engine.sync());
      expect(first.published).toEqual({ kind: 'wrote', at: NOW });
      expect(first.devices).toEqual([]);
      const own = await decodeOwn(folder);
      expect(own.header).toEqual(header(await syncDeviceId(), 'Desktop', NOW));
      expect(own.rows).toEqual([]);

      const second = done(await engine.sync());
      expect(second.published).toEqual({ kind: 'unchanged' });
      expect(folder.writes).toHaveLength(1);
    });
  });

  it('publishes what this computer holds, and what changed since', async () => {
    await withTestDb(async () => {
      setClockForTests(() => new Date(NOW));
      const folder = new MemoryFolder();
      const engine = engineFor(folder);
      const chequing = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      done(await engine.sync());
      expect((await decodeOwn(folder)).rows.map((r) => r.uuid)).toEqual([chequing.uuid]);

      const rent = await recurringItemsQueries.create({ accountId: chequing.id, name: 'Rent', amountCents: -1, frequency: 'monthly', interval: 1, startDate: '2026-11-01' });
      expect(done(await engine.sync()).published.kind).toBe('wrote');
      expect((await decodeOwn(folder)).rows.map((r) => r.uuid)).toEqual([chequing.uuid, rent.uuid]);
    });
  });

  it("merges another device's file in, and publishes the result", async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      put(folder, remote('phone', [account('a1', T0, 'From phone'), item('i1', 'a1')]), 'Pixel 10');

      const report = done(await engineFor(folder).sync());

      expect(await names()).toEqual(['From phone']);
      expect(report.changes).toMatchObject({ added: 2, updated: 0, removed: 0 });
      expect(status(report.devices, 'phone')).toEqual({ kind: 'merged', deviceId: 'phone', deviceName: 'Pixel 10', writtenAt: '2026-11-09T11:00:00Z' });
      expect((await decodeOwn(folder)).rows.map((r) => r.uuid)).toEqual(['a1', 'i1']);
    });
  });

  it('brings in later changes from a device it already shares history with, and deletions', async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      const engine = engineFor(folder);
      put(folder, remote('phone', [account('a1'), item('i1', 'a1'), item('i2', 'a1')]));
      done(await engine.sync());

      put(folder, remote('phone', [account('a1', '2026-11-05T10:00:00Z', 'Renamed'), item('i2', 'a1')], [tomb('recurring_items', 'i1', '2026-11-05T10:00:00Z')]));
      const report = done(await engine.sync());

      expect(await names()).toEqual(['Renamed']);
      expect(report.changes).toMatchObject({ updated: 1, removed: 1, tombstones: 1 });
      expect((await decodeOwn(folder)).tombstones.map((t) => t.uuid)).toEqual(['i1']);
    });
  });

  it('does not take its own file, files of other apps, or half-written names for another device', async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      const engine = engineFor(folder);
      done(await engine.sync());
      folder.files.set('simple-budget-host-2026-11-01T10-00-00.db', new Uint8Array([1]));
      folder.files.set('notes.txt', new Uint8Array([1]));
      folder.files.set('.simple-budget-sync-x.json.abc.tmp', new Uint8Array([1]));
      folder.files.set('simple-budget-sync-.json', new Uint8Array([1]));

      expect(done(await engine.sync()).devices).toEqual([]);
    });
  });

  it('reports a file it cannot read, carries on with the others, and still publishes', async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      folder.files.set(syncFileName('broken'), new TextEncoder().encode('{"half'));
      put(folder, remote('good', [account('a1')]));

      const report = done(await engineFor(folder).sync());

      expect(status(report.devices, 'broken')).toMatchObject({ kind: 'skipped', reason: 'UNREADABLE' });
      expect(status(report.devices, 'good')?.kind).toBe('merged');
      expect(await names()).toEqual(['Chequing']);
      expect(report.published.kind).toBe('wrote');
    });
  });

  it('skips a file whose name and content disagree, and one from a newer app', async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      folder.files.set(syncFileName('liar'), encodeSyncFile(fileOf(remote('someone-else', [account('a1')]), 'X')));
      folder.files.set(syncFileName('newer'), encodeSyncFile({ ...fileOf(remote('newer', []), 'Y'), header: { ...header('newer', 'Y'), schema: SYNC_SCHEMA + 1 } }));

      const report = done(await engineFor(folder).sync());

      expect(status(report.devices, 'liar')).toMatchObject({ kind: 'skipped', reason: 'INVALID' });
      expect(status(report.devices, 'newer')).toMatchObject({ kind: 'skipped', reason: 'NEWER_SCHEMA' });
      expect(await names()).toEqual([]);
    });
  });

  it('skips a file that is too large, reading no more than it needs to know that', async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      folder.files.set(syncFileName('huge'), new Uint8Array(MAX_SYNC_FILE_BYTES + 5));
      const report = done(await engineFor(folder).sync());
      expect(status(report.devices, 'huge')).toMatchObject({ kind: 'skipped', reason: 'TOO_LARGE' });
    });
  });

  it('skips a file it cannot read from the folder, and goes on', async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      put(folder, remote('locked', [account('a1')]));
      put(folder, remote('open', [account('a2', T0, 'Open')]));
      folder.failRead = (name) => (name === syncFileName('locked') ? new Error('EACCES') : null);

      const report = done(await engineFor(folder).sync());

      expect(status(report.devices, 'locked')).toMatchObject({ kind: 'skipped', reason: 'UNREADABLE' });
      expect(await names()).toEqual(['Open']);
    });
  });

  it('says the folder is unreachable, and changes nothing, when it cannot be listed', async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      folder.failList = new Error('ENOENT');
      await accountsQueries.create({ name: 'Mine', currency: 'CAD' });

      const outcome = await engineFor(folder).sync();

      expect(outcome.kind).toBe('folder-unreachable');
      expect(folder.writes).toEqual([]);
      expect(await names()).toEqual(['Mine']);
      expect((await readSyncSettings()).lastRead).toBeNull();
    });
  });

  it("applies the merge even when this device's own file cannot be written, and tries again next time", async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      put(folder, remote('phone', [account('a1')]));
      const engine = engineFor(folder);
      folder.failWrite = new Error('disk full');

      const report = done(await engine.sync());

      expect(report.published.kind).toBe('failed');
      expect(await names()).toEqual(['Chequing']);
      expect((await readSyncSettings()).lastWrite).toBeNull();
      expect((await readSyncSettings()).lastRead).toBe(NOW);

      folder.failWrite = null;
      expect(done(await engine.sync()).published.kind).toBe('wrote');
      expect((await readSyncSettings()).lastWrite).toBe(NOW);
    });
  });

  it('reports a database that refuses the merge, writes nothing to the folder, and records nothing', async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      put(folder, remote('phone', [account('a1')]));
      const engine = engineFor(folder, {
        store: {
          mergeInto: async () => {
            throw new Error('database is locked');
          },
          replaceWith: syncStore.replaceWith,
        },
      });

      const outcome = await engine.sync();

      expect(outcome.kind).toBe('failed');
      expect(folder.writes).toEqual([]);
      expect((await readSyncSettings()).lastRead).toBeNull();
    });
  });

  it("rewrites its file when its computer's name changes, and not otherwise", async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      done(await engineFor(folder).sync());
      expect(done(await engineFor(folder).sync()).published.kind).toBe('unchanged');
      expect(done(await engineFor(folder, { deviceName: 'New name' }).sync()).published.kind).toBe('wrote');
      expect((await decodeOwn(folder)).header.deviceName).toBe('New name');
    });
  });

  it('runs one sync at a time', async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      let open!: () => void;
      folder.gate = new Promise<void>((resolve) => (open = resolve));
      const engine = engineFor(folder);

      const first = engine.sync();
      const second = engine.sync();
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(folder.listCalls).toBe(1); // the second has not started

      open();
      await Promise.all([first, second]);
      expect(folder.listCalls).toBe(2);
      expect(folder.writes).toHaveLength(1);
    });
  });

  it('settles: a row dropped as an orphan brings an old tombstone back once, then nothing changes', async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      const engine = engineFor(folder);
      // local: account a2 with item i3 edited at 13:00. The phone says i3 was deleted at 12:00 and a2 at 15:00.
      await syncStore.replaceWith(remote('seed', [account('a2', '2026-11-01T11:00:00Z'), item('i3', 'a2', '2026-11-01T13:00:00Z')]));
      put(folder, remote('phone', [account('a1')], [tomb('recurring_items', 'i3', '2026-11-01T12:00:00Z'), tomb('accounts', 'a2', '2026-11-01T15:00:00Z')]));

      const first = done(await engine.sync());
      const second = done(await engine.sync());
      const third = done(await engine.sync());

      expect(first.changes.removed).toBe(2);
      expect(second.changes).toEqual({ added: 0, updated: 0, removed: 0, tombstones: 1 });
      expect(second.published.kind).toBe('wrote'); // only a tombstone changed, and the file must follow
      expect(third.changes).toEqual({ added: 0, updated: 0, removed: 0, tombstones: 0 });
      expect(third.published).toEqual({ kind: 'unchanged' });
    });
  });
});

describe('SyncEngine, a first link', () => {
  const setUpOffer = async (folder: MemoryFolder) => {
    setClockForTests(() => new Date('2026-11-01T00:00:00Z')); // this computer's data is older than the phone's
    await accountsQueries.create({ name: 'Mine', currency: 'CAD' });
    put(folder, remote('phone', [account('p1', '2026-11-05T10:00:00Z', 'Theirs'), item('p2', 'p1')]), 'Pixel 10', '2026-11-09T11:30:00Z');
    const report = done(await engineFor(folder).sync());
    const offered = status(report.devices, 'phone');
    if (offered?.kind !== 'offer') throw new Error(`expected an offer, got ${offered?.kind}`);
    return offered.offer;
  };

  it('is offered, not merged, while this computer still publishes its own', async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      const offer = await setUpOffer(folder);

      expect(offer).toMatchObject({ deviceId: 'phone', deviceName: 'Pixel 10', suggested: 'REMOTE' });
      expect(offer.remote).toMatchObject({ accounts: 1, items: 1 });
      expect(offer.local).toMatchObject({ accounts: 1, items: 0 });
      expect(await names()).toEqual(['Mine']);
      expect((await decodeOwn(folder)).rows).toHaveLength(1);
    });
  });

  it("keeps this computer's data when the person says so, and leaves the other device waiting", async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      const offer = await setUpOffer(folder);
      const engine = engineFor(folder);

      const report = done(await engine.resolveFirstLink(offer, 'LOCAL'));

      expect(status(report.devices, 'phone')?.kind).toBe('waiting');
      expect(await names()).toEqual(['Mine']);
      expect(copies).toBe(0);
      // and it stays decided on the next sync
      expect(status(done(await engine.sync()).devices, 'phone')?.kind).toBe('waiting');
      expect((await readSyncSettings()).keptAgainst).toEqual(['phone']);
    });
  });

  it("takes the other device's data when the person says so, after a safety copy, then merges as usual", async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      const offer = await setUpOffer(folder);

      const report = done(await engineFor(folder).resolveFirstLink(offer, 'REMOTE'));

      expect(copies).toBe(1);
      expect(await names()).toEqual(['Theirs']);
      expect(status(report.devices, 'phone')?.kind).toBe('merged');
      expect((await decodeOwn(folder)).rows.map((r) => r.uuid)).toEqual(['p1', 'p2']);
      expect((await readSyncSettings()).keptAgainst).toEqual([]);
    });
  });

  it("forgets an earlier decision to keep this computer's data when the other device is taken after all", async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      const offer = await setUpOffer(folder);
      const engine = engineFor(folder);
      await engine.resolveFirstLink(offer, 'LOCAL');

      await engine.resolveFirstLink(offer, 'REMOTE');

      expect(await names()).toEqual(['Theirs']);
      expect((await readSyncSettings()).keptAgainst).toEqual([]);
    });
  });

  it('replaces nothing if the other device wrote again since the person looked', async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      const offer = await setUpOffer(folder);
      put(folder, remote('phone', [account('p1', '2026-11-06T10:00:00Z', 'Changed')]), 'Pixel 10', '2026-11-09T11:45:00Z');

      expect(await engineFor(folder).resolveFirstLink(offer, 'REMOTE')).toEqual({ kind: 'offer-expired' });
      expect(await names()).toEqual(['Mine']);
      expect(copies).toBe(0);
    });
  });

  it("replaces nothing if the other device's file is gone or damaged", async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      const offer = await setUpOffer(folder);
      folder.files.delete(syncFileName('phone'));
      expect(await engineFor(folder).resolveFirstLink(offer, 'REMOTE')).toEqual({ kind: 'offer-expired' });
      folder.files.set(syncFileName('phone'), new TextEncoder().encode('garbage'));
      expect(await engineFor(folder).resolveFirstLink(offer, 'REMOTE')).toEqual({ kind: 'offer-expired' });
      expect(await names()).toEqual(['Mine']);
    });
  });

  it('replaces nothing if the safety copy cannot be made', async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      const offer = await setUpOffer(folder);
      const engine = engineFor(folder, {
        safetyCopy: async () => {
          throw new Error('disk full');
        },
      });

      expect((await engine.resolveFirstLink(offer, 'REMOTE')).kind).toBe('failed');
      expect(await names()).toEqual(['Mine']);
    });
  });

  it('says the folder is unreachable if it cannot be read, and replaces nothing', async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      const offer = await setUpOffer(folder);
      folder.failRead = () => new Error('offline');

      expect((await engineFor(folder).resolveFirstLink(offer, 'REMOTE')).kind).toBe('folder-unreachable');
      expect(await names()).toEqual(['Mine']);
    });
  });

  it('does nothing without a folder', async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      const offer = await setUpOffer(folder);
      expect(await engineFor(null).resolveFirstLink(offer, 'REMOTE')).toEqual({ kind: 'not-set-up' });
      expect(await names()).toEqual(['Mine']);
    });
  });

  it("settles a correction too: both sides' corrections for one day end as one", async () => {
    await withTestDb(async () => {
      const folder = new MemoryFolder();
      put(folder, remote('phone', [account('a1'), correction('c-phone', 'a1', '2026-11-04', '2026-11-03T10:00:00Z', 200)]));
      await syncStore.replaceWith(remote('seed', [account('a1'), correction('c-desk', 'a1', '2026-11-04', '2026-11-02T10:00:00Z', 100)]));

      done(await engineFor(folder).sync());

      const own = await decodeOwn(folder);
      expect(own.rows.filter((r) => r.table === 'balance_checkpoints').map((r) => r.uuid)).toEqual(['c-phone']);
      expect(own.tombstones.map((t) => t.uuid)).toEqual(['c-desk']);
    });
  });
});
