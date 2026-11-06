import { WORLD_NAMES } from '../../config/game';
import type { LevelDef } from './types';

/** Chapter 1 — Market Street. Rainy night; the squad leaves the alley behind
 *  FRESH VEGGIES and follows the signal to Relay 7 at the end of the street. */
export const CHAPTER1: LevelDef = {
  id: 'ch1_market_street',
  name: WORLD_NAMES.chapter1,
  location: 'MARKET STREET',
  width: 170,
  spawnX: 4,
  seed: 1977,
  buildings: [
    { x: -6, w: 14, h: 11, kind: 'ruin' },
    { x: 9, w: 17, h: 12, kind: 'store', sign: WORLD_NAMES.storeName, signColor: '#2c4a2a', litWindows: 0.08 },
    { x: 27, w: 13, h: 14, kind: 'apartment', litWindows: 0.1 },
    { x: 41, w: 15, h: 11, kind: 'store', sign: 'PHARMACY', signColor: '#24414f', litWindows: 0.05 },
    { x: 57, w: 12, h: 9, kind: 'ruin' },
    { x: 80, w: 16, h: 10, kind: 'garage' },
    { x: 97, w: 14, h: 16, kind: 'apartment', litWindows: 0.15 },
    { x: 112, w: 12, h: 10, kind: 'ruin' },
    { x: 125, w: 15, h: 13, kind: 'apartment', litWindows: 0.04 },
    { x: 172, w: 14, h: 12, kind: 'ruin' },
  ],
  rearBuildings: Array.from({ length: 28 }, (_, i) => ({ x: i * 9 - 10, w: 7 + (i * 37) % 5, h: 12 + (i * 53) % 10 })),
  curbVehicles: [
    { x: 20, kind: 'sedan' }, { x: 49, kind: 'truck', flip: true }, { x: 66, kind: 'hatch' },
    { x: 92, kind: 'suv', flip: true }, { x: 108, kind: 'bus' }, { x: 136, kind: 'sedan', flip: true }, { x: 147, kind: 'hatch' },
  ],
  props: [
    { x: 7, kind: 'dumpster', dynamic: false }, { x: 15.5, kind: 'crate', dynamic: true }, { x: 16.3, kind: 'crate', dynamic: true },
    { x: 24, kind: 'barrel', dynamic: true }, { x: 33, kind: 'cone', dynamic: true }, { x: 38, kind: 'barrier', dynamic: false },
    { x: 53, kind: 'barrel', dynamic: true }, { x: 53.6, kind: 'barrel', dynamic: true }, { x: 62, kind: 'crate', dynamic: true },
    { x: 74, kind: 'barrier', dynamic: false }, { x: 77, kind: 'cone', dynamic: true }, { x: 88, kind: 'barrel', dynamic: true },
    { x: 102, kind: 'dumpster', dynamic: false }, { x: 117, kind: 'crate', dynamic: true }, { x: 118, kind: 'crate', dynamic: true },
    { x: 130, kind: 'cone', dynamic: true }, { x: 142, kind: 'barrier', dynamic: false }, { x: 152, kind: 'barrel', dynamic: true },
  ],
  decor: [
    { x: 2, kind: 'fence' }, { x: 5, kind: 'bush' }, { x: 13, kind: 'lamp', lit: true }, { x: 26, kind: 'pole' },
    { x: 36, kind: 'lamp', lit: true, flicker: true }, { x: 45, kind: 'bush' }, { x: 58, kind: 'tree' }, { x: 63, kind: 'lamp', lit: false },
    { x: 71, kind: 'billboard', text: 'GENOVA LABS' }, { x: 84, kind: 'pole' }, { x: 90, kind: 'lamp', lit: true }, { x: 114, kind: 'bush' },
    { x: 119, kind: 'lamp', lit: true, flicker: true }, { x: 128, kind: 'pole' }, { x: 140, kind: 'fence' }, { x: 146, kind: 'lamp', lit: true },
    { x: 155, kind: 'relay' }, { x: 166, kind: 'tree' },
  ],
  caches: [
    { id: 'c_veggies', x: 16.8, label: `Search ${WORLD_NAMES.storeName}`, loot: { food: 3, water: 2, cloth: 1 }, time: 1.6 },
    { id: 'c_car1', x: 19.5, label: 'Search car trunk', loot: { ammo_pistol: 8, scrap: 2 }, time: 1.2, noise: 3 },
    { id: 'c_pharmacy', x: 48, label: 'Search PHARMACY', loot: { medkit: 2, bandage: 2 }, time: 1.8 },
    { id: 'c_truck', x: 50, label: 'Search truck cab', loot: { ammo_shells: 6, battery: 1 }, time: 1.4, noise: 3 },
    { id: 'c_garage', x: 88, label: 'Search AUTO REPAIR', loot: { scrap: 6, ammo_shells: 4 }, time: 2 },
    { id: 'c_apartment', x: 104, label: 'Search apartment lobby', loot: { food: 2, water: 2, ammo_rifle: 5 }, time: 1.6 },
    { id: 'c_bus', x: 110, label: 'Search bus', loot: { ammo_pistol: 10, bandage: 1 }, time: 1.4 },
    { id: 'c_dumpster', x: 102, label: 'Search dumpster', loot: { cloth: 2, scrap: 1 }, time: 1.2, noise: 4 },
  ],
  pickups: [
    { id: 'p1', x: 29, item: 'ammo_pistol', qty: 6 }, { id: 'p2', x: 60, item: 'water', qty: 1 }, { id: 'p3', x: 76, item: 'ammo_rifle', qty: 3 },
    { id: 'p4', x: 95, item: 'bandage', qty: 1 }, { id: 'p5', x: 124, item: 'ammo_shells', qty: 4 }, { id: 'p6', x: 138, item: 'medkit', qty: 1 },
  ],
  infected: [
    { id: 'i1', x: 31, type: 'common', state: 'idle', facing: -1 }, { id: 'i2', x: 34, type: 'common', state: 'wander' },
    { id: 'i3', x: 44, type: 'common', state: 'dormant' },
    { id: 'i4', x: 55, type: 'common', state: 'wander' }, { id: 'i5', x: 57, type: 'common', state: 'idle' }, { id: 'i6', x: 59.5, type: 'common', state: 'wander' },
    { id: 'i7', x: 69, type: 'runner', state: 'idle', facing: -1 },
    { id: 'i8', x: 79, type: 'common', state: 'dormant' }, { id: 'i9', x: 83, type: 'common', state: 'dormant' },
    { id: 'i10', x: 94, type: 'common', state: 'wander' }, { id: 'i11', x: 96, type: 'common', state: 'idle' }, { id: 'i12', x: 99, type: 'runner', state: 'idle' },
    { id: 'i13', x: 113, type: 'common', state: 'wander' }, { id: 'i14', x: 116, type: 'common', state: 'idle' }, { id: 'i15', x: 121, type: 'runner', state: 'wander' },
    { id: 'i16', x: 131, type: 'common', state: 'dormant' }, { id: 'i17', x: 134, type: 'common', state: 'wander' },
    { id: 'i18', x: 150, type: 'brute', state: 'idle', facing: -1 }, { id: 'i19', x: 148, type: 'common', state: 'idle' }, { id: 'i20', x: 153, type: 'common', state: 'wander' },
  ],
  checkpoints: [42, 86, 126],
  objectives: [
    { id: 'o_supplies', text: 'Scavenge supplies on Market Street' },
    { id: 'o_relay', text: 'Reach Relay 7 and restore the radio', x: 156 },
  ],
  goal: { x: 156.5, label: 'Restore radio relay', objective: 'o_relay' },
  radioLines: [
    { x: 6, speaker: 'IRIS', text: 'Signal\'s strongest east. Relay 7 should be at the end of Market Street.' },
    { x: 30, speaker: 'REED', text: 'Infected ahead. Keep it quiet — gunfire will pull the whole street.' },
    { x: 70, speaker: 'MILLER', text: 'Runner by the billboard. Don\'t let it get a scream out.' },
    { x: 140, speaker: 'IRIS', text: 'Something big near the relay. The band\'s going crazy.' },
  ],
};
