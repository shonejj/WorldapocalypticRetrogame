import type { WeaponKind } from '../art/weapons';
import type { Look } from '../art/characters';
import { LOOKS } from '../art/characters';
import type { Gait, Stance } from './rig';

// ---------------------------------------------------------------- items (data-driven; rpg / survival-crafting)
export type ItemId = 'ammo_9mm' | 'ammo_shells' | 'ammo_rifle' | 'medkit' | 'bandage' | 'food' | 'water' | 'scrap' | 'cloth' | 'battery' | 'bottle' | 'alcohol' | 'tape' | 'radio_part' | 'fuel';
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
  fuel: { name: 'Jerrycan of fuel', icon: '▰', weight: 3, stack: 1, desc: 'Enough to turn over one stubborn motor.' },
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
const BASE_WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: { name: '9mm Pistol', mesh: 'pistol', stance: 'pistol', damage: 34, pellets: 1, spread: 0.025, range: 22, cooldown: 0.28, mag: 12, reload: 1.3, ammo: 'ammo_9mm', noise: 22, knock: 2.5, trauma: 0.22, sfx: 'pistol' },
  shotgun: { name: 'Pump Shotgun', mesh: 'shotgun', stance: 'long', damage: 16, pellets: 7, spread: 0.11, range: 11, cooldown: 0.9, mag: 6, reload: 2.4, ammo: 'ammo_shells', noise: 32, knock: 6, trauma: 0.45, sfx: 'shotgun' },
  rifle: { name: 'Carbine', mesh: 'rifle', stance: 'long', damage: 42, pellets: 1, spread: 0.012, range: 30, cooldown: 0.16, mag: 24, reload: 2.0, ammo: 'ammo_rifle', noise: 28, knock: 3, trauma: 0.25, sfx: 'rifle' },
  pipe: { name: 'Steel Pipe', mesh: 'pipe', stance: 'none', damage: 34, pellets: 1, spread: 0, range: 1.35, cooldown: 0.55, mag: 0, reload: 0, ammo: null, noise: 3, knock: 5, trauma: 0.18, sfx: 'melee' },
};
/** Live weapon stats: the base table with the squad's workbench upgrades applied (see applyUpgrades). */
export const WEAPONS: Record<WeaponId, WeaponDef> = JSON.parse(JSON.stringify(BASE_WEAPONS));
export const MELEE_TIME = 0.42;

// ---------------------------------------------------------------- upgrades (rpg: progression bought with scrap)
export type UpgradeId = 'arms' | 'mags' | 'suppressor' | 'pipe' | 'pack' | 'vitality' | 'medicine';
export interface UpgradeDef { name: string; desc: string; cost: number[] }
export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  arms: { name: 'Tuned actions', desc: '+15% firearm damage per level.', cost: [3, 5, 8] },
  mags: { name: 'Extended magazines', desc: '+25% magazine size per level.', cost: [3, 6] },
  suppressor: { name: 'Improvised suppressors', desc: 'Gunfire carries 30% less far per level.', cost: [4, 7] },
  pipe: { name: 'Weighted pipe', desc: '+30% melee damage per level.', cost: [2, 4] },
  pack: { name: 'Reinforced packs', desc: '+6 kg carrying capacity per level.', cost: [2, 4, 6] },
  vitality: { name: 'Field armour', desc: '+15 max health for everyone per level.', cost: [4, 6, 9] },
  medicine: { name: 'Sterile kits', desc: 'Bandages and medkits heal 30% more per level.', cost: [3, 5] },
};
export type Upgrades = Partial<Record<UpgradeId, number>>;
export function applyUpgrades(u: Upgrades): void {
  for (const k of Object.keys(BASE_WEAPONS) as WeaponId[]) {
    const b = BASE_WEAPONS[k], w = WEAPONS[k]; Object.assign(w, b);
    if (b.ammo) { w.damage = Math.round(b.damage * (1 + 0.15 * (u.arms ?? 0))); w.mag = Math.round(b.mag * (1 + 0.25 * (u.mags ?? 0))); w.noise = b.noise * Math.pow(0.7, u.suppressor ?? 0); }
    else w.damage = Math.round(b.damage * (1 + 0.3 * (u.pipe ?? 0)));
  }
}

