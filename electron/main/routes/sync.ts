import { Router } from 'express';
import type { SyncCoordinator, SyncStatus } from '../syncing/coordinator';
import type { DeviceStatus } from '../sync/plan';

// What the Sync section of the Backups dialog talks to. Thin on purpose: every decision is the coordinator's. The first
// link a person settles is looked up here from what the coordinator last found, never taken from the request, so a
// request can only choose between the two sides of an offer that really was made.

/** A device's status as the screen needs it: the technical detail of why a file was skipped stays on this side. */
function deviceJson(device: DeviceStatus) {
  return device.kind === 'skipped' ? { kind: device.kind, deviceId: device.deviceId, reason: device.reason } : device;
}

function statusJson(status: SyncStatus) {
  return { ...status, devices: status.devices.map(deviceJson) };
}

export function createSyncRouter(coordinator: () => SyncCoordinator): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(statusJson(await coordinator().status()));
  });

  router.post('/enable', async (_req, res) => {
    const result = await coordinator().turnOn();
    if (result === 'no-folder') {
      res.status(400).json({ error: 'no_backup_folder' });
      return;
    }
    res.json(statusJson(await coordinator().status()));
  });

  router.post('/disable', async (_req, res) => {
    await coordinator().turnOff();
    res.json(statusJson(await coordinator().status()));
  });

  router.post('/now', async (_req, res) => {
    await coordinator().syncNow();
    res.json(statusJson(await coordinator().status()));
  });

  router.post('/resolve', async (req, res) => {
    const { deviceId, writtenAt, winner } = req.body ?? {};
    if (typeof deviceId !== 'string' || typeof writtenAt !== 'string' || (winner !== 'LOCAL' && winner !== 'REMOTE')) {
      res.status(400).json({ error: 'deviceId, writtenAt and winner (LOCAL or REMOTE) are required' });
      return;
    }
    const offer = coordinator().offerFor(deviceId);
    // The person decided about what they saw: if that device has written since, they must look again.
    if (offer === undefined || offer.writtenAt !== writtenAt) {
      res.status(409).json({ error: 'offer_expired' });
      return;
    }
    await coordinator().resolve(offer, winner);
    res.json(statusJson(await coordinator().status()));
  });

  return router;
}
