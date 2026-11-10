import { WORLD_NAMES } from '../../config/game';
import type { LevelDef, RoomDef } from './types';

/**
 * Safehouses (the cozy half of the game): one candle-lit room between chapters. No infected, no
 * weapons — walk up to each survivor to talk (backstory, trust), use the table as a workbench
 * (crafting + upgrades bought with scrap), and sleep to move on. Same engine as a chapter: the level
 * simply starts inside its room.
 */
const room = (id: string, title: string, n: 1 | 2): RoomDef => ({
  id, kind: 'safehouse', w: 17, title, spots: [], ink: undefined, workbench: 4.6, rest: { dx: 12.6, label: 'Sleep until first light' },
  talks: [{ dx: 7.2, who: 'maya', knot: `camp${n}_maya`, label: 'Talk to Maya' }, { dx: 10.2, who: 'miller', knot: `camp${n}_miller`, label: 'Talk to Miller' }, { dx: 15.2, who: 'iris', knot: `camp${n}_iris`, label: 'Talk to Iris' }],
});
const camp = (id: string, name: string, n: 1 | 2, outro: string): LevelDef => ({
  id, name, number: 'SAFEHOUSE', location: name.toUpperCase(), x0: 0, x1: 24, spawnX: 4, seed: 300 + n,
  kind: 'camp', mood: 'camp', set: 'none', theme: 'camp', outro, startRoom: `${id}_room`,
  buildings: [], lamps: [], poles: [], fences: [], trees: [], vehicles: [], props: [], caches: [], pickups: [], infected: [], checkpoints: [],
  rooms: [room(`${id}_room`, name, n)],
  beats: [], objectives: [{ id: 'o_talk', text: 'Talk to the others' }, { id: 'o_bench', text: 'Spend scrap at the table (upgrades)' }, { id: 'o_rest', text: 'Sleep when you are ready' }],
});
export const CAMP1 = camp('camp1', WORLD_NAMES.camp1, 1, 'road');
export const CAMP2 = camp('camp2', WORLD_NAMES.camp2, 2, 'facility');
/** conversation played when the squad arrives */
export const CAMP_ARRIVE: Record<string, string> = { camp1: 'camp1_arrive', camp2: 'camp2_arrive' };
