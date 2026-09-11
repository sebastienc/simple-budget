import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import express from 'express';
import type { Kysely } from 'kysely';
import type { Database } from '../electron/main/db/schema';
import { initDb } from '../electron/main/db';
import { apiRouter } from '../electron/main/routes/api';

/**
 * Runs `fn` against a freshly migrated, throwaway SQLite database — a real
 * file in its own temp directory, pointed at via SIMPLE_BUDGET_DB (the same
 * lever db/index.ts already offers for demo runs), not `:memory:`, so no
 * production code needs a test-only code path.
 */
export async function withTestDb(fn: (db: Kysely<Database>) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'simple-budget-test-'));
  process.env.SIMPLE_BUDGET_DB = join(dir, 'test.db');
  try {
    const db = await initDb();
    await fn(db);
  } finally {
    delete process.env.SIMPLE_BUDGET_DB;
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Same as {@link withTestDb}, but hands back a minimal Express app mounting
 * just `apiRouter` at `/api` for a supertest agent to drive. Deliberately
 * skips server.ts's origin-check middleware — that's already covered by
 * originCheck.test.ts, and a same-process HTTP client has no Origin header
 * to check anyway.
 */
export async function withTestApp(fn: (app: express.Express) => Promise<void>): Promise<void> {
  await withTestDb(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', apiRouter);
    await fn(app);
  });
}
