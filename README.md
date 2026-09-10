# Simple Budget

A local-only, single-user desktop budgeting app built with Electron. It's a rebuild of a personal multi-year Google Sheets budget, focused on one core question: **given my known recurring bills and income, will I have enough money on any given day?**

Not a category-envelope budget or a bank-synced transaction ledger — it's a day-by-day cash-flow projection based on recurring items (bills, subscriptions, pay, etc.) and a starting balance.

## Features

- **Accounts** with a starting balance and an "as of" anchor date.
- **Recurring items** — daily, weekly, monthly, yearly, or semi-monthly (two configurable days per month, e.g. the 15th and last day, with automatic weekend-to-Friday shifting to match real payroll schedules).
- **Projection table** — a day-by-day running balance over any date range, with negative-balance days flagged.
- **Backup / restore** — export a full SQLite snapshot, or import one to restore (Settings menu).
- **Automatic backups** — point the app at a folder your cloud client already syncs (Google Drive, Dropbox, iCloud) and it writes a snapshot there on quit and once a day, keeping the last N per machine. Restoring one is also how you hand the budget between two computers.
- English and French (`en-US` / `fr-CA`) UI.

## Installing

Grab the installer for your OS from [Releases](https://github.com/sebastienc/simple-budget/releases),
or build one yourself.

### macOS

```sh
npm install
npm run dist       # → release/simple-budget-<version>-arm64.dmg
```

Open the DMG and drag **Simple Budget** to Applications. Apple Silicon only — the DMG is arm64.

The app is **not code-signed** (that needs a paid Apple Developer ID). A DMG you built yourself opens
normally, because macOS only quarantines files that were *downloaded*. One you downloaded from
Releases will be blocked on first launch with "Simple Budget is damaged and can't be opened" — which
is Gatekeeper's misleading way of saying "unsigned". Clear the quarantine flag once:

```sh
xattr -dr com.apple.quarantine "/Applications/Simple Budget.app"
```

Your data lives at `~/Library/Application Support/simple-budget/simple-budget.db`.

### Windows

```sh
npm install
npm run dist -- --win   # → release/simple-budget-<version>-x64.exe
```

Run the installer. It's **not code-signed** either (same reason — a paid certificate), so Windows
SmartScreen will show "Windows protected your PC" on first run of a downloaded copy. Click **More
info → Run anyway** to proceed.

Your data lives at `%APPDATA%\simple-budget\simple-budget.db`.

### Linux

```sh
npm install
npm run dist -- --linux   # → release/simple-budget-<version>-x86_64.AppImage
```

An [AppImage](https://appimage.org/) — no install step, no distro-specific package. Make it
executable and run it:

```sh
chmod +x simple-budget-<version>-x86_64.AppImage
./simple-budget-<version>-x86_64.AppImage
```

Some distros (notably ones shipping GLib ≥ 2.80, e.g. recent Ubuntu/Fedora) need `libfuse2`
installed for AppImages to run at all; if double-clicking or running it does nothing, install that
first.

Your data lives at `~/.config/simple-budget/simple-budget.db`.

---

Either way, your data is never sent anywhere, and it survives reinstalling the app. To move it to
another machine, use the automatic backups above, or Export/Import from the Settings menu.

## Tech stack

- **Renderer:** React 19 + TypeScript + Vite, TailwindCSS v4, React Aria Components, i18next.
- **Main process:** Electron + Express, serving both the UI and a JSON API from a local HTTP server on `127.0.0.1:5680`.
- **Data:** SQLite via `better-sqlite3` + Kysely, stored in the OS's per-app data directory — `~/Library/Application Support/simple-budget/simple-budget.db` on macOS, `%APPDATA%\simple-budget\simple-budget.db` on Windows, `~/.config/simple-budget/simple-budget.db` on Linux.

### Why a local HTTP server instead of Electron IPC?

The app can be opened in a regular browser tab (`http://127.0.0.1:5680` once built, or the Vite dev URL printed by `npm run dev`) as well as in the Electron window — useful for debugging with full Chrome devtools instead of Electron's. The renderer talks to the backend purely over `fetch('/api/...')`, with no `contextBridge`/IPC and no native Electron dialogs (export/import use a plain file download and an `<input type="file">` upload), so the experience is identical either way.

## Development

Requires Node `24.20.0` (see `.nvmrc`).

```sh
npm install       # also rebuilds better-sqlite3's native binding for Electron
npm run dev        # start the app (Electron window + Vite dev server with HMR)
npm run lint       # ESLint
npm test           # unit tests (vitest)
npm run build      # typecheck + production build
npm run dist       # package a distributable for the current OS (add -- --mac / --win / --linux, any combination, to target specific ones)
```

### Demo data

`npm run dev` opens your real database. To poke at the app without putting fake
bills next to real finances, run it against a throwaway one and seed that:

```sh
npm run dev:demo   # app against .demo/simple-budget.db (gitignored)
npm run seed       # in another terminal — fills it with sample accounts
```

The seed goes through the HTTP API, so its rows pass the same validation as
anything typed into the UI, and it refuses to run against a database that
already has accounts (`--force` overrides). Delete `.demo/` to start over.

`SIMPLE_BUDGET_DB` sets the database path for any command, not just `dev:demo`.

### Releases

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`,
`build:` and so on. [release-please](https://github.com/googleapis/release-please) reads them and keeps
a "chore(main): release x.y.z" pull request open against `main`, with the version bump and the
generated changelog. **Merging that PR is what cuts a release:** it tags the commit, creates the GitHub
release, and then a macOS runner builds the DMG, the Windows installer, and the Linux AppImage, and
attaches all three.

So the version in `package.json` is not edited by hand — the type of the commits since the last
release decides it (`fix:` → patch, `feat:` → minor, a `!` or `BREAKING CHANGE:` footer → major). To
override it for one release, put `Release-As: 1.2.3` in a commit footer.

## Project layout

- `electron/main/` — Electron main process: `index.ts` (app lifecycle), `server.ts` (the local Express server), `db/` (Kysely schema, migrations, queries), `routes/` (API handlers), `projection.ts` (the recurrence/cash-flow algorithm).
- `src/` — the React renderer. `src/home/` holds the dashboard; `src/data/` holds the `fetch`-based hooks that talk to the API.

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for missing features and known gaps.
