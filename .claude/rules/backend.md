---
paths:
  - "electron/**/*.ts"
---

# Backend (electron/main)

**Data layer:** SQLite via `better-sqlite3`, queried through Kysely (`db/queries.ts`, schema in `db/schema.ts`).

**Migrations are in-code**, not filesystem-discovered — electron-vite bundles the main process into a single file, so migrations can't be read from disk at runtime. Add a new file under `db/migrations/`, then register it in the `Record<string, Migration>` map in `db/index.ts` (import it and add the map entry). Existing migrations are additive (new tables/columns) rather than destructive rewrites, once real user data exists — prefer the same unless there's a strong reason not to.

**Core algorithm:** the day-by-day cash-flow projection lives in `projection.ts` — hand-rolled recurrence logic (no `rrule` dependency, kept dependency-free by design), covering daily/weekly/monthly/yearly/semimonthly frequencies with interval support and weekend-shifting for semimonthly. Exposed via `/api/accounts/:id/projection` and `/api/net-worth` in `routes/api.ts`. `routes/mappers.ts` is the DB-row-to-JSON boundary (snake_case → camelCase) — new derived/computed fields belong there, not spread directly from DB rows.
