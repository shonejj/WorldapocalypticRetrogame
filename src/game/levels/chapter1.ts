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
  id: 'ch1', name: WORLD_NAMES.chapter1, number: 'CHAPTER ONE', location: WORLD_NAMES.chapter1Location,
  x0: -16, x1: 150, spawnX: -9, seed: 1977,
  kind: 'chapter', mood: 'rainNight', set: 'city', theme: 'street', intro: 'prologue', outro: 'relay',
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
  relayX: 121, overpass: [64, 96], billboards: [{ x: 90, text: WORLD_NAMES.billboard }],
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
    { id: 'c_house_apt', x: 62.5, label: 'Go into the apartment house', house: 'h_apt', time: 0 },
    { id: 'c_veggies', x: -12.5, label: `Enter ${WORLD_NAMES.storeName}`, room: 'r_store', time: 0 },
    { id: 'c_sedan', x: 7.6, label: 'Search the sedan', style: 'car', loot: { ammo_rifle: 12, tape: 1 }, time: 1.3, noise: 3 },
    { id: 'c_apartment', x: 18, label: 'Enter the apartment', room: 'r_apt', time: 0 },
    { id: 'c_pharmacy', x: 28.5, label: `Enter the ${WORLD_NAMES.pharmacyName.toLowerCase()}`, room: 'r_pharm', time: 0 },
    { id: 'c_van', x: 42, label: 'Search the van', style: 'car', loot: { scrap: 2, bottle: 1 }, time: 1.3, noise: 3 },
    { id: 'c_garage', x: 50, label: `Enter the ${WORLD_NAMES.garageName.toLowerCase()}`, room: 'r_garage', time: 0 },
    { id: 'c_bus', x: 74, label: 'Board the bus', room: 'r_bus', time: 0 },
    { id: 'c_billboard', x: 91, label: 'Search the maintenance box', style: 'box', loot: { battery: 1, cloth: 2, ammo_9mm: 8 }, time: 1.4 },
    { id: 'c_apartment2', x: 101, label: 'Enter the apartment', room: 'r_apt2', time: 0 },
  ],
  rooms: [
    { id: 'r_store', kind: 'store', w: 14, title: WORLD_NAMES.storeName, spots: [
      { dx: 4.5, label: 'Search the shelves', loot: { food: 2, cloth: 1 }, style: 'shelf' }, { dx: 8.6, label: 'Check the fridges', loot: { water: 2 } },
      { dx: 11.4, label: 'Search behind the counter', loot: { cloth: 1, scrap: 1 } }, { dx: 12.9, label: 'Read the shift log', note: 'n_shift' }] },
    { id: 'r_apt', kind: 'apartment', w: 15, spots: [
      { dx: 4.2, label: 'Search the couch', loot: { ammo_9mm: 10 } }, { dx: 11.6, label: 'Search the bedroom', loot: { alcohol: 1, cloth: 1 } }, { dx: 14.1, label: 'Read the note on the fridge', note: 'n_fridge' }],
      infected: [{ id: 'ra1', dx: 9.5, type: 'common', state: 'dormant' }] },
    { id: 'r_pharm', kind: 'pharmacy', w: 16, title: WORLD_NAMES.pharmacyName, spots: [
      { dx: 3.2, label: 'Search the shelves', loot: { bandage: 2 }, style: 'shelf' }, { dx: 6.0, label: 'Search the shelves', loot: { alcohol: 1 }, style: 'shelf' },
      { dx: 11.8, label: 'Search the counter drawers', loot: { medkit: 1, battery: 1 } }, { dx: 14.3, label: 'Read the prescription pad', note: 'n_rx' }],
      infected: [{ id: 'rp1', dx: 8.2, type: 'common', state: 'dormant' }, { id: 'rp2', dx: 12.6, type: 'common', state: 'idle', facing: 1 }] },
    { id: 'r_garage', kind: 'garage', w: 16, title: WORLD_NAMES.garageName, spots: [
      { dx: 5.2, label: 'Search the car on the lift', loot: { scrap: 2 }, style: 'car' }, { dx: 12.8, label: 'Search the tool chest', loot: { scrap: 2, tape: 1, ammo_shells: 6 } }, { dx: 10.4, label: 'Read the work order', note: 'n_order' }],
      infected: [{ id: 'rg1', dx: 8.8, type: 'crawler', state: 'idle', facing: -1 }] },
    { id: 'r_bus', kind: 'bus', w: 12, spots: [
      { dx: 3.4, label: 'Search the seats', loot: { ammo_rifle: 15 } }, { dx: 7.5, label: 'Search the luggage rack', loot: { water: 1, food: 1 } }, { dx: 10.6, label: 'Pick up the ticket', note: 'n_ticket' }],
      infected: [{ id: 'rb1', dx: 9.2, type: 'runner', state: 'dormant' }] },
    { id: 'r_apt2', kind: 'apartment', w: 15, spots: [
      { dx: 6.6, label: 'Search the table', loot: { food: 1, scrap: 2 } }, { dx: 11.6, label: 'Search the bedroom', loot: { medkit: 1, scrap: 1 } }],
      infected: [{ id: 'rq1', dx: 6, type: 'common', state: 'wander' }, { id: 'rq2', dx: 12.5, type: 'screamer', state: 'idle', facing: -1 }] },
  ],
  pickups: [
    { id: 'p1', x: 11, item: 'bottle', qty: 1 }, { id: 'p2', x: 22, item: 'ammo_9mm', qty: 6 }, { id: 'p3', x: 35, item: 'cloth', qty: 2 },
    { id: 'p4', x: 60, item: 'water', qty: 1 }, { id: 'p5', x: 79, item: 'ammo_shells', qty: 4 }, { id: 'p6', x: 95, item: 'bandage', qty: 1 },
    { id: 'p7', x: 110, item: 'ammo_rifle', qty: 10 }, { id: 'p8', x: 117, item: 'bottle', qty: 1 },
  ],
  infected: [
    // teach: one lone shambler, facing away → crouch + melee takedown
    { id: 'z1', x: 14, type: 'common', state: 'idle', facing: 1 },
    { id: 'z2', x: 32.5, type: 'common', state: 'dormant' },
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
    { id: 'alley', x0: -16, x1: 10, type: 'teach', intensity: 0.1, ink: 'intro' },
    { id: 'street', x0: 10, x1: 24, type: 'teach', intensity: 0.3, ink: 'bark_first_infected' },
    { id: 'pharmacy', x0: 24, x1: 40, type: 'tension', intensity: 0.45, ink: 'bark_pharmacy' },
    { id: 'garage', x0: 40, x1: 62, type: 'rest', intensity: 0.15, ink: 'bark_garage', cam: { zoom: 0.9 } },
    { id: 'overpass', x0: 62, x1: 96, type: 'combat', intensity: 0.75, ink: 'overpass', title: 'Under the overpass', cam: { zoom: 1.1, lift: -0.45 } },
    { id: 'breather', x0: 96, x1: 116, type: 'rest', intensity: 0.2, ink: 'bark_breather', cam: { mode: 'iso', zoom: 0.95 } },
    { id: 'relay', x0: 116, x1: 150, type: 'climax', intensity: 1, ink: 'bark_relay_approach', title: WORLD_NAMES.relayName, cam: { zoom: 1.2, lift: 0.7 } },
  ],
  objectives: [
    { id: 'o_supplies', text: 'Scavenge supplies on Market Street' },
    { id: 'o_fuse', text: 'Craft a relay fuse at the garage workbench' },
    { id: 'o_relay', text: `Restore ${WORLD_NAMES.relayName}` },
  ],
  goal: { x: 122.2, label: 'Restore the relay', time: 3, needs: 'radio_part', lockedInk: 'relay_locked', doneInk: 'relay_restore', objective: 'o_relay' },
};
