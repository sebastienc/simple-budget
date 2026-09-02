import express from 'express';
import { join } from 'path';
import { apiRouter } from './routes/api';

export const LOCAL_SERVER_PORT = 5680;

export function createServer() {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

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
