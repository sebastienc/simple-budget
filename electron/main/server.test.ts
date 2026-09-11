import { describe, expect, it } from 'vitest';
import { allowedOrigins, LOCAL_SERVER_PORT } from './server';

describe('allowedOrigins', () => {
  it('always allows the local server\'s own origin', () => {
    const original = process.env.ELECTRON_RENDERER_URL;
    delete process.env.ELECTRON_RENDERER_URL;
    try {
      expect(allowedOrigins()).toEqual([`http://127.0.0.1:${LOCAL_SERVER_PORT}`]);
    } finally {
      if (original !== undefined) {
        process.env.ELECTRON_RENDERER_URL = original;
      }
    }
  });

  it('also allows the Vite dev server\'s origin when ELECTRON_RENDERER_URL is set', () => {
    const original = process.env.ELECTRON_RENDERER_URL;
    process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173/some/path';
    try {
      expect(allowedOrigins()).toEqual([`http://127.0.0.1:${LOCAL_SERVER_PORT}`, 'http://localhost:5173']);
    } finally {
      if (original === undefined) {
        delete process.env.ELECTRON_RENDERER_URL;
      } else {
        process.env.ELECTRON_RENDERER_URL = original;
      }
    }
  });
});
