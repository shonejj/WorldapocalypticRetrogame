import type { BuildingSpec } from '../../art/buildings';
import type { PropKind } from '../../art/props';
import type { VehicleKind } from '../../art/vehicles';
import type { InfectedType, ItemId } from '../data';

export type Loot = Partial<Record<ItemId, number>>;
/** A pacing beat (level-design pattern 2): intensity drives adaptive music and spawns. */
export interface Beat { id: string; x0: number; x1: number; type: 'teach' | 'explore' | 'tension' | 'combat' | 'rest' | 'climax'; intensity: number; ink?: string; title?: string }
export interface LevelDef {
  id: string; name: string; location: string; x0: number; x1: number; spawnX: number; seed: number;
  buildings: Omit<BuildingSpec, 'seed'>[];
  relayX: number; overpass: [number, number]; billboard?: { x: number; text: string };
  lamps: { x: number; lit: boolean; flicker?: boolean }[]; poles: number[]; fences: [number, number][];
  trees: number[]; vehicles: { x: number; kind: VehicleKind; flip?: boolean; z?: number }[];
  props: { x: number; kind: PropKind; z?: number }[];
  caches: { id: string; x: number; label: string; loot: Loot; time: number; noise?: number }[];
  pickups: { id: string; x: number; item: ItemId; qty: number }[];
  infected: { id: string; x: number; type: InfectedType; state: 'idle' | 'dormant' | 'wander'; facing?: 1 | -1 }[];
  workbench: { x: number };
  checkpoints: number[];
  beats: Beat[];
  objectives: { id: string; text: string }[];
  goal: { x: number; needs: ItemId; objective: string };
}
