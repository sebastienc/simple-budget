/**
 * Stands in for the real `electron` package outside an actual Electron
 * process (aliased in vitest.config.ts). `db/index.ts` imports `app` at
 * module scope purely to fall back to `app.getPath('userData')` when
 * SIMPLE_BUDGET_DB isn't set — every DB-touching test sets it first (see
 * test/dbFixture.ts), so this branch should never actually run.
 */
export const app = {
  getPath(): never {
    throw new Error('electron.app.getPath() called in a test — set SIMPLE_BUDGET_DB before calling initDb().');
  },
};
