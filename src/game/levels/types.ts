import type { InfectedType, ItemId } from '../data';

export type Loot = Partial<Record<ItemId, number>>;

/** A kit piece placed in the level. x = world position of the piece's left edge (m). */
export interface Placement { piece: string; x: number; y?: number; flip?: boolean; depth?: 'street' | 'curb' | 'fg' }

export interface LevelDef {
  id: string;
  name: string;
  location: string;
  width: number;                 // metres of walkable street
  spawnX: number;
  seed: number;
  street: Placement[];           // building fronts (slight parallax)
  curb: Placement[];             // vehicles / barriers directly behind the walk line
  foreground: Placement[];       // big silhouettes in front of the camera
  props: { x: number; kind: 'barrel' | 'crates' | 'cone'; }[];
  caches: { id: string; x: number; label: string; loot: Loot; time: number; noise?: number }[];
  pickups: { id: string; x: number; item: ItemId; qty: number }[];
  infected: { id: string; x: number; type: InfectedType; state: 'idle' | 'dormant' | 'wander'; facing?: 1 | -1 }[];
  checkpoints: number[];
  objectives: { id: string; text: string; x?: number }[];
  goal: { x: number; label: string; objective: string };
  radioLines: { x: number; text: string; speaker: string }[];
}
