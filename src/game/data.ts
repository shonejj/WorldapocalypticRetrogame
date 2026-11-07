import type { WeaponKind } from '../art/weapons';
import type { Look } from '../art/characters';
import { LOOKS } from '../art/characters';
import type { Gait, Stance } from './rig';

// ---------------------------------------------------------------- items (data-driven; rpg / survival-crafting)
export type ItemId = 'ammo_9mm' | 'ammo_shells' | 'ammo_rifle' | 'medkit' | 'bandage' | 'food' | 'water' | 'scrap' | 'cloth' | 'battery' | 'bottle' | 'alcohol' | 'tape' | 'radio_part';
export interface ItemDef { name: string; icon: string; weight: number; stack: number; desc: string }
export const ITEMS: Record<ItemId, ItemDef> = {
  ammo_9mm: { name: '9mm rounds', icon: '⁍', weight: 0.01, stack: 120, desc: 'Pistol ammunition.' },
  ammo_shells: { name: '12-gauge shells', icon: '▮', weight: 0.04, stack: 40, desc: 'Shotgun shells.' },
  ammo_rifle: { name: '5.56 rounds', icon: '❘', weight: 0.012, stack: 90, desc: 'Rifle ammunition.' },
  medkit: { name: 'Medkit', icon: '✚', weight: 0.5, stack: 5, desc: 'Restores a lot of health and stops bleeding.' },
  bandage: { name: 'Bandage', icon: '≡', weight: 0.08, stack: 10, desc: 'Stops bleeding, restores a little health.' },
  food: { name: 'Canned food', icon: '◍', weight: 0.4, stack: 10, desc: 'Restores hunger.' },
  water: { name: 'Water bottle', icon: '◌', weight: 0.5, stack: 10, desc: 'Restores thirst.' },
  scrap: { name: 'Scrap metal', icon: '⚙', weight: 0.3, stack: 30, desc: 'Crafting material.' },
  cloth: { name: 'Cloth', icon: '▤', weight: 0.1, stack: 20, desc: 'Crafting material.' },
  battery: { name: 'Battery', icon: '▣', weight: 0.15, stack: 10, desc: 'Powers radios and lights.' },
  bottle: { name: 'Empty bottle', icon: '◊', weight: 0.25, stack: 6, desc: 'Throw it to make noise and lure infected away.' },
  alcohol: { name: 'Alcohol', icon: '◈', weight: 0.4, stack: 6, desc: 'Disinfectant. Crafting material.' },
  tape: { name: 'Duct tape', icon: '◎', weight: 0.1, stack: 10, desc: 'Fixes almost anything.' },
  radio_part: { name: 'Relay fuse', icon: '⌁', weight: 0.2, stack: 3, desc: 'A replacement fuse for a radio relay.' },
};

export interface Recipe { id: string; name: string; inputs: Partial<Record<ItemId, number>>; output: [ItemId, number]; requires?: 'medic' | 'mechanic'; time: number }
export const RECIPES: Recipe[] = [
  { id: 'bandage', name: 'Bandage', inputs: { cloth: 2 }, output: ['bandage', 1], time: 1.2 },
  { id: 'medkit', name: 'Medkit', inputs: { bandage: 2, alcohol: 1 }, output: ['medkit', 1], requires: 'medic', time: 2.5 },
  { id: 'shells', name: '12-gauge shells ×4', inputs: { scrap: 2, tape: 1 }, output: ['ammo_shells', 4], requires: 'mechanic', time: 2 },
  { id: 'lure', name: 'Noise lure (bottle)', inputs: { alcohol: 1 }, output: ['bottle', 1], time: 0.8 },
  { id: 'fuse', name: 'Relay fuse', inputs: { scrap: 2, battery: 1, tape: 1 }, output: ['radio_part', 1], requires: 'mechanic', time: 3 },
];

// ---------------------------------------------------------------- weapons
export type WeaponId = 'pistol' | 'shotgun' | 'rifle' | 'pipe';
export interface WeaponDef {
  name: string; mesh: WeaponKind; stance: Stance; damage: number; pellets: number; spread: number; range: number;
  cooldown: number; mag: number; reload: number; ammo: ItemId | null; noise: number; knock: number; trauma: number;
  sfx: 'pistol' | 'shotgun' | 'rifle' | 'melee';
}
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: { name: '9mm Pistol', mesh: 'pistol', stance: 'pistol', damage: 34, pellets: 1, spread: 0.025, range: 22, cooldown: 0.28, mag: 12, reload: 1.3, ammo: 'ammo_9mm', noise: 22, knock: 2.5, trauma: 0.22, sfx: 'pistol' },
  shotgun: { name: 'Pump Shotgun', mesh: 'shotgun', stance: 'long', damage: 16, pellets: 7, spread: 0.11, range: 11, cooldown: 0.9, mag: 6, reload: 2.4, ammo: 'ammo_shells', noise: 32, knock: 6, trauma: 0.45, sfx: 'shotgun' },
  rifle: { name: 'Carbine', mesh: 'rifle', stance: 'long', damage: 42, pellets: 1, spread: 0.012, range: 30, cooldown: 0.16, mag: 24, reload: 2.0, ammo: 'ammo_rifle', noise: 28, knock: 3, trauma: 0.25, sfx: 'rifle' },
  pipe: { name: 'Steel Pipe', mesh: 'pipe', stance: 'none', damage: 34, pellets: 1, spread: 0, range: 1.35, cooldown: 0.55, mag: 0, reload: 0, ammo: null, noise: 3, knock: 5, trauma: 0.18, sfx: 'melee' },
};
export const MELEE_TIME = 0.42;