// ---------------------------------------------------------------- notes (lore; the three research notes unlock the true ending)
export type NoteId = 'n_shift' | 'n_rx' | 'n_fridge' | 'n_order' | 'n_ticket' | 'n_trooper' | 'n_motel' | 'n_diner' | 'n_hale1' | 'n_hale2' | 'n_hale3' | 'n_child' | 'n_radio' | 'n_bunk';
export interface NoteDef { title: string; text: string; research?: boolean }
export const NOTES: Record<NoteId, NoteDef> = {
  n_shift: { title: 'Shift log — FRESH VEGGIES', text: '14 March. Last delivery came in. The driver was coughing blood into his sleeve and wouldn\'t look at me. I told him to go to the pharmacy. He said the pharmacy sent him here.' },
  n_rx: { title: 'Prescription pad', text: 'GENOVA LABS — trial batch 7.\nDo NOT dispense. Return to sender.\n\nUnderneath, in pen: "Too late. Gave out forty boxes on Tuesday."', research: true },
  n_fridge: { title: 'Note on a fridge', text: 'Gone to the radio station on the hill. They say it\'s safe there. Feed the cat. I love you. — Mum' },
  n_order: { title: 'Work order #4471', text: 'Ambulance 12 — brakes. Never collected. Owner in quarantine.\n\nMiller\'s handwriting in the margin: "Keep the keys. Somebody will need it."' },
  n_ticket: { title: 'Bus ticket', text: 'Route 7 — Market St → Lighthouse Point. Someone has circled the last stop three times.' },
  n_trooper: { title: 'Trooper\'s notebook', text: 'Day 9. Orders are to hold the checkpoint and turn everyone back. Day 12. Nobody is coming to relieve us. Day 13. The sergeant is sick. He asked me to lock him in the booth. I did.' },
  n_motel: { title: 'Motel register', text: 'Room 6 — "Dr. E. Hale + 1." Paid cash, four nights. A second line, added later in a different hand: "She carried the child out herself. Neither of them was sick. How?"', research: true },
  n_diner: { title: 'Napkin', text: 'If you are reading this: the fog hides you from them. They hunt by sound. Walk. Do not run. — a friend' },
  n_hale1: { title: 'Lab journal — E. Hale', text: 'The organism does not kill the resistant. It settles. In their blood it makes something we cannot synthesise. One donor could seed a serum for a city — but the draw we need would stop a heart.' },
  n_hale2: { title: 'Lab journal — E. Hale, later', text: 'I was wrong about the dose. Two carriers. Half the draw each, twelve hours apart, and the fraction still takes. Nobody has to die on the table. I need TWO. I only ever had one.', research: true },
  n_hale3: { title: 'Recording transcript', text: 'PROTOCOL LIGHTHOUSE is the only thing I have left to try. If you are resistant and you can hear this, come to Genova. I will be here. I will wait as long as I can.' },
  n_radio: { title: 'Frequency log, kitchen wall', text: 'Pencil marks on the wallpaper, one for every night: 7.390 MHz. Numbers, a woman\'s voice, then the same word every time — GENOVA. Under the last mark: "If it stops, go."' },
  n_bunk: { title: 'Bunk 31 — a nurse\'s diary', text: 'Dr. Hale stopped sleeping. She walks the corridor at night talking to the girl through the glass. Today she asked me my blood type. Then she asked if I had ever been bitten. I lied.' },
  n_child: { title: 'A child\'s drawing', text: 'A tall building with an antenna. Two stick figures holding hands. In crayon: "MUM\'S WORK. WE LIVE HERE NOW."' },
};

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
export type InfectedType = 'common' | 'runner' | 'brute' | 'crawler' | 'screamer' | 'hound' | 'warden' | 'host';
export interface InfectedDef { name: string; hp: number; walk: number; chase: number; damage: number; reach: number; windup: number; cooldown: number; sight: number; hearing: number; scale: number; gait: Gait; poise: number; density: number;
  /** standing height as a fraction of a person (crawlers and hounds are low targets) */ height?: number;
  /** bosses: fraction of damage that gets through unless the boss is exposed (after a charge hits a wall) */ armor?: number;
  /** body the view borrows (bosses reuse the brute's mutations at a larger scale) */ body?: 'brute';
  /** boss behaviours: a telegraphed charge, a ground slam that hits everyone in reach, waves of hosts called at health thresholds */
  boss?: { title: string; charge?: boolean; slam?: boolean; summon?: InfectedType[] } }
