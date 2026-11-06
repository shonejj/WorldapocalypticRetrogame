export type WeaponHold = 'pistol' | 'long' | 'melee';
export type Gait = 'shamble' | 'sprint' | 'brute';

// ---------------------------------------------------------------- items
export type ItemId = 'ammo_pistol' | 'ammo_shells' | 'ammo_rifle' | 'medkit' | 'bandage' | 'food' | 'water' | 'scrap' | 'cloth' | 'battery';
export const ITEMS: Record<ItemId, { name: string; icon: string; max: number }> = {
  ammo_pistol: { name: '9mm rounds', icon: '▮', max: 120 },
  ammo_shells: { name: '12ga shells', icon: '▬', max: 40 },
  ammo_rifle: { name: '.308 rounds', icon: '▯', max: 40 },
  medkit: { name: 'Medkit', icon: '✚', max: 6 },
  bandage: { name: 'Bandage', icon: '≡', max: 10 },
  food: { name: 'Canned food', icon: '◍', max: 20 },
  water: { name: 'Water', icon: '◌', max: 20 },
  scrap: { name: 'Scrap', icon: '⚙', max: 60 },
  cloth: { name: 'Cloth', icon: '▤', max: 30 },
  battery: { name: 'Battery', icon: '▣', max: 10 },
};

// ---------------------------------------------------------------- weapons
export type WeaponId = 'pistol' | 'shotgun' | 'rifle' | 'pipe';
export interface WeaponDef {
  name: string; hold: WeaponHold;
  damage: number; pellets: number; spread: number; range: number;
  cooldown: number; mag: number; reload: number; ammo: ItemId | null;
  noise: number; knockback: number; shake: number;
  sound: 'gunshot' | 'shotgun' | 'rifle' | 'melee';
}
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: { name: '9mm Pistol', hold: 'pistol', damage: 34, pellets: 1, spread: 0.02, range: 22, cooldown: 0.3, mag: 12, reload: 1.3, ammo: 'ammo_pistol', noise: 24, knockback: 2.5, shake: 0.06, sound: 'gunshot' },
  shotgun: { name: 'Pump Shotgun', hold: 'long', damage: 17, pellets: 7, spread: 0.12, range: 10, cooldown: 0.95, mag: 6, reload: 2.4, ammo: 'ammo_shells', noise: 34, knockback: 6, shake: 0.16, sound: 'shotgun' },
  rifle: { name: 'Hunting Rifle', hold: 'long', damage: 95, pellets: 1, spread: 0.004, range: 34, cooldown: 1.15, mag: 5, reload: 2.2, ammo: 'ammo_rifle', noise: 30, knockback: 8, shake: 0.12, sound: 'rifle' },
  pipe: { name: 'Steel Pipe', hold: 'melee', damage: 32, pellets: 1, spread: 0, range: 1.3, cooldown: 0.6, mag: 0, reload: 0, ammo: null, noise: 3, knockback: 5, shake: 0.05, sound: 'melee' },
};
export const MELEE_SWING_TIME = 0.42;

// ---------------------------------------------------------------- survivors
export type Role = 'scavenger' | 'medic' | 'mechanic' | 'signalist';
export interface SurvivorDef {
  id: string; name: string; role: Role; roleLabel: string; bio: string;
  maxHp: number; walk: number; run: number; weapon: WeaponId; melee: WeaponId;
  resistant: boolean; trait: string;
}

export const SURVIVORS: SurvivorDef[] = [
  {
    id: 'reed', name: 'Reed', role: 'scavenger', roleLabel: 'Scavenger', resistant: true,
    bio: 'Former delivery driver. Knows every back road in the district. Has never been sick a day since the outbreak — and has never told anyone why.',
    trait: 'Finds extra supplies when searching.', maxHp: 100, walk: 1.75, run: 4.4, weapon: 'pistol', melee: 'pipe',
  },
  {
    id: 'maya', name: 'Maya', role: 'medic', roleLabel: 'Medic', resistant: false,
    bio: 'Second-year nursing student when the hospitals fell. Keeps a notebook of every patient she could not save.',
    trait: 'Heals wounded teammates with medkits.', maxHp: 85, walk: 1.75, run: 4.5, weapon: 'pistol', melee: 'pipe',
  },
  {
    id: 'miller', name: 'Miller', role: 'mechanic', roleLabel: 'Mechanic', resistant: false,
    bio: 'Ran a garage for thirty years. Talks to engines more kindly than to people. Carries a shotgun he calls "the negotiator".',
    trait: 'Shotgun specialist; heavy melee knockback.', maxHp: 120, walk: 1.6, run: 3.9, weapon: 'shotgun', melee: 'pipe',
  },
  {
    id: 'iris', name: 'Iris', role: 'signalist', roleLabel: 'Signalist', resistant: true,
    bio: 'Ham-radio kid who first caught the repeating transmission. She is convinced someone is waiting on the other end.',
    trait: 'Senses nearby infected on the radio band; long-range rifle.', maxHp: 80, walk: 1.8, run: 4.6, weapon: 'rifle', melee: 'pipe',
  },
];

// ---------------------------------------------------------------- infected
export type InfectedType = 'common' | 'runner' | 'brute';
export interface InfectedDef {
  name: string; maxHp: number; walk: number; chase: number; damage: number; reach: number;
  attackTime: number; cooldown: number; sight: number; hearing: number; scale: number; gait: Gait;
  knockbackResist: number; density: number;
}
export const INFECTED: Record<InfectedType, InfectedDef> = {
  common: { name: 'Infected', maxHp: 70, walk: 0.7, chase: 1.7, damage: 11, reach: 0.95, attackTime: 0.55, cooldown: 1.1, sight: 9, hearing: 1, scale: 1, gait: 'shamble', knockbackResist: 1, density: 1 },
  runner: { name: 'Runner', maxHp: 45, walk: 1.0, chase: 4.9, damage: 8, reach: 0.9, attackTime: 0.4, cooldown: 0.8, sight: 12, hearing: 1.3, scale: 0.97, gait: 'sprint', knockbackResist: 0.8, density: 0.8 },
  brute: { name: 'Bloated Brute', maxHp: 420, walk: 0.6, chase: 1.45, damage: 30, reach: 1.35, attackTime: 0.9, cooldown: 1.8, sight: 8, hearing: 0.8, scale: 1.32, gait: 'brute', knockbackResist: 0.25, density: 1.8 },
};

/** Noise radii (metres) — infected within the radius investigate the source. */
export const NOISE = { walk: 2.6, run: 7, crouch: 0, melee: 4, impact: 6, reload: 2, shout: 12 };
