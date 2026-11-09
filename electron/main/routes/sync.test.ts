import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTestApp } from '../../../test/dbFixture';
import type { FirstLinkOffer } from '../sync/plan';
import { SyncCoordinator } from '../syncing/coordinator';
import type { SyncOutcome, SyncReport } from '../syncing/engine';
import { DEFAULT_SYNC_SETTINGS } from '../syncing/settings';
import type { SyncSettings } from '../syncing/settings';
import { createSyncRouter } from './sync';

const offer: FirstLinkOffer = {
  deviceId: 'phone',
  deviceName: 'Pixel 10',
  writtenAt: '2026-11-09T11:00:00Z',
  remote: { accounts: 2, items: 5, corrections: 1, lastChange: '2026-11-08T10:00:00Z' },
  local: { accounts: 1, items: 0, corrections: 0, lastChange: '2026-11-01T10:00:00Z' },
  suggested: 'REMOTE',
};

const report = (devices: SyncReport['devices']): SyncOutcome => ({
  kind: 'done',
  report: { readAt: '2026-11-09T12:00:00Z', changes: { added: 0, updated: 0, removed: 0, tombstones: 0 }, devices, published: { kind: 'unchanged' } },
});

function setUp(initial: Partial<SyncSettings> = {}, folder: string | null = '/Drive/Budget') {
  let settings: SyncSettings = { ...DEFAULT_SYNC_SETTINGS, ...initial };
  const outcomes: SyncOutcome[] = [];
  const engine = {
    sync: vi.fn(async (): Promise<SyncOutcome> => outcomes.shift() ?? report([])),
    resolveFirstLink: vi.fn(async (): Promise<SyncOutcome> => outcomes.shift() ?? report([])),
    exclusively: async <T>(task: () => Promise<T>) => task(),
  };
  const coordinator = new SyncCoordinator({
    engine,
    settings: { read: async () => settings, update: async (change) => (settings = { ...settings, ...change(settings) }) },
    folderPath: async () => folder,
  });
  const app = express();
  app.use(express.json());
  app.use(
    '/api/sync',
    createSyncRouter(() => coordinator),
  );
  return { app, engine, outcomes, settings: () => settings };
}

afterEach(() => vi.restoreAllMocks());

describe('GET /api/sync', () => {
  it('tells what the screen shows', async () => {
    const { app } = setUp({ lastRead: '2026-11-09T12:00:00Z' });
    const res = await request(app).get('/api/sync');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: false, folder: '/Drive/Budget', running: false, devices: [], problem: null, changesBroughtIn: null, lastRead: '2026-11-09T12:00:00Z', lastWrite: null });
  });

  it('does not pass on why a file was skipped, only that it was and the reason', async () => {
    const { app, outcomes } = setUp({ enabled: true });
    outcomes.push(report([{ kind: 'skipped', deviceId: 'broken', reason: 'CHECKSUM', detail: 'the payload does not match its hash' }]));
    const res = await request(app).post('/api/sync/now');
    expect(res.body.devices).toEqual([{ kind: 'skipped', deviceId: 'broken', reason: 'CHECKSUM' }]);
  });

  it('carries an offer with both sides', async () => {
    const { app, outcomes } = setUp({ enabled: true });
    outcomes.push(report([{ kind: 'offer', deviceId: 'phone', offer }]));
    const res = await request(app).post('/api/sync/now');
    expect(res.body.devices).toEqual([{ kind: 'offer', deviceId: 'phone', offer }]);
  });
});

describe('POST /api/sync/enable and /disable', () => {
  it('turns sync on, syncs, and says so', async () => {
    const { app, engine, settings } = setUp();
    const res = await request(app).post('/api/sync/enable');
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(settings().enabled).toBe(true);
    expect(engine.sync).toHaveBeenCalledTimes(1);
  });

  it('refuses without a backup folder', async () => {
    const { app, engine, settings } = setUp({}, null);
    const res = await request(app).post('/api/sync/enable');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'no_backup_folder' });
    expect(settings().enabled).toBe(false);
    expect(engine.sync).not.toHaveBeenCalled();
  });

  it('turns sync off', async () => {
    const { app, settings } = setUp({ enabled: true });
    const res = await request(app).post('/api/sync/disable');
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(settings().enabled).toBe(false);
  });
});

