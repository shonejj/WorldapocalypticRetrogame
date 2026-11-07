import { WORLD_NAMES } from '../../config/game';
import type { LevelDef } from './types';

/**
 * Chapter 1 — Market Street (level-design workflow).
 * Metrics (from data.ts): walk 1.75 m/s, run 4.4 m/s; infected sight 9 m (×0.42 crouched in the dark);
 * screen ≈ 18 m wide. Encounters are spaced ≥ 1 screen apart so the player can read and plan them.
 *
 * Critical path: alley → FRESH VEGGIES → pharmacy (battery) → garage workbench (craft fuse:
 * scrap+battery+tape) → overpass gauntlet → Relay 7 (needs fuse) → climax (brute) → restore.
 * Sawtooth pacing: 0.1 teach → 0.3 → 0.45 → 0.15 rest → 0.75 → 0.2 rest → 1.0 climax.
 */
export const CHAPTER1: LevelDef = {
  id: 'ch1', name: WORLD_NAMES.chapter1, location: WORLD_NAMES.chapter1Location,
  x0: -16, x1: 150, spawnX: -9, seed: 1977,
  // gaps between buildings open the view into the hazy city (art pass 2: depth like the reference)
  // x = left edge. Gaps between buildings open the view into the hazy city (art pass 2: depth like the reference)
  buildings: [
    { x: -26.5, w: 10, floors: 3, kind: 'ruin', wall: 'brick', tint: '#5e3a30' },
    { x: -16, w: 12, floors: 2, kind: 'store', wall: 'plaster', tint: '#8a7a62', sign: WORLD_NAMES.storeName, signBg: '#7a2420' },
    { x: 3, w: 10, floors: 4, kind: 'apartment', wall: 'concrete', tint: '#6a6e6c', lit: 0.15 },
    { x: 13.5, w: 11, floors: 3, kind: 'apartment', wall: 'brick', tint: '#6b3f33', lit: 0.1 },
    { x: 25, w: 11, floors: 2, kind: 'pharmacy', wall: 'concrete', tint: '#73806f', sign: WORLD_NAMES.pharmacyName },
    { x: 46, w: 12, floors: 1, kind: 'garage', wall: 'concrete', tint: '#5f6360', sign: WORLD_NAMES.garageName },
    { x: 58.5, w: 9, floors: 4, kind: 'apartment', wall: 'plaster', tint: '#857a66', lit: 0.08 },
    { x: 97, w: 10, floors: 3, kind: 'apartment', wall: 'brick', tint: '#5e3a30', lit: 0.05 },
    { x: 136, w: 12, floors: 3, kind: 'ruin', wall: 'brick', tint: '#5a3a30' },
  ],
  relayX: 121, overpass: [64, 96], billboard: { x: 90, text: 'GENOVA LABS' },
  lamps: [{ x: -3, lit: true }, { x: 10, lit: true, flicker: true }, { x: 23, lit: false }, { x: 33, lit: true }, { x: 44, lit: true }, { x: 56, lit: true, flicker: true },
    { x: 70, lit: false }, { x: 80, lit: true, flicker: true }, { x: 92, lit: true }, { x: 104, lit: false }, { x: 116, lit: true }, { x: 130, lit: true, flicker: true }],
  poles: [-14, 2, 18, 34, 50, 66, 82, 98, 114, 130, 146],
  fences: [[-4, 3], [36, 46], [67.5, 97], [107, 136], [148, 165]],
  trees: [41, 70, 112, 150],
  vehicles: [{ x: 0.5, kind: 'van', z: -7.5 }, { x: 6, kind: 'sedan' }, { x: 21, kind: 'hatch', flip: true }, { x: 39, kind: 'van', z: -8, flip: true }, { x: 42, kind: 'van' }, { x: 63.5, kind: 'truck', flip: true }, { x: 72, kind: 'bus', z: -7 }, { x: 86, kind: 'sedan', flip: true }, { x: 104, kind: 'hatch', z: -7 }, { x: 126, kind: 'van', flip: true, z: -7.5 }],
  props: [
    { x: -2.5, kind: 'dumpster', z: -3.4 }, { x: -6, kind: 'trashbag', z: -3.7 }, { x: 4, kind: 'crate' }, { x: 4.8, kind: 'crate' },
    { x: 15, kind: 'barrel' }, { x: 15.6, kind: 'barrel' }, { x: 24, kind: 'cone', z: 1.0 }, { x: 31, kind: 'trashbag', z: -3.7 }, { x: 38, kind: 'barrier' },
    { x: 44, kind: 'tires', z: -3.6 }, { x: 49, kind: 'crate' }, { x: 56, kind: 'barrel' }, { x: 63, kind: 'cone', z: 0.9 }, { x: 68, kind: 'barrier' },
    { x: 77, kind: 'crate' }, { x: 77.8, kind: 'barrel' }, { x: 88, kind: 'barrier' }, { x: 95, kind: 'cone', z: 1.0 }, { x: 108, kind: 'barrel' },
    { x: 113, kind: 'crate' }, { x: 119, kind: 'barrier' }, { x: 133, kind: 'tires', z: -3.6 },
  ],
  caches: [
    { id: 'c_veggies', x: -12.5, label: `Enter ${WORLD_NAMES.storeName}`, enter: 'store', loot: { food: 2, water: 2, cloth: 2 }, time: 1.6 },
    { id: 'c_sedan', x: 7.6, label: 'Search the sedan', style: 'car', loot: { ammo_rifle: 12, tape: 1 }, time: 1.3, noise: 3 },
    { id: 'c_apartment', x: 18, label: 'Enter the apartment', enter: 'apartment', loot: { alcohol: 1, ammo_9mm: 10 }, time: 1.5 },
    { id: 'c_pharmacy', x: 28.5, label: `Enter the ${WORLD_NAMES.pharmacyName.toLowerCase()}`, enter: 'pharmacy', loot: { bandage: 2, medkit: 1, battery: 1, alcohol: 1 }, time: 2 },
    { id: 'c_van', x: 42, label: 'Search the van', style: 'car', loot: { scrap: 2, bottle: 1 }, time: 1.3, noise: 3 },
    { id: 'c_garage', x: 50, label: `Enter the ${WORLD_NAMES.garageName.toLowerCase()}`, enter: 'garage', loot: { scrap: 3, tape: 1, ammo_shells: 6 }, time: 2 },
    { id: 'c_bus', x: 74, label: 'Board the bus', enter: 'bus', loot: { ammo_rifle: 15, water: 1, food: 1 }, time: 1.6 },
    { id: 'c_billboard', x: 91, label: 'Search the maintenance box', style: 'box', loot: { battery: 1, cloth: 2, ammo_9mm: 8 }, time: 1.4 },
    { id: 'c_apartment2', x: 101, label: 'Enter the apartment', enter: 'apartment', loot: { medkit: 1, food: 1 }, time: 1.6 },
  ],
  pickups: [
    { id: 'p1', x: 11, item: 'bottle', qty: 1 }, { id: 'p2', x: 22, item: 'ammo_9mm', qty: 6 }, { id: 'p3', x: 35, item: 'cloth', qty: 2 },
    { id: 'p4', x: 60, item: 'water', qty: 1 }, { id: 'p5', x: 79, item: 'ammo_shells', qty: 4 }, { id: 'p6', x: 95, item: 'bandage', qty: 1 },
    { id: 'p7', x: 110, item: 'ammo_rifle', qty: 10 }, { id: 'p8', x: 117, item: 'bottle', qty: 1 },
  ],
  infected: [
    // teach: one lone shambler, facing away → crouch + melee takedown
    { id: 'z1', x: 14, type: 'common', state: 'idle', facing: 1 },
    // pharmacy: dormant pair inside the glow → lure with a bottle or sneak in the dark
    { id: 'z2', x: 29.5, type: 'common', state: 'dormant' }, { id: 'z3', x: 31.5, type: 'common', state: 'dormant', facing: -1 },
    { id: 'z4', x: 37, type: 'crawler', state: 'wander' },
    { id: 'z19', x: 21.5, type: 'crawler', state: 'idle', facing: -1 },   // under the hatchback
    // overpass gauntlet: crowd + runners; gunfire here pulls everyone
    { id: 'z5', x: 66, type: 'common', state: 'wander' }, { id: 'z6', x: 69, type: 'common', state: 'idle', facing: -1 }, { id: 'z7', x: 71, type: 'runner', state: 'idle', facing: -1 },
    { id: 'z8', x: 75, type: 'common', state: 'dormant' }, { id: 'z20', x: 79.5, type: 'screamer', state: 'idle', facing: -1 }, { id: 'z9', x: 78, type: 'common', state: 'wander' }, { id: 'z10', x: 81, type: 'common', state: 'idle' },
    { id: 'z11', x: 84, type: 'hound', state: 'wander' }, { id: 'z12', x: 87, type: 'common', state: 'dormant' }, { id: 'z13', x: 93, type: 'common', state: 'wander' },
    { id: 'z14', x: 106, type: 'common', state: 'idle', facing: -1 }, { id: 'z15', x: 110, type: 'hound', state: 'dormant' }, { id: 'z21', x: 103, type: 'crawler', state: 'idle' },
    // climax at the relay
    { id: 'z16', x: 127, type: 'brute', state: 'idle', facing: -1 }, { id: 'z17', x: 124, type: 'common', state: 'idle' }, { id: 'z18', x: 131, type: 'common', state: 'wander' },
  ],
  workbench: { x: 54 },
  checkpoints: [24, 57, 96, 116],
  beats: [
    { id: 'alley', x0: -16, x1: 10, type: 'teach', intensity: 0.1, ink: 'intro', title: 'Behind the store' },
    { id: 'street', x0: 10, x1: 24, type: 'teach', intensity: 0.3, ink: 'first_infected' },
    { id: 'pharmacy', x0: 24, x1: 40, type: 'tension', intensity: 0.45, ink: 'pharmacy' },
    { id: 'garage', x0: 40, x1: 62, type: 'rest', intensity: 0.15, ink: 'garage', cam: { zoom: 0.9 } },
    { id: 'overpass', x0: 62, x1: 96, type: 'combat', intensity: 0.75, ink: 'overpass', title: 'Under the overpass', cam: { zoom: 1.1, lift: -0.45 } },
    { id: 'breather', x0: 96, x1: 116, type: 'rest', intensity: 0.2, ink: 'breather' },
    { id: 'relay', x0: 116, x1: 150, type: 'climax', intensity: 1, ink: 'relay_approach', title: WORLD_NAMES.relayName, cam: { zoom: 1.2, lift: 0.7 } },
  ],
  objectives: [
    { id: 'o_supplies', text: 'Scavenge supplies on Market Street' },
    { id: 'o_fuse', text: 'Craft a relay fuse at the garage workbench' },
    { id: 'o_relay', text: `Restore ${WORLD_NAMES.relayName}` },
  ],
  goal: { x: 122.2, needs: 'radio_part', objective: 'o_relay' },
};
