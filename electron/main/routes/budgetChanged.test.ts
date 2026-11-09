import request from 'supertest';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { withTestApp } from '../../../test/dbFixture';
import { onBudgetChanged } from '../syncing/changes';

// Sync publishes soon after the budget changed through the app; the API is where that is noticed.

const heard = vi.fn();
const stop = onBudgetChanged(heard);

afterEach(() => heard.mockClear());
afterAll(stop);

describe('the API tells sync the budget changed', () => {
  it('after each successful write', async () => {
    await withTestApp(async (app) => {
      const account = await request(app).post('/api/accounts').send({ name: 'Chequing', currency: 'CAD' });
      expect(account.status).toBe(201);
      expect(heard).toHaveBeenCalledTimes(1);

      const item = await request(app).post(`/api/accounts/${account.body.id}/recurring-items`).send({ name: 'Rent', amountCents: -1, frequency: 'monthly', interval: 1, startDate: '2026-01-01' });
      expect(item.status).toBe(201);
      expect(heard).toHaveBeenCalledTimes(2);

      await request(app).patch(`/api/accounts/${account.body.id}`).send({ name: 'Main', startingBalanceDate: '2026-01-01', startingBalanceCents: 0 }).expect(200);
      await request(app).post(`/api/accounts/${account.body.id}/checkpoints`).send({ date: '2026-01-01', balanceCents: 1 }).expect(200);
      await request(app).delete(`/api/recurring-items/${item.body.id}`).expect(204);
      await request(app).delete(`/api/accounts/${account.body.id}`).expect(204);
      expect(heard).toHaveBeenCalledTimes(6);
    });
  });

  it('not for a read', async () => {
    await withTestApp(async (app) => {
      await request(app).get('/api/accounts').expect(200);
      expect(heard).not.toHaveBeenCalled();
    });
  });

  it('not for a write that was refused', async () => {
    await withTestApp(async (app) => {
      const refused = await request(app).post('/api/accounts').send({ name: '', currency: 'CAD' });
      expect(refused.status).toBeGreaterThanOrEqual(400);
      await request(app).delete('/api/accounts/999');
      expect(heard).not.toHaveBeenCalled();
    });
  });

  it('not for setting the backup folder, which does not change the budget', async () => {
    await withTestApp(async (app) => {
      await request(app).put('/api/backup/folder').send({ folder: null });
      expect(heard).not.toHaveBeenCalled();
    });
  });
});
