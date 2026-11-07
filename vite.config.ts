import { defineConfig } from 'vitest/config';
import { offlinePwa } from './build/offline-pwa.ts';
import { ink } from './build/ink.ts';

export default defineConfig({
  base: './',
  plugins: [ink(), offlinePwa()],
  build: { target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 1600 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
