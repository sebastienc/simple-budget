import { mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SYNC_SETTINGS, coerceSyncSettings, engineSettings, readSyncSettings, syncDeviceId, updateSyncSettings } from './settings';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'simple-budget-sync-settings-'));
  process.env.SIMPLE_BUDGET_DB = join(dir, 'test.db');
});

afterEach(async () => {
  delete process.env.SIMPLE_BUDGET_DB;
  await rm(dir, { recursive: true, force: true });
});

describe('sync settings', () => {
  it('start out off, with no identity', async () => {
    expect(await readSyncSettings()).toEqual(DEFAULT_SYNC_SETTINGS);
  });

  it('live beside the database, not in it', async () => {
    await updateSyncSettings(() => ({ enabled: true }));
    expect(await readdir(dir)).toEqual(['sync-settings.json']);
  });

  it('keep what is written', async () => {
    await updateSyncSettings(() => ({ enabled: true, lastRead: '2026-11-09T12:00:00Z' }));
    expect(await readSyncSettings()).toEqual({ ...DEFAULT_SYNC_SETTINGS, enabled: true, lastRead: '2026-11-09T12:00:00Z' });
  });

  it('fall back to off when the file is corrupt', async () => {
    await writeFile(join(dir, 'sync-settings.json'), '{not json');
    expect(await readSyncSettings()).toEqual(DEFAULT_SYNC_SETTINGS);
  });

  it('do not lose a change when two are made at once', async () => {
    await Promise.all([
      updateSyncSettings(() => ({ enabled: true })),
      engineSettings.keepAgainst('dev-a'),
      engineSettings.keepAgainst('dev-b'),
      engineSettings.recordRead('2026-11-09T12:00:00Z'),
      engineSettings.recordWrite('2026-11-09T12:00:01Z'),
    ]);
    expect(await readSyncSettings()).toEqual({ enabled: true, deviceId: null, keptAgainst: ['dev-a', 'dev-b'], lastRead: '2026-11-09T12:00:00Z', lastWrite: '2026-11-09T12:00:01Z' });
  });

  it('are not left half written: no temporary files remain', async () => {
    await updateSyncSettings(() => ({ enabled: true }));
    await updateSyncSettings(() => ({ enabled: false }));
    expect(await readdir(dir)).toEqual(['sync-settings.json']);
  });

  it('keep going after a change that threw', async () => {
    await expect(
      updateSyncSettings(() => {
        throw new Error('no');
      }),
    ).rejects.toThrow('no');
    await updateSyncSettings(() => ({ enabled: true }));
    expect((await readSyncSettings()).enabled).toBe(true);
  });
});

describe('the device id', () => {
  it('is made the first time and the same afterwards', async () => {
    const first = await syncDeviceId();
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(await syncDeviceId()).toBe(first);
    expect(JSON.parse(await readFile(join(dir, 'sync-settings.json'), 'utf8')).deviceId).toBe(first);
  });

  it('is one id when two first calls race', async () => {
    const ids = await Promise.all([syncDeviceId(), syncDeviceId(), syncDeviceId()]);
    expect(new Set(ids).size).toBe(1);
    expect(await syncDeviceId()).toBe(ids[0]);
  });

  it('is a valid sync device id', async () => {
    expect(await syncDeviceId()).toMatch(/^[A-Za-z0-9-]{1,64}$/);
  });
});

describe('the first links decided', () => {
  it('are remembered once each, and can be forgotten', async () => {
    await engineSettings.keepAgainst('dev-b');
    await engineSettings.keepAgainst('dev-b');
    await engineSettings.keepAgainst('dev-a');
    expect([...(await engineSettings.keptAgainst())].sort()).toEqual(['dev-a', 'dev-b']);
    await engineSettings.stopKeepingAgainst('dev-b');
    expect([...(await engineSettings.keptAgainst())]).toEqual(['dev-a']);
  });
});

describe('coerceSyncSettings', () => {
  it('makes sense of anything', () => {
    expect(coerceSyncSettings(null)).toEqual(DEFAULT_SYNC_SETTINGS);
    expect(coerceSyncSettings('x')).toEqual(DEFAULT_SYNC_SETTINGS);
    expect(coerceSyncSettings({ enabled: 'yes', deviceId: 5, keptAgainst: 'x', lastRead: '', lastWrite: {} })).toEqual(DEFAULT_SYNC_SETTINGS);
    expect(coerceSyncSettings({ enabled: true, deviceId: 'd', keptAgainst: ['b', 'a', 'b', 3, ''], lastRead: 'r', lastWrite: 'w' })).toEqual({
      enabled: true,
      deviceId: 'd',
      keptAgainst: ['a', 'b'],
      lastRead: 'r',
      lastWrite: 'w',
    });
  });
});
