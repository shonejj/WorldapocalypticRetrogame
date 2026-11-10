/**
 * Single source of truth for game identity and in-world names.
 * Read by the build (index.html <title>, PWA manifest) and by all UI.
 */
export const GAME = {
  title: 'The Last Frequency',
  shortTitle: 'Last Frequency',
  tagline: 'Follow the signal. Stay alive.',
  description: 'A narrative 2.5D survival adventure in a world after the outbreak.',
  version: '0.3.0',
  themeColor: '#070c12',
  backgroundColor: '#040609',
} as const;

export const WORLD_NAMES = {
  storeName: 'FRESH VEGGIES',
  pharmacyName: 'PHARMACY',
  garageName: 'AUTO REPAIR',
  relayName: 'RELAY 7',
  chapter1: 'Market Street', chapter1Location: 'MARKET STREET',
  chapter2: 'The Long Road', chapter2Location: 'HIGHWAY 9',
  chapter3: 'Genova Labs', chapter3Location: 'GENOVA LABS',
  camp1: 'The Keeper\'s Flat', camp2: 'The Barracks',
  labName: 'GENOVA LABS', dinerName: 'ROSIE\'S DINER', gasName: 'FUEL', motelName: 'MOTEL', billboard: 'GENOVA LABS', billboard2: 'WELCOME TO LIGHTHOUSE POINT',
} as const;

/** Never change after release: changing it orphans players' saves and settings. */
export const STORAGE_NAMESPACE = 'tlf';
