import { WORLD_NAMES } from '../../config/game';
import type { LevelDef } from './types';

/**
 * Chapter 2 — The Long Road (level-design workflow). Dawn fog on the highway out of town.
 * The fog is the mechanic: sight ranges are short for everyone (mood is dim → the light rule keeps
 * the squad hidden), so the infected are found by sound and by Iris's band — and a run or a shot
 * carries a long way. Critical path: diner → gas station (fuel) → motel (optional, research note) →
 * the pile-up (crowd + screamer) → quarantine checkpoint: kill the Warden, fuel the gate motor.
 * Pacing: 0.15 teach → 0.4 → 0.3 → 0.5 → 0.8 → 0.25 rest → 1.0 boss.
 */
export const CHAPTER2: LevelDef = {
  id: 'ch2', name: WORLD_NAMES.chapter2, number: 'CHAPTER TWO', location: WORLD_NAMES.chapter2Location,
  x0: -12, x1: 196, spawnX: -6, seed: 2044,
  kind: 'chapter', mood: 'fogDawn', set: 'road', theme: 'road', outro: 'gate',
  buildings: [
    { x: 14, w: 13, floors: 0, kind: 'store', wall: 'plaster', tint: '#8a6a5a', sign: WORLD_NAMES.dinerName, signBg: '#7a2a22', awning: ['#8a2a24', '#d8cdb0'] },
    { x: 52, w: 12, floors: 0, kind: 'garage', wall: 'concrete', tint: '#6a7068', sign: WORLD_NAMES.gasName },
    { x: 86, w: 12, floors: 1, kind: 'apartment', wall: 'plaster', tint: '#7d6a5a', sign: WORLD_NAMES.motelName, lit: 0.25 },
    { x: 98.5, w: 11, floors: 1, kind: 'apartment', wall: 'plaster', tint: '#75645a', lit: 0.1 },
    { x: 168, w: 9, floors: 0, kind: 'garage', wall: 'concrete', tint: '#5a6660', sign: 'CHECKPOINT 9' },
  ],
  billboards: [{ x: 38, text: WORLD_NAMES.billboard2 }, { x: 128, text: WORLD_NAMES.billboard }],
  lamps: [{ x: 10, lit: false }, { x: 30, lit: true, flicker: true }, { x: 50, lit: true }, { x: 68, lit: false }, { x: 84, lit: true }, { x: 112, lit: false }, { x: 140, lit: true, flicker: true }, { x: 164, lit: true }, { x: 180, lit: true }],
  poles: [-10, 12, 34, 56, 78, 100, 122, 144, 166, 188],
  fences: [[160, 168], [177, 200]],
  trees: [],
  vehicles: [{ x: 2, kind: 'sedan', flip: true }, { x: 34, kind: 'hatch', z: -7 }, { x: 46, kind: 'truck', z: -8 }, { x: 66, kind: 'van' }, { x: 116, kind: 'sedan' }, { x: 120.5, kind: 'hatch', flip: true }, { x: 126, kind: 'bus' },
    { x: 132, kind: 'van', flip: true, z: -7 }, { x: 136, kind: 'sedan', flip: true }, { x: 141, kind: 'truck', z: -7.5 }, { x: 150, kind: 'hatch' }, { x: 186, kind: 'van', z: -7.5 }],
  props: [
    { x: 8, kind: 'barrier' }, { x: 20, kind: 'trashbag', z: -3.7 }, { x: 31, kind: 'cone', z: 1.0 }, { x: 44, kind: 'barrel' }, { x: 58, kind: 'tires', z: -3.6 }, { x: 62, kind: 'barrel' }, { x: 72, kind: 'crate' },
    { x: 81, kind: 'cone', z: 0.9 }, { x: 96, kind: 'dumpster', z: -3.4 }, { x: 110, kind: 'barrier' }, { x: 123, kind: 'crate' }, { x: 146, kind: 'barrier' }, { x: 156, kind: 'barrier' }, { x: 158, kind: 'cone', z: 1.0 },
    { x: 163, kind: 'barrel' }, { x: 174, kind: 'crate' }, { x: 174.8, kind: 'crate' }, { x: 183, kind: 'barrier' },
  ],
  caches: [
    { id: 'c2_sedan', x: 3.6, label: 'Search the sedan', style: 'car', loot: { ammo_9mm: 10, cloth: 2 }, time: 1.3, noise: 3 },
    { id: 'c2_diner', x: 20, label: `Enter ${WORLD_NAMES.dinerName}`, room: 'r_diner', time: 0 },
    { id: 'c2_gas', x: 57, label: 'Enter the gas station', room: 'r_gas', time: 0 },
    { id: 'c2_van', x: 67.6, label: 'Search the van', style: 'car', loot: { scrap: 3, tape: 1 }, time: 1.3, noise: 3 },
    { id: 'c2_motel', x: 91, label: 'Enter the motel — room 6', room: 'r_motel', time: 0 },
    { id: 'c2_bus', x: 127.5, label: 'Search the bus hold', style: 'box', loot: { ammo_rifle: 18, bandage: 1 }, time: 1.4, noise: 3 },
    { id: 'c2_truck', x: 151.5, label: 'Search the hatchback', style: 'car', loot: { ammo_shells: 6, alcohol: 1 }, time: 1.3, noise: 3 },
    { id: 'c2_booth', x: 172, label: 'Enter the checkpoint booth', room: 'r_booth', time: 0 },
  ],
  rooms: [
    { id: 'r_diner', kind: 'diner', w: 16, title: WORLD_NAMES.dinerName, spots: [
      { dx: 5.5, label: 'Search behind the counter', loot: { food: 2, water: 1 } }, { dx: 9.4, label: 'Check the fridge', loot: { water: 1, alcohol: 1 } },
      { dx: 13.4, label: 'Search the booth', loot: { scrap: 2, bottle: 1 } }, { dx: 10.6, label: 'Read the napkin', note: 'n_diner' }],
      infected: [{ id: 'd1', dx: 7.5, type: 'common', state: 'idle', facing: 1 }, { id: 'd2', dx: 12.6, type: 'common', state: 'dormant' }] },
    { id: 'r_gas', kind: 'gas', w: 15, title: 'GAS STATION', spots: [
      { dx: 3.4, label: 'Search the shelves', loot: { food: 1, tape: 1 }, style: 'shelf' }, { dx: 7.5, label: 'Take the full jerrycan', loot: { fuel: 1 } },
      { dx: 12.4, label: 'Search the till', loot: { battery: 1, scrap: 2, ammo_9mm: 8 } }],
      infected: [{ id: 'g1', dx: 6, type: 'crawler', state: 'idle', facing: -1 }, { id: 'g2', dx: 10.5, type: 'runner', state: 'dormant' }, { id: 'g3', dx: 13.2, type: 'common', state: 'idle', facing: -1 }] },
    { id: 'r_motel', kind: 'motel', w: 15, title: 'MOTEL — ROOM 6', spots: [
      { dx: 4.2, label: 'Search the couch', loot: { cloth: 2, bandage: 1 } }, { dx: 11.6, label: 'Search under the bed', loot: { medkit: 1, scrap: 2 } },
      { dx: 6.6, label: 'Read the motel register', note: 'n_motel' }, { dx: 9, label: 'Look at the drawing', note: 'n_child' }],
      infected: [{ id: 'm1', dx: 8.5, type: 'hound', state: 'dormant' }, { id: 'm2', dx: 13, type: 'common', state: 'wander' }] },
    { id: 'r_booth', kind: 'booth', w: 11, title: 'CHECKPOINT 9', spots: [
      { dx: 2.9, label: 'Search the lockers', loot: { ammo_rifle: 20, ammo_shells: 8 } }, { dx: 8, label: 'Open the crates', loot: { medkit: 1, scrap: 3 } }, { dx: 6.2, label: 'Read the trooper\'s notebook', note: 'n_trooper' }] },
  ],
  pickups: [{ id: 'q1', x: 12, item: 'bottle', qty: 1 }, { id: 'q2', x: 41, item: 'cloth', qty: 2 }, { id: 'q3', x: 75, item: 'bottle', qty: 1 }, { id: 'q4', x: 108, item: 'ammo_9mm', qty: 8 }, { id: 'q5', x: 145, item: 'bandage', qty: 1 }, { id: 'q6', x: 160, item: 'bottle', qty: 1 }],
  infected: [
    { id: 'y1', x: 16, type: 'common', state: 'idle', facing: 1 }, { id: 'y2', x: 27, type: 'common', state: 'wander' },
    { id: 'y3', x: 40, type: 'hound', state: 'wander' }, { id: 'y4', x: 47, type: 'common', state: 'dormant' }, { id: 'y5', x: 63, type: 'common', state: 'idle', facing: -1 },
    { id: 'y6', x: 74, type: 'crawler', state: 'idle', facing: -1 }, { id: 'y7', x: 80, type: 'runner', state: 'idle', facing: 1 }, { id: 'y8', x: 97, type: 'common', state: 'wander' }, { id: 'y9', x: 105, type: 'common', state: 'dormant' },
    // the pile-up: a crowd standing between the cars, a screamer above them
    { id: 'y10', x: 114, type: 'common', state: 'idle', facing: -1 }, { id: 'y11', x: 118, type: 'common', state: 'idle' }, { id: 'y12', x: 122, type: 'runner', state: 'idle', facing: -1 }, { id: 'y13', x: 125, type: 'screamer', state: 'idle', facing: -1 },
    { id: 'y14', x: 129, type: 'common', state: 'dormant' }, { id: 'y15', x: 133, type: 'common', state: 'wander' }, { id: 'y16', x: 137, type: 'hound', state: 'idle', facing: -1 }, { id: 'y17', x: 141, type: 'common', state: 'idle' }, { id: 'y18', x: 147, type: 'crawler', state: 'wander' },
    // the checkpoint
    { id: 'warden', x: 181, type: 'warden', state: 'idle', facing: -1 }, { id: 'y19', x: 176, type: 'common', state: 'idle', facing: -1 }, { id: 'y20', x: 187, type: 'common', state: 'wander' },
  ],
  checkpoints: [32, 70, 108, 156],
  beats: [
    { id: 'road', x0: -12, x1: 12, type: 'teach', intensity: 0.15, ink: 'road_start' },
    { id: 'diner', x0: 12, x1: 44, type: 'tension', intensity: 0.4, ink: 'bark_diner' },
    { id: 'gas', x0: 44, x1: 78, type: 'explore', intensity: 0.3, ink: 'bark_gas', cam: { zoom: 1.08 } },
    { id: 'motel', x0: 78, x1: 110, type: 'tension', intensity: 0.5, ink: 'bark_motel' },
    { id: 'pileup', x0: 110, x1: 154, type: 'combat', intensity: 0.8, ink: 'pileup', title: 'The pile-up', cam: { zoom: 1.15, lift: 0.3 } },
    { id: 'rest', x0: 154, x1: 166, type: 'rest', intensity: 0.25, ink: 'bark_checkpoint' },
    { id: 'gate', x0: 166, x1: 196, type: 'climax', intensity: 1, title: 'Checkpoint 9', cam: { zoom: 1.2, lift: 0.5 } },
  ],
  objectives: [{ id: 'o_fuel', text: 'Find fuel for the checkpoint gate' }, { id: 'o_warden', text: 'Get past whatever guards the line' }, { id: 'o_gate', text: 'Open the quarantine gate' }],
  goal: { x: 191, label: 'Fuel the gate motor', time: 3, needs: 'fuel', lockedInk: 'gate_locked', needsDead: 'warden', guardedInk: 'gate_guarded', doneInk: 'gate_open', objective: 'o_gate' },
};
