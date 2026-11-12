import type { ItemId, NoteId, InfectedType } from '../game/data';

/**
 * Houses: the fully 3D interiors (third-person, over the shoulder). The street stays a 2.5D
 * side-scroller; stepping through one of these doors swaps to a walkable floor plan with its own
 * camera — the "safe-ish" indoor half of the game, still with something breathing in the dark.
 *
 * Plan legend (one character = one 1.6 m cell; row 0 is the far wall, the last row faces the camera)
 *   #  wall            w  wall with a window      .  floor          D  open doorway (frame)
 *   P  front door: where you come in and leave     L  locked door (lockpick)
 *   c  candle on the floor (warm light)            l  ceiling lamp (cold, flickers)
 *   T  table  S  sofa  B  bed  K  counter  H  shelf   (solid furniture)
 *   a…h  a search spot from `spots`                Z/R/C  common / runner / crawler infected
 *   space  outside (solid, not drawn)
 */
export type MiniGame = 'lock' | 'fuse' | 'radio';
export interface HouseSpot { label: string; loot?: Partial<Record<ItemId, number>>; note?: NoteId; game?: MiniGame; line?: string }
export interface HouseDef {
  id: string; title: string; plan: string[];
  wall: string; floor: string;
  spots: Record<string, HouseSpot>;
  /** shown once as a whisper when you walk in */
  enter?: string;
}
export const HOUSE_INFECTED: Record<string, InfectedType> = { Z: 'common', R: 'runner', C: 'crawler' };

export const HOUSES: Record<string, HouseDef> = {
  h_apt: {
    id: 'h_apt', title: 'Apartment 2B', wall: '#7a6a58', floor: '#5a4030',
    enter: 'Someone lived here a long time after it started.',
    plan: [
      '##w####w####',
      '#Kb.#..T..l#',
      '#...D.....c#',
      '#.Z.#S..Z..#',
      '##D###L#####',
      '#..c.#...dH#',
      '#.a..#.e.R.#',
      '###P########',
    ],
    spots: {
      a: { label: 'Search the coat rack', loot: { bandage: 1, cloth: 1 } },
      b: { label: 'Search the kitchen', loot: { food: 2, water: 1 } },
      d: { label: 'Tune the shortwave', game: 'radio', note: 'n_radio', line: 'A voice under the static, counting numbers. Then a name: Genova.' },
      e: { label: 'Search the bedside table', loot: { ammo_9mm: 12, scrap: 1 } },
    },
  },
  h_farm: {
    id: 'h_farm', title: 'Farmhouse', wall: '#6e6658', floor: '#4a3a2c',
    enter: 'The door was nailed shut from the inside.',
    plan: [
      '#w####w#####w#',
      '#S..T.#..K.b.#',
      '#...c.D..l...#',
      '#..Z..#R...Z.#',
      '#D#####D######',
      '#...l....L..H#',
      '#.a.C..f.#.e.#',
      '#####P########',
    ],
    spots: {
      a: { label: 'Search the hall closet', loot: { ammo_shells: 6, cloth: 2 } },
      b: { label: 'Search the pantry', loot: { food: 2, water: 2, alcohol: 1 } },
      e: { label: 'Open the gun safe', loot: { ammo_rifle: 24, medkit: 1 }, game: 'lock' },
      f: { label: 'Reset the breaker box', game: 'fuse', loot: { battery: 1, tape: 1 }, line: 'The lights come up. Somewhere upstairs, something stops moving.' },
    },
  },
  h_dorm: {
    id: 'h_dorm', title: 'Staff Quarters', wall: '#68707a', floor: '#3c4044',
    enter: 'Bunks for forty. Name tags still on the doors.',
    plan: [
      '##############',
      '#B.a.#B..#B.e#',
      '#..Z.D...D.R.#',
      '###D#######L##',
      '#K..l...C...H#',
      '#.f..T....Z..#',
      '#..c......b..#',
      '######P#######',
    ],
    spots: {
      a: { label: 'Search the footlocker', loot: { ammo_9mm: 14, bandage: 1 } },
      b: { label: 'Search the supply cage', loot: { medkit: 1, scrap: 2 }, game: 'lock' },
      e: { label: "Read Dr. Hale's diary", note: 'n_bunk' },
      f: { label: 'Restore the power', game: 'fuse', loot: { battery: 1 }, line: 'Relays click. The doors at the end of the hall unlock.' },
    },
  },
};
