import { mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withTestDb } from '../../../test/dbFixture';
import { T0, account, item, remote } from '../../../test/syncRows';
import { writeBackupSettings } from '../backup/settings';
import { accountsQueries } from '../db/queries';
import { syncStore } from '../db/syncStore';
import { decodeSyncFile, encodeSyncFile, syncFileName } from '../sync/file';
import { computerName, getSyncCoordinator } from './index';
import { readSyncSettings } from './settings';

// The real thing end to end except for the other devices: the coordinator over the backup folder on disk, with the real
// settings files and database. (The other devices are files this test writes.)

let folder: string;

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'simple-budget-drive-'));
});

afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

const syncFiles = async () => (await readdir(folder)).filter((name) => name.startsWith('simple-budget-sync-'));

describe('sync over the backup folder', () => {
  it('will not turn on until a backup folder is chosen', async () => {
    await withTestDb(async () => {
      const coordinator = getSyncCoordinator();
      expect(await coordinator.turnOn()).toBe('no-folder');
      expect((await coordinator.status()).enabled).toBe(false);
      expect(await syncFiles()).toEqual([]);
    });
  });

  it("writes this computer's file into the folder when turned on, beside the snapshots, without touching them", async () => {
    await withTestDb(async () => {
      await writeBackupSettings({ folder, keep: 10 });
      await writeFile(join(folder, 'simple-budget-host-2026-11-01T10-00-00.db'), 'a snapshot');
      await writeFile(join(folder, 'holiday-photos.zip'), 'photos');
      const created = await accountsQueries.create({ name: 'Chequing', currency: 'CAD' });
      const coordinator = getSyncCoordinator();

      expect(await coordinator.turnOn()).toBe('on');

      const { deviceId } = await readSyncSettings();
      expect(await syncFiles()).toEqual([syncFileName(deviceId as string)]);
      const written = decodeSyncFile(await readFile(join(folder, syncFileName(deviceId as string))), '2099-01-01T00:00:00Z');
      expect(written.kind === 'read' ? written.file.rows.map((r) => r.uuid) : written).toEqual([created.uuid]);
      expect(written.kind === 'read' ? written.file.header.deviceName : '').toBe(computerName());
      expect(await readFile(join(folder, 'simple-budget-host-2026-11-01T10-00-00.db'), 'utf8')).toBe('a snapshot');
      expect(await readFile(join(folder, 'holiday-photos.zip'), 'utf8')).toBe('photos');
      expect((await readdir(folder)).sort()).toEqual(['holiday-photos.zip', 'simple-budget-host-2026-11-01T10-00-00.db', syncFileName(deviceId as string)].sort());
      expect(await coordinator.status()).toMatchObject({ enabled: true, folder, problem: null, running: false });
    });
  });

  it('brings in what another device wrote into the folder', async () => {
    await withTestDb(async () => {
      await writeBackupSettings({ folder, keep: 10 });
      const phone = remote('phone', [account('a1', T0, 'From the phone'), item('i1', 'a1')]);
      await writeFile(
        join(folder, syncFileName('phone')),
        encodeSyncFile({ header: { deviceId: 'phone', deviceName: 'Pixel 10', writtenAt: '2026-11-09T11:00:00Z', schema: 1 }, rows: phone.rows, tombstones: phone.tombstones }),
      );
      const coordinator = getSyncCoordinator();

      await coordinator.turnOn();

      expect((await accountsQueries.list()).map((a) => a.name)).toEqual(['From the phone']);
      const status = await coordinator.status();
      expect(status.devices).toMatchObject([{ kind: 'merged', deviceId: 'phone', deviceName: 'Pixel 10' }]);
      expect(status.changesBroughtIn).toBe(2);
      expect(status.lastRead).not.toBeNull();
      expect(status.lastWrite).not.toBeNull();
    });
  });

  it('shows the folder as unreachable when it has gone, and changes nothing', async () => {
    await withTestDb(async () => {
      await writeBackupSettings({ folder, keep: 10 });
      await accountsQueries.create({ name: 'Mine', currency: 'CAD' });
      const coordinator = getSyncCoordinator();
      await coordinator.turnOn();
      await rm(folder, { recursive: true, force: true });

      await coordinator.syncNow();

      expect((await coordinator.status()).problem).toBe('folder-unreachable');
      expect((await accountsQueries.list()).map((a) => a.name)).toEqual(['Mine']);
    });
  });

  it('leaves the folder alone when turned off, and does not sync into it any more', async () => {
    await withTestDb(async () => {
      await writeBackupSettings({ folder, keep: 10 });
      const coordinator = getSyncCoordinator();
      await coordinator.turnOn();
      const before = await readFile(join(folder, (await syncFiles())[0]));

      await coordinator.turnOff();
      await accountsQueries.create({ name: 'Later', currency: 'CAD' });
      await coordinator.syncNow();

      expect(await readFile(join(folder, (await syncFiles())[0]))).toEqual(before);
      expect(await coordinator.status()).toMatchObject({ enabled: false, devices: [] });
    });
  });

  it('keeps the same device id from one start to the next, and keeps it out of the database', async () => {
    await withTestDb(async () => {
      await writeBackupSettings({ folder, keep: 10 });
      await getSyncCoordinator().turnOn();
      const first = (await readSyncSettings()).deviceId;
      await getSyncCoordinator().syncNow();
      expect((await readSyncSettings()).deviceId).toBe(first);
      // it is in a settings file beside the database, so a snapshot of the database cannot carry it to another computer
      expect(JSON.stringify(await syncStore.localState('x'))).not.toContain(first as string);
    });
  });
});
