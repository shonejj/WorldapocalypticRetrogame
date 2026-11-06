import type { BuildingSpec, VehicleKind } from '../../render/art/environment';
import type { InfectedType, ItemId } from '../data';

export type Loot = Partial<Record<ItemId, number>>;

export interface LevelDef {
  id: string;
  name: string;
  location: string;
  width: number;                 // metres of walkable street
  spawnX: number;
  seed: number;
  buildings: (Omit<BuildingSpec, 'seed' | 'wPx' | 'hPx'> & { x: number; w: number; h: number })[];
  rearBuildings: { x: number; w: number; h: number }[];
  curbVehicles: { x: number; kind: VehicleKind; flip?: boolean }[];
  props: { x: number; kind: 'barrel' | 'crate' | 'cone' | 'barrier' | 'dumpster'; dynamic: boolean }[];
  decor: { x: number; kind: 'lamp' | 'pole' | 'fence' | 'billboard' | 'bush' | 'tree' | 'relay'; text?: string; lit?: boolean; flicker?: boolean }[];
  caches: { id: string; x: number; label: string; loot: Loot; time: number; noise?: number }[];
  pickups: { id: string; x: number; item: ItemId; qty: number }[];
  infected: { id: string; x: number; type: InfectedType; state: 'idle' | 'dormant' | 'wander'; facing?: 1 | -1 }[];
  checkpoints: number[];
  objectives: { id: string; text: string; x?: number }[];
  goal: { x: number; label: string; objective: string };
  radioLines: { x: number; text: string; speaker: string }[];
}
