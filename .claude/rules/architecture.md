# Architecture

Simple Budget is a local-only, single-device Electron app — no cloud backend, no auth, no telemetry.

**Local server, dual access:** the Electron main process runs a local Express server bound to `127.0.0.1:5680` (fixed port, dev and prod alike) that serves both the built renderer and a JSON `/api/*` surface backed by SQLite. This lets the app work identically in the Electron window or a plain browser tab pointed at that port. See `electron/main/index.ts` (window/app lifecycle) and `electron/main/server.ts` (Express setup).

**No IPC, no native dialogs:** the renderer talks to main exclusively over HTTP (`fetch('/api/...')`), not `contextBridge`/IPC — there's no preload script. Native Electron dialogs (`dialog` module) are avoided too, since they wouldn't work in a browser tab: destructive confirmations use `window.confirm()`, and backup export/import use a plain HTTP file download / `<input type="file">` upload instead of native file pickers.

**Path alias:** `@/*` maps to `./src/*` — configured in both `tsconfig.app.json` and `electron.vite.config.ts`'s renderer alias; keep both in sync if it ever changes.

**Key files:** `src/main.tsx` (provider bootstrap), `src/routes.tsx` (routes), `electron/main/index.ts` (app/window lifecycle), `electron/main/server.ts` (local server), `electron/main/projection.ts` (cash-flow projection algorithm), `electron/main/routes/api.ts` (REST surface).
