import { defineConfig } from 'vitest/config';
import { offlinePwa } from './build/pwa-plugin.ts';

export default defineConfig({
  base: './',                       // relative URLs: works on GitHub Pages sub-paths and offline
  plugins: [offlinePwa()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