// ---------------------------------------------------------------- survivors
export type Role = 'scavenger' | 'medic' | 'mechanic' | 'signalist';
export interface SurvivorDef {
  id: 'reed' | 'maya' | 'miller' | 'iris'; name: string; role: Role; roleLabel: string; bio: string; trait: string;
  maxHp: number; walk: number; run: number; weapon: WeaponId; resistant: boolean; look: Look;
}
export const SURVIVORS: SurvivorDef[] = [
  { id: 'reed', name: 'Reed', role: 'scavenger', roleLabel: 'Scavenger', resistant: true, maxHp: 100, walk: 1.75, run: 4.4, weapon: 'rifle', look: LOOKS.reed,
    bio: 'Former delivery driver who knows every back road in the district. Hasn\'t been sick a day since the outbreak, and has never said why.',
    trait: 'Searches faster and finds extra supplies.' },
  { id: 'maya', name: 'Maya', role: 'medic', roleLabel: 'Medic', resistant: false, maxHp: 85, walk: 1.75, run: 4.5, weapon: 'pistol', look: LOOKS.maya,
    bio: 'Second-year nursing student when the hospitals fell. Keeps a notebook of every patient she couldn\'t save.',
    trait: 'Heals teammates; crafts medkits.' },
  { id: 'miller', name: 'Miller', role: 'mechanic', roleLabel: 'Mechanic', resistant: false, maxHp: 120, walk: 1.6, run: 3.9, weapon: 'shotgun', look: LOOKS.miller,
    bio: 'Ran a garage for thirty years. Talks to engines more kindly than to people.',
    trait: 'Heavy melee knockback; crafts shells and repairs.' },
  { id: 'iris', name: 'Iris', role: 'signalist', roleLabel: 'Signalist', resistant: true, maxHp: 80, walk: 1.8, run: 4.6, weapon: 'pistol', look: LOOKS.iris,
    bio: 'Ham-radio kid who first caught the repeating transmission. Convinced someone is waiting on the other end.',
    trait: 'Hears infected on the radio band (signal meter).' },
];

// ---------------------------------------------------------------- infected
export type InfectedType = 'common' | 'runner' | 'brute';
export interface InfectedDef { name: string; hp: number; walk: number; chase: number; damage: number; reach: number; windup: number; cooldown: number; sight: number; hearing: number; scale: number; gait: Gait; poise: number; density: number }
export const INFECTED: Record<InfectedType, InfectedDef> = {
  common: { name: 'Infected', hp: 70, walk: 0.7, chase: 1.75, damage: 12, reach: 0.95, windup: 0.55, cooldown: 1.1, sight: 9, hearing: 1, scale: 1, gait: 'shamble', poise: 1, density: 1 },
  runner: { name: 'Runner', hp: 45, walk: 1.0, chase: 4.8, damage: 9, reach: 0.9, windup: 0.38, cooldown: 0.8, sight: 12, hearing: 1.3, scale: 0.97, gait: 'sprint', poise: 0.8, density: 0.8 },
  brute: { name: 'Bloated Brute', hp: 520, walk: 0.6, chase: 1.5, damage: 32, reach: 1.4, windup: 0.95, cooldown: 1.8, sight: 8, hearing: 0.8, scale: 1.35, gait: 'brute', poise: 0.2, density: 1.6 },
};

/** Noise radii in metres (infected within radius investigate). */
export const NOISE = { walk: 2.4, run: 7.5, crouch: 0, melee: 4, impact: 6, reload: 2, search: 3, bottle: 13, shout: 13 };

/** Survival needs (survival-crafting pattern 1): per-second decay, graded consequences. */
export const NEEDS = { hungerRate: 1 / 400, thirstRate: 1 / 280, starveDps: 0.6, bleedDps: 1.4, regenHps: 0.25 };
export const CARRY_LIMIT = 18;   // kg shared squad stash (logistics tension)
