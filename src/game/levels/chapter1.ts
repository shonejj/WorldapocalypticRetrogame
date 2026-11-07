import { WORLD_NAMES } from '../../config/game';
import type { LevelDef } from './types';

/** Chapter 1 — Market Street. Rainy night; the squad starts at FRESH VEGGIES and
 *  follows the signal under the overpass to the radio shack (Relay 7). */
export const CHAPTER1: LevelDef = {
  id: 'ch1_market_street_v2',
  name: WORLD_NAMES.chapter1,
  location: 'MARKET STREET',
  width: 74,
  spawnX: 4.5,
  seed: 1977,
  street: [
    { piece: 'blockA', x: -1.5 },
    { piece: 'store', x: 5.6 },
    { piece: 'vanFence', x: 14.8 },
    { piece: 'lamp', x: 16.4 },
    { piece: 'billboard', x: 17.5 },
    { piece: 'blockB', x: 21.2 },
    { piece: 'overpass', x: 28.4 },
    { piece: 'vanFence', x: 46.6, flip: true },
    { piece: 'lamp', x: 48.2 },
    { piece: 'billboard', x: 49.3, flip: true },
    { piece: 'blockA', x: 53, flip: true },
    { piece: 'relay', x: 60.2 },
    { piece: 'blockB', x: 65.7, flip: true },
  ],
  curb: [
    { piece: 'sedan', x: 19.4 },
    { piece: 'bus', x: 30.5 },
    { piece: 'barrier', x: 38.6 },
    { piece: 'truck', x: 41.2, flip: true },
    { piece: 'wreck', x: 55.4 },
    { piece: 'barrier', x: 67.5, flip: true },
  ],
  foreground: [
    { piece: 'fgPlants', x: -4, y: -0.9, depth: 'fg' },
    { piece: 'fgLeavesL', x: -3, y: 3.6, depth: 'fg' },
    { piece: 'fgTreeLamp', x: 24.5, y: -0.6, depth: 'fg' },
    { piece: 'fgHazard', x: 37.5, y: -0.9, depth: 'fg' },
    { piece: 'fgLeavesR', x: 44, y: 3.7, depth: 'fg' },
    { piece: 'fgPlants', x: 52, y: -0.9, depth: 'fg', flip: true },
    { piece: 'fgFence', x: 69, y: -0.7, depth: 'fg' },
  ],
  props: [
    { x: 14.3, kind: 'crates' }, { x: 24.6, kind: 'barrel' }, { x: 25.2, kind: 'barrel' }, { x: 27.5, kind: 'cone' },
    { x: 39.8, kind: 'cone' }, { x: 47.2, kind: 'crates' }, { x: 58.6, kind: 'barrel' },
  ],
  caches: [
    { id: 'c_veggies', x: 9.8, label: `Search ${WORLD_NAMES.storeName}`, loot: { food: 3, water: 2, cloth: 1 }, time: 1.6 },
    { id: 'c_sedan', x: 20.8, label: 'Search car trunk', loot: { ammo_pistol: 8, scrap: 2 }, time: 1.2, noise: 3 },
    { id: 'c_billboard', x: 18.9, label: 'Search the billboard hut', loot: { bandage: 2, battery: 1 }, time: 1.4 },
    { id: 'c_bus', x: 34, label: 'Search bus', loot: { ammo_pistol: 10, medkit: 1 }, time: 1.6 },
    { id: 'c_truck', x: 44.5, label: 'Search truck cab', loot: { ammo_shells: 6, ammo_rifle: 5 }, time: 1.4, noise: 3 },
    { id: 'c_wreck', x: 57, label: 'Search the wreck', loot: { scrap: 4, water: 1 }, time: 1.2, noise: 4 },
  ],
  pickups: [
    { id: 'p1', x: 23.5, item: 'ammo_pistol', qty: 6 }, { id: 'p2', x: 31.5, item: 'water', qty: 1 },
    { id: 'p3', x: 40.4, item: 'ammo_rifle', qty: 3 }, { id: 'p4', x: 52, item: 'bandage', qty: 1 }, { id: 'p5', x: 59, item: 'ammo_shells', qty: 4 },
  ],
  infected: [
    { id: 'i1', x: 17.5, type: 'common', state: 'idle', facing: -1 }, { id: 'i2', x: 21, type: 'common', state: 'wander' },
    { id: 'i3', x: 26.5, type: 'common', state: 'dormant' },
    { id: 'i4', x: 32, type: 'common', state: 'wander' }, { id: 'i5', x: 34.5, type: 'common', state: 'idle' }, { id: 'i6', x: 36.5, type: 'runner', state: 'idle', facing: -1 },
    { id: 'i7', x: 41, type: 'common', state: 'dormant' }, { id: 'i8', x: 45.5, type: 'common', state: 'wander' },
    { id: 'i9', x: 50.5, type: 'runner', state: 'wander' }, { id: 'i10', x: 53.5, type: 'common', state: 'idle' },
    { id: 'i11', x: 58, type: 'common', state: 'dormant' },
    { id: 'i12', x: 63.5, type: 'brute', state: 'idle', facing: -1 }, { id: 'i13', x: 61.5, type: 'common', state: 'idle' }, { id: 'i14', x: 66, type: 'common', state: 'wander' },
  ],
  checkpoints: [24, 40, 54],
  objectives: [
    { id: 'o_supplies', text: 'Scavenge supplies on Market Street' },
    { id: 'o_relay', text: 'Reach Relay 7 and restore the radio', x: 61.4 },
  ],
  goal: { x: 61.4, label: 'Restore radio relay', objective: 'o_relay' },
  radioLines: [
    { x: 5, speaker: 'IRIS', text: 'Signal\'s strongest east. Relay 7 is the shack past the overpass.' },
    { x: 14, speaker: 'REED', text: 'Infected ahead. Keep it quiet — gunfire will pull the whole street.' },
    { x: 34, speaker: 'MILLER', text: 'Runner under the bridge. Don\'t let it get a scream out.' },
    { x: 55, speaker: 'IRIS', text: 'Something big near the relay. The band\'s going crazy.' },
  ],
};
