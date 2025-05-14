import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import optimizeLocales from '@react-aria/optimize-locales-plugin';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
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
      '@': path.resolve(__dirname, './src'),
    },
  },
});
