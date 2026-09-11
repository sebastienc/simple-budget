import express from 'express';
import { join } from 'path';
import { apiRouter } from './routes/api';
import { requireAllowedOrigin } from './originCheck';

export const LOCAL_SERVER_PORT = 5680;

/**
 * Origins allowed to call `/api`. There's no auth — the server trusts nothing
 * but this — because it's reachable from any webpage in any browser tab on
 * the machine, not just the app's own window (see originCheck.ts).
 *
 * In dev, the renderer runs on the Vite dev server and proxies `/api`
 * through to this one (electron.vite.config.ts), so the `Origin` this server
 * sees is the Vite dev origin, not 127.0.0.1 — `ELECTRON_RENDERER_URL` is
 * exactly that origin, and is already how the rest of this file detects dev.
 */
export function allowedOrigins(): string[] {
  const origins = [`http://127.0.0.1:${LOCAL_SERVER_PORT}`];
  if (process.env.ELECTRON_RENDERER_URL) {
    origins.push(new URL(process.env.ELECTRON_RENDERER_URL).origin);
  }
  return origins;
}

export function createServer() {
  const app = express();
  app.use(express.json());
  app.use('/api', requireAllowedOrigin(allowedOrigins()), apiRouter);

  const isDev = !!process.env.ELECTRON_RENDERER_URL;
  if (!isDev) {
    const rendererDir = join(__dirname, '../renderer');
    app.use(express.static(rendererDir));
    app.use((_req, res) => {
      res.sendFile(join(rendererDir, 'index.html'));
    });
  }

  return app;
}

export function startServer(): Promise<{ port: number }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const app = createServer();
    const server = app.listen(LOCAL_SERVER_PORT, '127.0.0.1', () => {
      resolvePromise({ port: LOCAL_SERVER_PORT });
    });
    server.on('error', rejectPromise);
  });
}
