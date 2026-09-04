# Simple Budget

A local-only, single-user desktop budgeting app built with Electron. It's a rebuild of a personal multi-year Google Sheets budget, focused on one core question: **given my known recurring bills and income, will I have enough money on any given day?**

Not a category-envelope budget or a bank-synced transaction ledger — it's a day-by-day cash-flow projection based on recurring items (bills, subscriptions, pay, etc.) and a starting balance.

## Features

- **Accounts** with a starting balance and an "as of" anchor date.
- **Recurring items** — daily, weekly, monthly, yearly, or semi-monthly (two configurable days per month, e.g. the 15th and last day, with automatic weekend-to-Friday shifting to match real payroll schedules).
- **Projection table** — a day-by-day running balance over any date range, with negative-balance days flagged.
- **Backup / restore** — export a full SQLite snapshot, or import one to restore (Settings menu).
- English and French (`en-US` / `fr-CA`) UI.

## Tech stack

- **Renderer:** React 19 + TypeScript + Vite, TailwindCSS v4, React Aria Components, i18next.
- **Main process:** Electron + Express, serving both the UI and a JSON API from a local HTTP server on `127.0.0.1:5680`.
- **Data:** SQLite via `better-sqlite3` + Kysely, stored at `~/Library/Application Support/simple-budget/simple-budget.db` (macOS path; varies by OS).

### Why a local HTTP server instead of Electron IPC?

The app can be opened in a regular browser tab (`http://127.0.0.1:5680` once built, or the Vite dev URL printed by `npm run dev`) as well as in the Electron window — useful for debugging with full Chrome devtools instead of Electron's. The renderer talks to the backend purely over `fetch('/api/...')`, with no `contextBridge`/IPC and no native Electron dialogs (export/import use a plain file download and an `<input type="file">` upload), so the experience is identical either way.

## Development

Requires Node `24.20.0` (see `.nvmrc`).

```sh
npm install       # also rebuilds better-sqlite3's native binding for Electron
npm run dev        # start the app (Electron window + Vite dev server with HMR)
npm run lint       # ESLint
npm run build      # typecheck + production build
npm run dist       # package a distributable (electron-builder, macOS .dmg)
```

## Project layout

- `electron/main/` — Electron main process: `index.ts` (app lifecycle), `server.ts` (the local Express server), `db/` (Kysely schema, migrations, queries), `routes/` (API handlers), `projection.ts` (the recurrence/cash-flow algorithm).
- `src/` — the React renderer. `src/home/` holds the dashboard; `src/data/` holds the `fetch`-based hooks that talk to the API.