export const INFECTED: Record<InfectedType, InfectedDef> = {
  common: { name: 'Infected', hp: 70, walk: 0.7, chase: 1.75, damage: 12, reach: 0.95, windup: 0.55, cooldown: 1.1, sight: 9, hearing: 1, scale: 1, gait: 'shamble', poise: 1, density: 1 },
  runner: { name: 'Runner', hp: 45, walk: 1.0, chase: 4.8, damage: 9, reach: 0.9, windup: 0.38, cooldown: 0.8, sight: 12, hearing: 1.3, scale: 0.97, gait: 'sprint', poise: 0.8, density: 0.8 },
  crawler: { name: 'Crawler', hp: 40, walk: 0.5, chase: 1.5, damage: 11, reach: 0.95, windup: 0.45, cooldown: 1.0, sight: 6, hearing: 1.3, scale: 1, gait: 'crawl', poise: 0.9, density: 0.7, height: 0.4 },
  screamer: { name: 'Screamer', hp: 55, walk: 0.55, chase: 0.9, damage: 8, reach: 0.9, windup: 0.5, cooldown: 1.2, sight: 13, hearing: 1.5, scale: 1.04, gait: 'scream', poise: 0.9, density: 0.85 },
  hound: { name: 'Hound', hp: 50, walk: 1.3, chase: 5.8, damage: 14, reach: 1.15, windup: 0.32, cooldown: 0.7, sight: 11, hearing: 1.7, scale: 1, gait: 'hound', poise: 0.7, density: 0.9, height: 0.5 },
  warden: { name: 'The Warden', hp: 2600, walk: 0.7, chase: 1.7, damage: 28, reach: 1.5, windup: 0.8, cooldown: 1.5, sight: 14, hearing: 1.2, scale: 1.45, gait: 'brute', poise: 0.12, density: 1.8, body: 'brute', armor: 0.12,
    boss: { title: 'THE WARDEN — what is left of the checkpoint sergeant', charge: true } },
  host: { name: 'The Host', hp: 4200, walk: 0.8, chase: 1.9, damage: 30, reach: 1.9, windup: 0.9, cooldown: 1.4, sight: 20, hearing: 1.5, scale: 1.7, gait: 'brute', poise: 0.08, density: 2.2, body: 'brute', armor: 0.12,
    boss: { title: 'THE HOST — patient zero', charge: true, slam: true, summon: ['common', 'runner', 'common'] } },
  brute: { name: 'Bloated Brute', hp: 1800, walk: 0.6, chase: 1.5, damage: 32, reach: 1.4, windup: 0.95, cooldown: 1.8, sight: 8, hearing: 0.8, scale: 1.35, gait: 'brute', poise: 0.2, density: 1.6, armor: 0.3, boss: { title: 'BLOATED BRUTE — it never left the relay', charge: true } },
};

/** Noise radii in metres (infected within radius investigate). */
export const NOISE = { walk: 2.4, run: 7.5, crouch: 0, melee: 4, impact: 6, reload: 2, search: 3, bottle: 13, shout: 13 };

/** Survival needs (survival-crafting pattern 1): per-second decay, graded consequences. */
export const NEEDS = { hungerRate: 1 / 400, thirstRate: 1 / 280, starveDps: 0.6, bleedDps: 1.4, regenHps: 0.25 };
export const CARRY_LIMIT = 18;   // kg shared squad stash (logistics tension)
