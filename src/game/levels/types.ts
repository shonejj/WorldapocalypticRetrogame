import type { BuildingSpec } from '../../art/buildings';
import type { PropKind } from '../../art/props';
import type { VehicleKind } from '../../art/vehicles';
import type { InfectedType, ItemId, NoteId } from '../data';
import type { MoodId } from '../../render/mood';
import type { ThemeId } from '../../core/audio';

export type Loot = Partial<Record<ItemId, number>>;
/** A pacing beat (level-design pattern 2): intensity drives adaptive music and spawns. */
export interface Beat { id: string; x0: number; x1: number; type: 'teach' | 'explore' | 'tension' | 'combat' | 'rest' | 'climax'; intensity: number; ink?: string; title?: string;
  /** camera moment for this stretch: zoom (distance ×), lift (m, + = higher) */
  cam?: { zoom?: number; lift?: number; /** isometric 3/4 view, or a flat long-lens silhouette section */ mode?: 'iso' | 'flat' } }

export interface InfectedSpawn { id: string; x: number; type: InfectedType; state: 'idle' | 'dormant' | 'wander'; facing?: 1 | -1 }

/**
 * A room: a side-on cut-away interior that lives in the same simulation as the street (its own
 * stretch of the lane far to the right), so the whole squad walks in and the infected inside obey
 * the same stealth and combat rules. `dx` values are metres from the room's left wall.
 */
export type RoomKind = 'store' | 'pharmacy' | 'apartment' | 'garage' | 'bus' | 'diner' | 'motel' | 'gas' | 'booth' | 'lab' | 'safehouse';
export interface RoomSpot { dx: number; label: string; loot?: Loot; note?: NoteId; style?: 'car' | 'box' | 'shelf' }
export interface RoomTalk { dx: number; who: 'reed' | 'maya' | 'miller' | 'iris'; knot: string; label: string }
export interface RoomDef {
  id: string; kind: RoomKind; w: number; mood?: MoodId; title?: string;
  spots: RoomSpot[]; infected?: (Omit<InfectedSpawn, 'x'> & { dx: number })[];
  /** safehouse only */
  talks?: RoomTalk[]; workbench?: number; rest?: { dx: number; label: string };
  /** conversation played the first time the squad walks in */
  ink?: string;
}

export type SetKind = 'city' | 'road' | 'facility' | 'none';
export interface LevelDef {
  id: string; name: string; number: string; location: string; x0: number; x1: number; spawnX: number; seed: number;
  kind: 'chapter' | 'camp'; mood: MoodId; set: SetKind; theme: ThemeId;
  /** storyboard played before the level starts / after it is completed */
  intro?: string; outro?: string;
  /** the level begins inside this room (safehouses) */
  startRoom?: string;
  buildings: Omit<BuildingSpec, 'seed'>[];
  relayX?: number; overpass?: [number, number]; billboards?: { x: number; text: string }[];
  lamps: { x: number; lit: boolean; flicker?: boolean }[]; poles: number[]; fences: [number, number][];
  trees: number[]; vehicles: { x: number; kind: VehicleKind; flip?: boolean; z?: number }[];
  props: { x: number; kind: PropKind; z?: number }[];
  /** room: a door into a RoomDef; otherwise a small searchable shown in close-up */
  caches: { id: string; x: number; label: string; loot?: Loot; time: number; noise?: number; room?: string; /** a fully 3D house (src/house/plans.ts) */ house?: string; style?: 'car' | 'box' | 'shelf' }[];
  rooms: RoomDef[];
  pickups: { id: string; x: number; item: ItemId; qty: number }[];
  infected: InfectedSpawn[];
  workbench?: { x: number };
  checkpoints: number[];
  beats: Beat[];
  objectives: { id: string; text: string }[];
  /** the thing that ends the level. `room` puts it inside a room (x is then metres from its left wall). */
  goal?: { x: number; room?: string; label: string; time: number; needs?: ItemId; lockedInk?: string; needsDead?: string; guardedInk?: string; doneInk: string; objective: string };
}