describe('POST /api/sync/now', () => {
  it('syncs and returns the result', async () => {
    const { app, engine, outcomes } = setUp({ enabled: true });
    outcomes.push(report([{ kind: 'merged', deviceId: 'phone', deviceName: 'Pixel 10', writtenAt: '2026-11-09T11:00:00Z' }]));
    const res = await request(app).post('/api/sync/now');
    expect(engine.sync).toHaveBeenCalledTimes(1);
    expect(res.body.devices).toEqual([{ kind: 'merged', deviceId: 'phone', deviceName: 'Pixel 10', writtenAt: '2026-11-09T11:00:00Z' }]);
  });

  it('reports a problem in the status rather than as an error', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { app, outcomes } = setUp({ enabled: true });
    outcomes.push({ kind: 'folder-unreachable', cause: new Error('x') });
    const res = await request(app).post('/api/sync/now');
    expect(res.status).toBe(200);
    expect(res.body.problem).toBe('folder-unreachable');
  });
});

describe('POST /api/sync/resolve', () => {
  const withOffer = async () => {
    const context = setUp({ enabled: true });
    context.outcomes.push(report([{ kind: 'offer', deviceId: 'phone', offer }]));
    await request(context.app).post('/api/sync/now');
    return context;
  };

  it.each(['LOCAL', 'REMOTE'] as const)('settles the offer in favour of %s, using the offer the server holds', async (winner) => {
    const { app, engine, outcomes } = await withOffer();
    outcomes.push(report([{ kind: 'merged', deviceId: 'phone', deviceName: 'Pixel 10', writtenAt: offer.writtenAt }]));

    const res = await request(app).post('/api/sync/resolve').send({ deviceId: 'phone', writtenAt: offer.writtenAt, winner });

    expect(res.status).toBe(200);
    expect(engine.resolveFirstLink).toHaveBeenCalledWith(offer, winner);
    expect(res.body.devices[0].kind).toBe('merged');
  });

  it('is refused when the person decided about an older offer', async () => {
    const { app, engine } = await withOffer();
    const res = await request(app).post('/api/sync/resolve').send({ deviceId: 'phone', writtenAt: '2026-11-09T10:00:00Z', winner: 'REMOTE' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'offer_expired' });
    expect(engine.resolveFirstLink).not.toHaveBeenCalled();
  });

  it('is refused when there is no offer for that device', async () => {
    const { app, engine } = setUp({ enabled: true });
    const res = await request(app).post('/api/sync/resolve').send({ deviceId: 'phone', writtenAt: offer.writtenAt, winner: 'REMOTE' });
    expect(res.status).toBe(409);
    expect(engine.resolveFirstLink).not.toHaveBeenCalled();
  });

  it('is refused for a device that is not offering, even when its name is known', async () => {
    const { app, engine } = await withOffer();
    const res = await request(app).post('/api/sync/resolve').send({ deviceId: 'tablet', writtenAt: offer.writtenAt, winner: 'REMOTE' });
    expect(res.status).toBe(409);
    expect(engine.resolveFirstLink).not.toHaveBeenCalled();
  });

  it.each([
    [{}],
    [{ deviceId: 'phone', writtenAt: offer.writtenAt }],
    [{ deviceId: 'phone', writtenAt: offer.writtenAt, winner: 'BOTH' }],
    [{ deviceId: 5, writtenAt: offer.writtenAt, winner: 'LOCAL' }],
  ])('is refused for a request that does not make sense: %j', async (body) => {
    const { app, engine } = await withOffer();
    const res = await request(app).post('/api/sync/resolve').send(body);
    expect(res.status).toBe(400);
    expect(engine.resolveFirstLink).not.toHaveBeenCalled();
  });
});

describe('the real router', () => {
  it('is mounted at /api/sync', async () => {
    await withTestApp(async (app) => {
      const res = await request(app).get('/api/sync');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ enabled: false, devices: [], problem: null });
    });
  });
});
