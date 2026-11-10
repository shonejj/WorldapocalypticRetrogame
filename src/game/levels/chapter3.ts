import { WORLD_NAMES } from '../../config/game';
import type { LevelDef } from './types';

/**
 * Chapter 3 — Genova Labs. Dusk outside (a short, tense approach through the staff car park), then
 * the lab itself: one long cut-away hall on emergency power. The hall is where the story is — three
 * journals (one is the last research note), the child's world behind the last door, and the Host
 * standing guard in front of it. Boss: three phases (charges; calls the hall at ⅔ and ⅓).
 */
export const CHAPTER3: LevelDef = {
  id: 'ch3', name: WORLD_NAMES.chapter3, number: 'CHAPTER THREE', location: WORLD_NAMES.chapter3Location,
  x0: -10, x1: 96, spawnX: -5, seed: 3099,
  kind: 'chapter', mood: 'dusk', set: 'facility', theme: 'lab', outro: 'ending',
  buildings: [
    { x: 26, w: 8, floors: 0, kind: 'garage', wall: 'concrete', tint: '#6a6e72', sign: 'SECURITY' },
    { x: 66, w: 14, floors: 3, kind: 'apartment', wall: 'concrete', tint: '#7a8288', sign: WORLD_NAMES.labName, lit: 0.12 },
    { x: 80.5, w: 15, floors: 4, kind: 'apartment', wall: 'concrete', tint: '#6e767c', lit: 0.06 },
  ],
  billboards: [{ x: 10, text: WORLD_NAMES.billboard }],
  lamps: [{ x: 4, lit: true, flicker: true }, { x: 22, lit: false }, { x: 40, lit: true }, { x: 56, lit: true, flicker: true }, { x: 70, lit: true }, { x: 90, lit: false }],
  poles: [-8, 14, 36, 58],
  fences: [[-12, 26], [34, 66]],
  trees: [],
  vehicles: [{ x: 14, kind: 'van', z: -7.5 }, { x: 38, kind: 'sedan' }, { x: 43, kind: 'hatch', flip: true }, { x: 48, kind: 'sedan', z: -7.2 }, { x: 53, kind: 'van', flip: true }, { x: 59, kind: 'hatch', z: -7.4 }, { x: 62, kind: 'truck', flip: true }],
  props: [{ x: 6, kind: 'barrier' }, { x: 18, kind: 'barrier' }, { x: 24, kind: 'cone', z: 1.0 }, { x: 35, kind: 'barrel' }, { x: 46, kind: 'crate' }, { x: 57, kind: 'cone', z: 0.9 }, { x: 64, kind: 'dumpster', z: -3.4 }, { x: 78, kind: 'crate' }, { x: 88, kind: 'barrier' }],
  caches: [
    { id: 'c3_post', x: 30, label: 'Search the security post', style: 'box', loot: { ammo_rifle: 20, ammo_9mm: 12, bandage: 1 }, time: 1.4 },
    { id: 'c3_car', x: 39.6, label: 'Search the sedan', style: 'car', loot: { scrap: 3, bottle: 1 }, time: 1.3, noise: 3 },
    { id: 'c3_van', x: 54.6, label: 'Search the van', style: 'car', loot: { medkit: 1, ammo_shells: 8 }, time: 1.3, noise: 3 },
    { id: 'c3_lab', x: 73, label: 'Enter Genova Labs', room: 'r_lab', time: 0 },
  ],
  rooms: [
    { id: 'r_lab', kind: 'lab', w: 78, title: 'GENOVA LABS — B WING', ink: 'lab_enter', spots: [
      { dx: 5.5, label: 'Search the bench', loot: { alcohol: 1, bandage: 2 } }, { dx: 9.4, label: 'Read the lab journal', note: 'n_hale1' },
      { dx: 15, label: 'Open the lockers', loot: { ammo_rifle: 20, ammo_9mm: 12 } }, { dx: 24.5, label: 'Search the bench', loot: { medkit: 1, scrap: 3 } },
      { dx: 34.4, label: 'Read the later journal', note: 'n_hale2' }, { dx: 43.5, label: 'Open the lockers', loot: { ammo_shells: 10, medkit: 1 } },
      { dx: 52.5, label: 'Read the transcript', note: 'n_hale3' }, { dx: 55, label: 'Search the bench', loot: { bandage: 2, ammo_rifle: 20 } }],
      infected: [
        { id: 'l1', dx: 12, type: 'common', state: 'idle', facing: -1 }, { id: 'l2', dx: 18, type: 'crawler', state: 'idle', facing: -1 }, { id: 'l3', dx: 22, type: 'common', state: 'dormant' },
        { id: 'l4', dx: 29, type: 'runner', state: 'idle', facing: -1 }, { id: 'l5', dx: 32, type: 'common', state: 'wander' }, { id: 'l6', dx: 39, type: 'screamer', state: 'idle', facing: -1 },
        { id: 'l7', dx: 41, type: 'common', state: 'dormant' }, { id: 'l8', dx: 47, type: 'hound', state: 'idle', facing: -1 }, { id: 'l9', dx: 50, type: 'common', state: 'idle', facing: -1 },
        { id: 'host', dx: 70, type: 'host', state: 'idle', facing: -1 }] },
  ],
  pickups: [{ id: 'w1', x: 8, item: 'bottle', qty: 1 }, { id: 'w2', x: 33, item: 'cloth', qty: 2 }, { id: 'w3', x: 50, item: 'ammo_9mm', qty: 8 }, { id: 'w4', x: 68, item: 'bandage', qty: 1 }],
  infected: [
    { id: 'v1', x: 12, type: 'common', state: 'idle', facing: 1 }, { id: 'v2', x: 20, type: 'hound', state: 'wander' }, { id: 'v3', x: 33, type: 'common', state: 'idle', facing: -1 },
    { id: 'v4', x: 41, type: 'common', state: 'dormant' }, { id: 'v5', x: 45, type: 'runner', state: 'idle', facing: -1 }, { id: 'v6', x: 50, type: 'common', state: 'wander' },
    { id: 'v7', x: 56, type: 'screamer', state: 'idle', facing: -1 }, { id: 'v8', x: 60, type: 'common', state: 'idle', facing: -1 }, { id: 'v9', x: 65, type: 'brute', state: 'idle', facing: -1 },
  ],
  checkpoints: [24, 62],
  beats: [
    { id: 'fence', x0: -10, x1: 24, type: 'teach', intensity: 0.3, ink: 'labs_start' },
    { id: 'lot', x0: 24, x1: 62, type: 'combat', intensity: 0.7, ink: 'bark_lot', title: 'Staff car park', cam: { zoom: 1.12, lift: 0.3 } },
    { id: 'door', x0: 62, x1: 96, type: 'tension', intensity: 0.6, cam: { zoom: 1.15, lift: 0.9 } },
  ],
  objectives: [{ id: 'o_in', text: 'Get inside Genova Labs' }, { id: 'o_read', text: 'Find out what happened here' }, { id: 'o_door', text: 'Reach the broadcast room' }],
  goal: { x: 76.8, room: 'r_lab', label: 'Open the broadcast room', time: 2.5, needsDead: 'host', guardedInk: 'door_guarded', doneInk: 'finale', objective: 'o_door' },
};
