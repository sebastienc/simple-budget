import { spawn } from 'child_process';
import { once } from 'events';
import type { AddressInfo } from 'net';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { withTestApp } from '../../../test/dbFixture';

// scripts/seed.mjs fills a running app with demo data through the HTTP API. It broke unnoticed when accounts gained a
// required currency, because nothing ran it. This runs the real script against a real server on a throwaway database.

function runSeed(port: number, ...args: string[]): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/seed.mjs', ...args], { env: { ...process.env, SIMPLE_BUDGET_API: `http://127.0.0.1:${port}/api` } });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output }));
  });
}

describe('scripts/seed.mjs', () => {
  it('seeds an empty app with two accounts, their recurring items and a balance correction each', async () => {
    await withTestApp(async (app) => {
      const server = app.listen(0, '127.0.0.1');
      await once(server, 'listening');
      try {
        const { code, output } = await runSeed((server.address() as AddressInfo).port);

        expect(output).toContain('Done.');
        expect(code).toBe(0);
        const accounts = (await request(app).get('/api/accounts')).body as { id: number; name: string; currency: string }[];
        expect(accounts.map((a) => [a.name, a.currency])).toEqual([
          ['Chequing', 'CAD'],
          ['Joint', 'CAD'],
        ]);
        const counts = await Promise.all(
          accounts.map(async (a) => [(await request(app).get(`/api/accounts/${a.id}/recurring-items`)).body.length, (await request(app).get(`/api/accounts/${a.id}/checkpoints`)).body.length]),
        );
        expect(counts).toEqual([
          [9, 1],
          [6, 1],
        ]);
      } finally {
        server.close();
      }
    });
  });

  it('refuses to seed an app that already holds accounts, so it cannot scatter fake bills through real finances', async () => {
    await withTestApp(async (app) => {
      await request(app).post('/api/accounts').send({ name: 'Real account', currency: 'CAD' }).expect(201);
      const server = app.listen(0, '127.0.0.1');
      await once(server, 'listening');
      try {
        const { code, output } = await runSeed((server.address() as AddressInfo).port);

        expect(code).toBe(1);
        expect(output).toContain('Refusing to seed');
        expect((await request(app).get('/api/accounts')).body).toHaveLength(1);
      } finally {
        server.close();
      }
    });
  });
});
