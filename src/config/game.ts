/**
 * Single source of truth for game identity and in-world names.
 * Read by the build (index.html <title>, PWA manifest) and by all UI.
 */
export const GAME = {
  title: 'The Last Frequency',
  shortTitle: 'Last Frequency',
  tagline: 'Follow the signal. Stay alive.',
  description: 'A narrative 2.5D survival adventure in a world after the outbreak.',
  version: '0.2.1',
  themeColor: '#070c12',
  backgroundColor: '#040609',
} as const;

export const WORLD_NAMES = {
  storeName: 'FRESH VEGGIES',
  pharmacyName: 'PHARMACY',
  garageName: 'AUTO REPAIR',
  relayName: 'RELAY 7',
  chapter1: 'Chapter 1 — Market Street',
  chapter1Location: 'MARKET STREET',
} as const;

/** Never change after release: changing it orphans players' saves and settings. */
export const STORAGE_NAMESPACE = 'tlf';
