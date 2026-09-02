import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import optimizeLocales from '@react-aria/optimize-locales-plugin';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/main',
      lib: { entry: resolve(__dirname, 'electron/main/index.ts') },
    },
  },
  renderer: {
    root: '.',
    server: {
      proxy: {
        '/api': 'http://127.0.0.1:5680',
      },
    },
    build: {
      outDir: 'dist-electron/renderer',
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        ...optimizeLocales.vite({
          locales: ['en-US', 'fr-CA'],
        }),
        enforce: 'pre',
      },
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
  },
});
