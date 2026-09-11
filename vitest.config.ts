import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // db/index.ts imports `app` from electron just to call app.getPath() as
      // a fallback when SIMPLE_BUDGET_DB isn't set — tests always set it, so
      // this stub only needs to exist for the import to resolve.
      electron: resolve(__dirname, './test/mocks/electron.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['{src,electron}/**/*.test.ts'],
  },
});
