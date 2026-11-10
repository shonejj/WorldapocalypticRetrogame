import { readVersioned, writeAtomic, raw, type Migration } from '../core/storage';
import type { ItemId } from './data';

/**
 * Save schema (save-systems): plain data only, version stamped, migrations in order.
 * Autosave lives in its own key so it never clobbers a manual save.
 */
export const SAVE_VERSION = 3;
export interface SurvivorSave { id: string; hp: number; alive: boolean; mag: number; hunger: number; thirst: number; bleed: number }
export interface SaveData {
  version: number; chapter: string; checkpoint: number; savedAt: number;
  stash: Partial<Record<ItemId, number>>; party: SurvivorSave[]; controlled: number;
  looted: string[]; picked: string[]; killed: string[]; objectives: string[]; seenBeats: string[]; ink: string | null;
  /** v3 (campaign): lore notes read, workbench upgrades, running totals for the results screen */
  notes: string[]; upgrades: Partial<Record<string, number>>; stats: { time: number; shots: number };
}

export const MIGRATIONS: Record<number, Migration> = {
  // v1 (pre-release shape) had no needs and no Ink state
  1: (d) => ({ ...d, party: ((d.party as Record<string, unknown>[]) ?? []).map((p) => Object.assign({ hunger: 1, thirst: 1, bleed: 0 }, p)), seenBeats: d.seenBeats ?? [], ink: d.ink ?? null }),
  // v2 → v3: campaign fields; old chapter id 'ch1' is still chapter one
  2: (d) => ({ ...d, notes: d.notes ?? [], upgrades: d.upgrades ?? {}, stats: d.stats ?? { time: 0, shots: 0 } }),
};

export function isSave(d: unknown): d is SaveData {
  const s = d as SaveData;
  return !!s && typeof s.version === 'number' && typeof s.chapter === 'string' && typeof s.checkpoint === 'number' && Array.isArray(s.party) && typeof s.stash === 'object';
}

export type Slot = 'autosave' | 'manual';
export const saveGame = (slot: Slot, d: SaveData) => writeAtomic(`save.${slot}`, d);
export const loadGame = (slot: Slot) => readVersioned<SaveData>(`save.${slot}`, SAVE_VERSION, MIGRATIONS, isSave);
export const hasSave = (slot: Slot) => !!raw.get(`save.${slot}`);
export const deleteSave = (slot: Slot) => { raw.del(`save.${slot}`); raw.del(`save.${slot}.bak`); };
/** Most recent of autosave/manual. */
export function latestSave(): SaveData | null {
  const a = safe(() => loadGame('autosave')), m = safe(() => loadGame('manual'));
  if (a && m) return a.savedAt >= m.savedAt ? a : m;
  return a ?? m;
}
const safe = <T>(f: () => T): T | null => { try { return f(); } catch { return null; } };
