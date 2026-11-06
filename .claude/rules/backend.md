---
paths:
  - "electron/**/*.ts"
---

# Backend (electron/main)

**Data layer:** SQLite via `better-sqlite3`, queried through Kysely (`db/queries.ts`, schema in `db/schema.ts`).

**Migrations are in-code**, not filesystem-discovered — electron-vite bundles the main process into a single file, so migrations can't be read from disk at runtime. Add a new file under `db/migrations/`, then register it in the `Record<string, Migration>` map in `db/index.ts` (import it and add the map entry). Existing migrations are additive (new tables/columns) rather than destructive rewrites, once real user data exists — prefer the same unless there's a strong reason not to.

**Backups (`backup/`)** write snapshots into a folder a cloud client syncs (Google Drive, Dropbox, iCloud),
on quit and once a day, keeping the last N *per machine* — `naming.ts` holds the file-naming and retention
rules, kept free of `fs` and `electron` so they're unit tested. **Never hand the live database to a sync
client:** WAL mode means `db`/`-wal`/`-shm` must agree, and a client uploading them independently produces
a corrupt or silently stale restore. Snapshots come from `sqlite.backup()` (one consistent, closed file)
and are written under a temporary name and renamed into place, so a half-written file is never uploaded.
The folder setting lives in `backup-settings.json` beside the database, not *in* it — it describes the
machine, not the budget, and keeping it there means `SIMPLE_BUDGET_DB` isolates demo runs from it.

**Core algorithm:** the day-by-day cash-flow projection lives in `projection.ts` — hand-rolled recurrence logic (no `rrule` dependency, kept dependency-free by design), covering daily/weekly/monthly/yearly/semimonthly frequencies with interval support and weekend-shifting for semimonthly. Exposed via `/api/accounts/:id/projection` and `/api/net-worth` in `routes/api.ts`. `routes/mappers.ts` is the DB-row-to-JSON boundary (snake_case → camelCase) — new derived/computed fields belong there, not spread directly from DB rows.

**Golden vectors for the mobile port:** `test/golden/projection.json` records the exact output of `projection.ts` for the inputs in `test/golden/cases.ts`; the Android app (`simple-budget-mobile`) checks its Kotlin port against it. If you change `projection.ts` behaviour on purpose, run `npm run golden` and commit the regenerated file in the same change (`projection.golden.test.ts` fails otherwise). Add a case to `cases.ts` for any new edge case you fix — dates, rounding and clamping are exactly what a port gets subtly wrong. Never edit the JSON by hand; `cases.ts`/`generate.ts` must stay free of non-erasable TypeScript (enums, parameter properties) because the script runs them through Node's type stripping.
