/**
 * Single source of truth for game identity.
 * Change the title here and it updates everywhere: <title>, PWA manifest,
 * title screen, HUD, pause menu and save-file keys stay stable via SAVE_NAMESPACE.
 * (build/pwa-plugin.ts reads this file at build time for index.html + manifest.)
 */
export const GAME = {
  title: 'The Last Frequency',
  shortTitle: 'Last Frequency',
  tagline: 'Follow the signal. Stay alive.',
  description: 'A narrative 2.5D survival adventure in a world after the outbreak.',
  version: '0.1.0',
  themeColor: '#07121c',
  backgroundColor: '#05090d',
} as const;

/** In-world names (kept here so writers can rename without touching code). */
export const WORLD_NAMES = {
  storeName: 'FRESH VEGGIES',
  chapter1: 'Chapter 1 — Market Street',
  safehouse: 'The Camp',
} as const;

/** Do not change after release: changing it orphans players' saves. */
export const SAVE_NAMESPACE = 'tlf';
