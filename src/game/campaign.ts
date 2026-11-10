import type { LevelDef } from './levels/types';
import { CHAPTER1 } from './levels/chapter1';
import { CHAPTER2 } from './levels/chapter2';
import { CHAPTER3 } from './levels/chapter3';
import { CAMP1, CAMP2 } from './levels/camps';

/** The campaign in play order: chapters with a safehouse between them. */
export const CAMPAIGN: LevelDef[] = [CHAPTER1, CAMP1, CHAPTER2, CAMP2, CHAPTER3];
export const levelById = (id: string): LevelDef => CAMPAIGN.find((l) => l.id === id) ?? CHAPTER1;
export const nextLevel = (id: string): LevelDef | null => CAMPAIGN[CAMPAIGN.findIndex((l) => l.id === id) + 1] ?? null;
