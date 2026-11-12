import * as THREE from 'three';
import { WetReflections } from '../render/wet';
import { buildRoom } from '../art/rooms';
import { FACADE_Z } from '../art/buildings';
import * as planck from 'planck';
import { Actor, idle, type Host, type Intent } from './actor';
import { InfectedBrain, PlayerBrain, SquadBrain, StationBrain, type AIWorld, type Brain } from './brains';
import { ITEMS, NEEDS, NOISE, RECIPES, SURVIVORS, WEAPONS, MELEE_TIME, INFECTED, UPGRADES, applyUpgrades, CARRY_LIMIT, type ItemId, type Role, type NoteId, type UpgradeId, type Upgrades, type InfectedType } from './data';
import { Stash } from './inventory';
import type { LevelDef, Beat, Loot, RoomDef } from './levels/types';
import type { LightSpot } from '../art/kit';
import { SAVE_VERSION, type SaveData } from './save';
import { buildWorld, type BuiltWorld } from './worldBuilder';
import { targetPose, blendPose, zeroPose, type AnimIn, type Pose } from './rig';
import { CharacterView, infectedLook, type Look } from '../art/characters';
import { SkinnedView, characterAssetReady } from '../art/skinned';
type View = CharacterView | SkinnedView;
const makeView = (look: Look, scale = 1): View => (characterAssetReady() ? new SkinnedView(look, scale) : new CharacterView(look, scale));
import { pickupMesh, lootSpot } from '../art/props';
import { createWorld, addGround, raycast, kick, CAT, type Tag } from '../physics/world';
import { createRagdoll, destroyRagdoll, partPivot, shove, type Ragdoll } from '../physics/ragdoll';
import { Fx } from '../render/fx';
import { Rain } from '../render/weather';
import { CameraRig } from '../render/camera';
import { LightPool } from '../render/lighting';
import { Haze } from '../render/haze';
import { MOODS, applyMood, type Mood, type MoodId } from '../render/mood';
import type { Renderer } from '../render/renderer';
import { Emitter } from '../core/events';
import { Rng, hashString } from '../core/math';
import { audio, type Sfx } from '../core/audio';
import type { InputFrame } from '../core/input';

export interface GameEvents extends Record<string, unknown> {
  toast: { text: string; kind: 'loot' | 'info' | 'warn' };
  dialogue: { knot: string; then?: 'complete' };
  note: { id: NoteId };
  place: { title: string };
  bossDown: { name: string };
  alert: { on: boolean };
  hurt: { amount: number };
  death: { name: string; player: boolean };
  switched: { index: number };
  objective: { id: string; done: boolean };
  checkpoint: { x: number };
  stash: Record<string, never>;
  beat: { beat: Beat };
  hitStop: { seconds: number };
  gameover: Record<string, never>;
  complete: Record<string, never>;
}

export interface Interactable { id: string; x: number; label: string; kind: 'cache' | 'door' | 'exit' | 'workbench' | 'goal' | 'talk' | 'rest'; loot?: Loot; note?: NoteId; time: number; noise?: number; room?: string; knot?: string; style?: 'car' | 'box' | 'shelf' }
/** A stretch of the lane the squad can be in: the street, or one room. Actors are clamped to their zone. */
export interface Zone { id: string; x0: number; x1: number; mood: MoodId; def?: RoomDef; doorX: number; visited: boolean }
const ROOM_X = 1000, ROOM_GAP = 240, ROOM_ZOOM = 0.64;
interface Corpse { actor: Actor; rd: Ragdoll; view: View; age: number }
interface Lure { body: planck.Body; mesh: THREE.Object3D; t: number; broke: boolean }

export class Game implements Host, AIWorld {
  readonly ev = new Emitter<GameEvents>();
  readonly world: planck.World;
  readonly built: BuiltWorld;
  readonly lights: LightPool;
  readonly fx: Fx; readonly rain: Rain; readonly cam = new CameraRig(); readonly wet: WetReflections; readonly haze: Haze;
  /** player video settings; the current mood decides whether rain / wet reflections apply at all */
  prefs = { rain: true, reflections: true }; mood: Mood = MOODS.rainNight;
  readonly rng: Rng;
  readonly squad: Actor[] = []; readonly infected: Actor[] = [];
  readonly stash: Stash;
  readonly brains = new Map<number, Brain>();
  readonly views = new Map<number, View>();
  private poses = new Map<number, Pose>(); private tgt = zeroPose();
  private corpses: Corpse[] = []; private lures: Lure[] = [];
  private pickups: { id: string; x: number; item: ItemId; qty: number; mesh: THREE.Object3D }[] = [];
  interactables: Interactable[] = [];
  private shot: { x: number; until: number } | null = null;
  private lootSpots = new Map<string, THREE.Object3D>();
  /** places: zones[0] is the street; the rest are rooms. `zone` is where the squad is now. */
  readonly zones: Zone[] = []; zone!: Zone;
  notes = new Set<NoteId>(); upg: Upgrades = {}; shotsFired = 0; private summoned = 0;
  readonly player = new PlayerBrain();
  controlled = 0; hold = { on: false, x: 0 };
  looted = new Set<string>(); picked = new Set<string>(); killed = new Set<string>(); objectives = new Set<string>(); seenBeats = new Set<string>();
  checkpointX: number; time = 0;
  focus: Interactable | null = null; progress = 0; private using: Interactable | null = null;
  alert = false; intensity = 0; private beat: Beat | null = null;
  paused = false; ended = false; private lastShot = -99;

  constructor(readonly r: Renderer, readonly level: LevelDef, save: SaveData | null, shadows: boolean) {
    this.rng = new Rng(level.seed);
    this.world = createWorld(level.x0, level.x1);
    this.lights = new LightPool(r.scene, shadows);
    this.built = buildWorld(level, r.scene, this.world);
    this.zones.push({ id: 'street', x0: level.x0, x1: level.x1, mood: level.mood, doorX: 0, visited: true });
    const allLights: LightSpot[] = [...this.built.lights];
    level.rooms.forEach((def, i) => {
      const X = ROOM_X + i * ROOM_GAP, door = level.caches.find((c) => c.room === def.id);
      const built = buildRoom(def.kind, X, def.w, hashString(level.id + def.id), def.kind === 'safehouse' ? 0xb9ccd0 : MOODS[level.mood].fog);
      r.scene.add(built.group); allLights.push(...built.lights); addGround(this.world, X, X + def.w);
      this.zones.push({ id: def.id, x0: X, x1: X + def.w, mood: def.mood ?? (def.kind === 'safehouse' ? 'camp' : def.kind === 'lab' ? 'lab' : 'room'), def, doorX: door?.x ?? level.spawnX, visited: false });
    });
    this.zone = this.zones[0];
    this.lights.set(allLights);
    this.fx = new Fx(r.scene); this.rain = new Rain(r.scene);
    // no rain under shop awnings (they stretch ~1.3 m out from the facade, ~3.6 m up)
    this.rain.cover = level.buildings.filter((b) => b.kind === 'store' || b.kind === 'pharmacy').map((b) => ({ x0: b.x + 0.3, x1: b.x + b.w - 0.3, z0: FACADE_Z, z1: FACADE_Z + 1.35, y: 3.6 }));
    this.wet = new WetReflections(r.scene); this.haze = new Haze(r.scene);
    this.checkpointX = save?.checkpoint ?? level.spawnX;
    this.stash = new Stash(save?.stash ?? { ammo_rifle: 36, ammo_9mm: 24, ammo_shells: 8, bandage: 1, food: 1, water: 1, bottle: 1 });
    if (save) { save.looted.forEach((x) => this.looted.add(x)); save.picked.forEach((x) => this.picked.add(x)); save.killed.forEach((x) => this.killed.add(x)); save.objectives.forEach((x) => this.objectives.add(x)); save.seenBeats.forEach((x) => this.seenBeats.add(x)); }
    (save?.notes ?? []).forEach((n) => this.notes.add(n as NoteId)); this.upg = { ...(save?.upgrades ?? {}) };
    applyUpgrades(this.upg); this.stash.limit = CARRY_LIMIT + 6 * (this.upg.pack ?? 0);
    const start = level.startRoom ? this.zones.find((z) => z.id === level.startRoom)! : null;
    if (start) { this.zone = start; start.visited = true; this.checkpointX = start.x0 + 2.2; }
    this.setMood(this.zone.mood);
    // squad
    SURVIVORS.forEach((def, i) => {
      const talk = start?.def?.talks?.find((t) => t.who === def.id);
      const a = new Actor({ x: talk ? start!.x0 + talk.dx : this.checkpointX - i * 1.1, survivor: def.id });
      a.maxHp += 15 * (this.upg.vitality ?? 0); a.hp = a.maxHp;
      const s = save?.party.find((p) => p.id === def.id);
      if (s) Object.assign(a, { hp: Math.min(a.maxHp, s.hp), mag: Math.min(WEAPONS[a.weapon].mag, s.mag), hunger: s.hunger, thirst: s.thirst, bleed: s.bleed, alive: s.alive });
      if (talk) a.facing = -1;
      const v = makeView(def.look); v.setWeapon(WEAPONS[a.weapon].mesh);
      this.add(a, v); this.squad.push(a);
      if (!a.alive) v.root.visible = false;
    });
    this.controlled = save?.controlled ?? 0;
    if (!this.squad[this.controlled]?.alive) this.controlled = Math.max(0, this.squad.findIndex((s) => s.alive));
    if (level.kind === 'camp') this.controlled = 0;
    this.squad.forEach((a, i) => {
      const talk = start?.def?.talks?.find((t) => t.who === a.survivor!.id);
      this.brains.set(a.id, i === this.controlled ? this.player : talk ? new StationBrain(start!.x0 + talk.dx) : new SquadBrain());
    });
    // infected: the street's, then each room's (same rules, same brains)
    const spawns = [...level.infected, ...this.zones.flatMap((z) => (z.def?.infected ?? []).map((d) => ({ ...d, x: z.x0 + d.dx })))];
    for (const d of spawns) if (!this.killed.has(d.id)) { const a = this.spawnInfected(d.type, d.x, d.id); a.state = d.state; a.facing = d.facing ?? (this.rng.chance(0.5) ? 1 : -1); }
    // interactables
    const glint = (id: string, x: number) => { const m = lootSpot(hashString(id)); m.position.set(x, 0, -0.95); r.scene.add(m); this.lootSpots.set(id, m); };
    for (const c of level.caches) {
      if (c.room) { this.interactables.push({ id: c.id, x: c.x, label: c.label, kind: 'door', room: c.room, time: 0 }); if (!this.roomEmpty(c.room)) glint(c.id, c.x); }
      else if (!this.looted.has(c.id)) { this.interactables.push({ id: c.id, x: c.x, label: c.label, kind: 'cache', loot: c.loot, time: c.time, noise: c.noise, style: c.style }); glint(c.id, c.x); }
    }
    for (const z of this.zones) {
      const d = z.def; if (!d) continue;
      if (d.kind !== 'safehouse') this.interactables.push({ id: `${d.id}:exit`, x: z.x0 + 1.0, label: 'Leave', kind: 'exit', time: 0 });
      d.spots.forEach((sp, i) => { const id = `${d.id}:${i}`; if (this.looted.has(id)) return; this.interactables.push({ id, x: z.x0 + sp.dx, label: sp.label, kind: 'cache', loot: sp.loot, note: sp.note, time: sp.loot ? 1.6 : 0.7, style: sp.style }); glint(id, z.x0 + sp.dx); });
      for (const t of d.talks ?? []) if (!this.seenBeats.has(`talk:${t.knot}`)) this.interactables.push({ id: `talk:${t.knot}`, x: z.x0 + t.dx - 0.9, label: t.label, kind: 'talk', knot: t.knot, time: 0 });
      if (d.workbench !== undefined) this.interactables.push({ id: 'workbench', x: z.x0 + d.workbench, label: 'Use the workbench', kind: 'workbench', time: 0 });
      if (d.rest) this.interactables.push({ id: 'rest', x: z.x0 + d.rest.dx, label: d.rest.label, kind: 'rest', time: 1.2 });
    }
    if (level.workbench) this.interactables.push({ id: 'workbench', x: level.workbench.x, label: 'Use workbench', kind: 'workbench', time: 0 });
    const G = level.goal;
    if (G && !this.objectives.has(G.objective)) this.interactables.push({ id: 'goal', x: G.room ? this.zones.find((z) => z.id === G.room)!.x0 + G.x : G.x, label: G.label, kind: 'goal', time: G.time });
    for (const p of level.pickups) if (!this.picked.has(p.id)) { const m = pickupMesh(p.item); m.position.set(p.x, 0.0, 0.35); r.scene.add(m); this.pickups.push({ ...p, mesh: m }); }
    if (start) { this.r.zoom = ROOM_ZOOM; this.r.lift = 0.4; }
    this.cam.snap(this.leader.x);
    for (const a of [...this.squad, ...this.infected]) this.updateActorView(a, 1);
  }

  /** Switch the whole look (level load, walking through a door). */
  setMood(id: MoodId): void {
    this.mood = MOODS[id];
    applyMood(this.mood, this.r, this.lights, this.built.group);
    this.haze.set(this.mood.fog, this.mood.haze);
    this.applyPrefs();
  }
  applyPrefs(): void {
    this.rain.enabled = this.mood.rain && this.prefs.rain;
    this.wet.setEnabled(this.mood.wet && this.prefs.reflections);
    audio.setRain(this.rain.enabled);
  }

  /** Create an infected actor with its body and brain (level load, and bosses calling for help). */
  spawnInfected(type: InfectedType, x: number, id: string): Actor {
    const a = new Actor({ x, infected: type }); a.levelId = id;
    const look = infectedLook(INFECTED[type].body ?? (type as 'common'), Math.round(x * 13) + hashString(id) % 97);
    if (type === 'warden') Object.assign(look, { top: 0x1c2430, shirt: 0x1c2430, pants: 0x161c24, skin: 0x8a9088 });
    if (type === 'host') Object.assign(look, { top: 0xbfc4c0, shirt: 0xbfc4c0, pants: 0x8a9290, skin: 0xd6d2c8 });
    this.add(a, makeView(look, a.scale)); this.infected.push(a); this.brains.set(a.id, new InfectedBrain());
    return a;
  }
  /** Every searchable spot of a room is already empty (its street door stops glinting). */
  private roomEmpty(id: string): boolean { const d = this.level.rooms.find((q) => q.id === id); return !d || d.spots.every((_, i) => this.looted.has(`${id}:${i}`)); }
  zoneAt(x: number): Zone { for (const z of this.zones) if (x >= z.x0 - 2 && x <= z.x1 + 2) return z; return this.zones[0]; }
  bounds(x: number): [number, number] { const z = this.zoneAt(x); return [z.x0, z.x1]; }
  get camp(): boolean { return this.level.kind === 'camp'; }
  /** The boss the squad is fighting right now (HUD bar, music), if any. */
  get boss(): Actor | null {
    for (const z of this.infected) if (z.alive && z.isBoss && this.zoneAt(z.x) === this.zone && (z.state === 'chase' || z.state === 'stagger' || Math.abs(z.x - this.leader.x) < 9) && z.state !== 'dormant') return z;
    return null;
  }
  summon(by: Actor, types: InfectedType[]): void {
    const [x0, x1] = this.bounds(by.x);
    types.forEach((t, i) => { const a = this.spawnInfected(t, i % 2 ? x0 + 1 + i * 0.5 : x1 - 1 - i * 0.5, `sum${this.summoned++}`); a.state = 'chase'; a.targetId = this.leader.id; a.suspicion = 1; this.updateActorView(a, 1); });
    this.cam.addTrauma(0.6); this.fx.dust(by.x, 0.05, 14); this.toast(`${by.name} calls the others`, 'warn');
  }
  /** A charging boss connects: everyone in its path is thrown back. */
  ram(z: Actor): void {
    let hit = false;
    for (const sv of this.squad) { if (!sv.alive) continue; const dx = (sv.x - z.x) * z.chargeDir; if (dx > -0.4 && dx < z.infected!.reach + 0.5) { hit = true; this.fx.blood(sv.x, 1.3, z.chargeDir, 0.8); this.hurt(sv, z.infected!.damage * 1.4, z.chargeDir, 14, z); if (sv === this.leader) this.ev.emit('hurt', { amount: 40 }); } }
    audio.play('hitConcrete', z.x, 1); this.fx.dust(z.x + z.chargeDir, 0.05, 10); this.cam.addTrauma(hit ? 0.8 : 0.4); if (hit) { audio.play('hurt', z.x, 1); this.ev.emit('hitStop', { seconds: 0.12 }); }
  }

  private add(a: Actor, v: View): void { this.r.scene.add(v.root); this.views.set(a.id, v); this.poses.set(a.id, zeroPose()); }

  // ------------------------------------------------------------------ AIWorld
  get leader(): Actor { return this.squad[this.controlled]; }
  get x0() { return this.zone.x0; } get x1() { return this.zone.x1; }
  slot(a: Actor): number { let k = 0; for (const s of this.squad) { if (s === this.leader) continue; if (s === a) return k; if (s.alive) k++; } return k; }
  lightAt(x: number): number { return this.lights.lightAt(x); }
  medical(): number { return this.stash.count('medkit') + this.stash.count('bandage'); }
  ammoFor(a: Actor): number { const t = WEAPONS[a.weapon].ammo; return t ? this.ammo(t) : 0; }
  weaponsFree(): boolean { return this.alert || this.time - this.lastShot < 6; }
  cry(z: Actor): void { const loud = z.type === 'runner' || z.type === 'screamer' || z.type === 'hound'; this.sfx(loud ? 'shriek' : z.isBoss ? 'bruteRoar' : 'groan', z.x, loud || z.isBoss ? 1 : 0.8); if (z.isBoss) this.cam.addTrauma(0.35); this.noise(z.x, z.type === 'screamer' ? NOISE.shout * 1.6 : loud ? NOISE.shout : 7, z, true); }
  groan(z: Actor): void { this.sfx(z.isBoss ? 'bruteRoar' : 'groan', z.x, z.isBoss ? 0.7 : 0.55); }

  // ------------------------------------------------------------------ Host
  /** Story mode (default): reserve ammo never runs out and only attacks hurt; Survival keeps scarcity and needs. */
  story = true;
  private endless(t: ItemId): boolean { return this.story && t.startsWith('ammo_'); }
  ammo(t: ItemId): number { return this.endless(t) ? 999 : this.stash.count(t); }
  take(t: ItemId, n: number): number { if (this.endless(t)) return n; const k = this.stash.take(t, n); this.ev.emit('stash', {}); return k; }
  sfx(kind: Sfx | 'dryfire' | 'reload' | 'heal' | 'throw', ax: Actor | number, vol = 1): void {
    const x = typeof ax === 'number' ? ax : ax.x;
    audio.play(kind as Sfx, x, typeof ax === 'number' ? vol : ax === this.leader ? 1 : 0.6);
    if (kind === 'reload' && typeof ax !== 'number') this.noise(ax.x, NOISE.reload, null);
  }
  footstep(a: Actor): void {
    if (a.team === 'squad') {
      if (Math.abs(a.x - this.leader.x) < 9) audio.play(this.rain.enabled ? 'stepWet' : 'step', a.x, a.running ? 0.9 : a.crouching ? 0.25 : 0.5);
      if (this.rain.enabled && Math.random() < 0.6) this.fx.splash(a.x + a.facing * 0.1, 0.05);
      this.noise(a.x, a.crouching ? NOISE.crouch : a.running ? NOISE.run : NOISE.walk, null, a === this.leader);   // only your own steps are drawn
    } else if (a.isBoss) { audio.play('hitConcrete', a.x, 0.8); this.cam.addTrauma(Math.max(0, 0.12 - Math.abs(a.x - this.leader.x) * 0.01)); }
  }

  /** Noise stimulus: infected within radius × hearing investigate (stealth through sound). */
  noise(x: number, radius: number, src: Actor | null, show = true): void {
    if (radius <= 0) return;
    if (show && Math.abs(x - this.cam.x) < this.r.halfWidth + radius) this.fx.noiseRing(x, radius, radius >= 15);
    for (const z of this.infected) {
      if (!z.alive || z === src) continue;
      const d = Math.abs(z.x - x), rr = radius * z.infected!.hearing;
      if (d < rr) (this.brains.get(z.id) as InfectedBrain).hear(z, x, 1 - d / rr);
    }
  }

  fire(a: Actor): void {
    const w = WEAPONS[a.weapon], v = this.views.get(a.id)!;
    v.root.updateMatrixWorld(true);
    const m = v.muzzle() ?? new THREE.Vector3(a.x + a.facing * 0.8, 1.35, 0.15);
    audio.play(w.sfx, a.x, a === this.leader ? 1 : 0.75);
    this.fx.muzzle(m, w.pellets > 1 ? 1.5 : 1.0); this.fx.casing(a.x + a.facing * 0.15, m.y, a.facing, w.pellets > 1);
    this.fx.puff(m.x, m.y, m.z, { size: w.pellets > 1 ? 0.35 : 0.22, vx: a.facing * 0.4, vy: 0.35, life: 1.1, alpha: 0.28 });
    this.lights.transient.push({ x: m.x, y: m.y, z: m.z + 0.4, color: 0xffc070, intensity: 18, distance: 9, t: 0.06 });
    this.noise(a.x, w.noise, null);
    if (a === this.leader) { this.lastShot = this.time; this.cam.addTrauma(w.trauma); this.shotsFired++; }
    for (let k = 0; k < w.pellets; k++) {
      const ang = (this.rng.next() - 0.5) * 2 * w.spread * (a.aimed ? 1 : 1.8);
      this.hitscan(a, m.x, m.y, a.facing, ang, w.range, w.damage * (a === this.leader ? 1 : 0.55), w.knock, m.z);   // the squad backs you up; it does not win the fight for you
    }
  }

  /** Bullet: nearest of {infected/survivor hitbox, physics prop/ragdoll/ground}. */
  private hitscan(src: Actor, x0: number, y0: number, dir: number, ang: number, range: number, dmg: number, knock: number, z0: number): void {
    const dx = Math.cos(ang) * dir, dy = Math.sin(ang), x1 = x0 + dx * range, y1 = y0 + dy * range;
    let best = 1, target: Actor | null = null;
    for (const z of src.team === 'squad' ? this.infected : this.squad) {
      if (!z.alive) continue;
      const half = 0.2 * z.scale, edge = dir > 0 ? z.x - half : z.x + half, t = (edge - x0) / (x1 - x0);
      if (t < 0 || t > best) continue;
      const yAt = y0 + (y1 - y0) * t;
      if (yAt < 0.05 || yAt > z.height) continue;
      best = t; target = z;
    }
    const hit = raycast(this.world, { x: x0, y: y0 }, { x: x0 + (x1 - x0) * best, y: y0 + (y1 - y0) * best }, CAT.GROUND | CAT.PROP | CAT.RAGDOLL);
    const from = new THREE.Vector3(x0, y0, z0);
    if (hit) {
      this.fx.tracer(from, new THREE.Vector3(hit.point.x, hit.point.y, 0));
      const b = hit.body;
      if (b.isDynamic()) kick(b, dir * (hit.tag.kind === 'ragdoll' ? knock * 0.5 : Math.min(3, (knock * 6) / Math.max(5, b.getMass()))), 0.6, hit.point);
      this.impact(hit.tag, hit.point.x, hit.point.y, -dir, hit.normal);
      return;
    }
    const tx = x0 + (x1 - x0) * best, ty = y0 + (y1 - y0) * best;
    this.fx.tracer(from, new THREE.Vector3(tx, ty, 0));
    if (target) { this.fx.blood(tx, ty, dir, target.isBoss ? 1.4 : 1); audio.play('hitFlesh', tx, 0.6); this.hurt(target, dmg, dir, knock, src); }
  }

  private impact(tag: Tag, x: number, y: number, dir: number, n: { x: number; y: number }): void {
    if (tag.material === 'wood') { this.fx.splinters(x, y, dir); audio.play('hitWood', x, 0.7); }
    else if (tag.material === 'flesh') this.fx.blood(x, y, -dir, 0.5);
    else if (tag.material === 'glass') { this.fx.glass(x, y); audio.play('glassBreak', x, 0.6); }
    else { this.fx.sparks(x, y, n.x, n.y); audio.play(tag.material === 'metal' ? 'hitMetal' : 'hitConcrete', x, 0.5); if (tag.kind === 'ground') this.fx.dust(x, 0.02, 4); }
    this.noise(x, NOISE.impact, null);
  }

  meleeHit(a: Actor): void {
    const w = WEAPONS.pipe, knock = w.knock * (a.survivor?.role === 'mechanic' ? 1.7 : 1);
    audio.play('melee', a.x, 0.8); this.noise(a.x, NOISE.melee, null);
    let hit = false;
    for (const z of this.infected) {
      if (!z.alive) continue;
      const dx = (z.x - a.x) * a.facing;
      if (dx > -0.2 && dx < w.range * a.scale) {
        hit = true;
        // stealth takedown: unaware or dormant targets take heavy damage (rewards sneaking)
        const unaware = z.state === 'dormant' || z.state === 'waking' || (z.state !== 'chase' && (a.crouching || Math.sign(z.facing) === Math.sign(a.facing)));
        this.fx.blood(z.x - a.facing * 0.1, 1.35 * z.scale, a.facing, 0.8); audio.play('hitFlesh', z.x, 0.9);
        this.hurt(z, w.damage * (unaware ? 3 : 1), a.facing, knock, a);
        if (unaware && a === this.leader) this.ev.emit('hitStop', { seconds: 0.08 });
      }
    }
    const aabb = new planck.AABB({ x: a.x + (a.facing > 0 ? 0 : -w.range), y: 0.1 }, { x: a.x + (a.facing > 0 ? w.range : 0), y: 1.8 });
    this.world.queryAABB(aabb, (f) => { const b = f.getBody(); if (b.isDynamic()) { kick(b, a.facing * Math.min(4, (knock * 14) / Math.max(4, b.getMass())), 1.5); hit = true; } return true; });
    if (hit && a === this.leader) this.cam.addTrauma(w.trauma);
  }

  clawHit(z: Actor): void {
    const d = z.infected!;
    for (const s of this.squad) {
      if (!s.alive) continue;
      const dx = (s.x - z.x) * z.facing;
      if (dx > -0.25 && dx < d.reach + 0.15) {
        this.fx.blood(s.x, 1.3, z.facing, 0.6); audio.play('hurt', s.x, 0.8);
        this.hurt(s, d.damage, z.facing, z.isBoss ? 9 : 3, z);
        if (s === this.leader) { this.ev.emit('hurt', { amount: d.damage }); this.cam.addTrauma(z.isBoss ? 0.6 : 0.3); this.ev.emit('hitStop', { seconds: z.isBoss ? 0.1 : 0.04 }); }
        if (!z.isBoss) break;
      }
    }
  }

  private hurt(t: Actor, dmg: number, dir: number, knock: number, src: Actor): void {
    if (this.camp) return;
    t.damage(dmg, dir, knock);
    if (t.team === 'infected' && t.alive && t.state !== 'chase') { t.state = 'chase'; t.stateT = 0; t.targetId = src.id; t.suspicion = 1; }
    if (!t.alive) this.kill(t, dir, knock);
  }

  private kill(t: Actor, dir: number, knock: number): void {
    const v = this.views.get(t.id)!, pose = this.poses.get(t.id)!;
    const rd = createRagdoll(this.world, pose, t.x, 0, t.facing, t.scale, { x: t.vx + t.knock, y: 0 }, t.infected?.density ?? 1);
    shove(rd, dir, Math.min(5, 0.8 + knock * 0.35) * ((t.infected?.poise ?? 1) < 0.5 ? 0.5 : 1));
    v.ragdolled = true; v.flash(0);
    this.corpses.push({ actor: t, rd, view: v, age: 0 });
    if (t.team === 'infected') { this.killed.add(t.levelId); audio.play('death', t.x, 0.5); if (t.isBoss) { this.cam.addTrauma(0.9); this.ev.emit('hitStop', { seconds: 0.3 }); this.ev.emit('bossDown', { name: t.name }); } }
    else {
      audio.play('death', t.x, 1);
      this.ev.emit('death', { name: t.name, player: t === this.leader });
      if (t === this.leader) { const n = this.squad.findIndex((s) => s.alive); if (n >= 0) this.switchTo(n); }
    }
    const live = this.corpses.filter((c) => c.age < 600);
    if (live.length > 14) live[0].age = 600;
  }

  heal(a: Actor): boolean {
    let target = a;
    if (a.survivor?.role === 'medic') { const near = this.squad.filter((s) => s.alive && Math.abs(s.x - a.x) < 1.8).sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp)[0]; if (near) target = near; }
    const missing = target.maxHp - target.hp;
    const item: ItemId | null = (missing <= 30 || target.bleed > 0) && this.stash.count('bandage') ? 'bandage' : this.stash.count('medkit') ? 'medkit' : this.stash.count('bandage') ? 'bandage' : null;
    if (!item) { if (a === this.leader) this.toast('No medical supplies', 'warn'); return false; }
    this.stash.take(item, 1);
    const amount = Math.round((item === 'medkit' ? (a.survivor?.role === 'medic' ? 75 : 55) : 22) * (1 + 0.3 * (this.upg.medicine ?? 0)));
    target.hp = Math.min(target.maxHp, target.hp + amount); target.bleed = 0;
    this.toast(`${a.name} used ${ITEMS[item].name}${target !== a ? ` on ${target.name}` : ''} (+${amount})`, 'info');
    this.ev.emit('stash', {});
    return true;
  }

  throwLure(a: Actor, targetX: number): void {
    if (!this.stash.take('bottle', 1)) return;
    this.ev.emit('stash', {});
    const sx = a.x + a.facing * 0.3, dx = targetX - sx, t = 0.75;
    const body = this.world.createDynamicBody({ position: { x: sx, y: 1.6 }, bullet: true, linearVelocity: { x: dx / t, y: 11 * t * 0.5 + 0.5 }, angularVelocity: -a.facing * 12 });
    body.createFixture(new planck.Circle(0.06), { density: 20, filterCategoryBits: CAT.LURE, filterMaskBits: CAT.GROUND | CAT.PROP, userData: { kind: 'lure', material: 'glass' } as Tag });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.24, 8), new THREE.MeshStandardMaterial({ color: 0x3f6a3a, roughness: 0.1, transparent: true, opacity: 0.8 })   /* no transmission: it adds a full extra scene render per frame */);
    this.r.scene.add(mesh); this.lures.push({ body, mesh, t: 0, broke: false });
  }

  // ------------------------------------------------------------------ control & interactions
  switchTo(i: number): void {
    if (i < 0 || i >= this.squad.length || !this.squad[i].alive || i === this.controlled || this.camp) return;
    this.brains.set(this.leader.id, new SquadBrain());
    this.controlled = i; this.player.crouch = this.leader.crouching;
    this.brains.set(this.leader.id, this.player);
    this.using = null;
    this.ev.emit('switched', { index: i });
  }

  private commands(f: InputFrame): void {
    for (let k = 1; k <= 4; k++) if (f.pressed.has(`slot${k}` as 'slot1')) this.switchTo(k - 1);
    if (f.pressed.has('nextSurvivor')) for (let k = 1; k <= 4; k++) { const j = (this.controlled + k) % 4; if (this.squad[j].alive) { this.switchTo(j); break; } }
    if (f.pressed.has('squad') && !this.camp) { this.hold = { on: !this.hold.on, x: this.leader.x }; this.toast(this.hold.on ? 'Squad: HOLD here' : 'Squad: FOLLOW me', 'info'); }
    const L = this.leader;
    this.focus = null; let bd = 1.1;
    for (const it of this.interactables) { const d = Math.abs(it.x - L.x); if (d < bd) { bd = d; this.focus = it; } }
    const F = this.focus;
    if (f.pressed.has('interact') && F && !this.using && !this.fading) {
      const G = this.level.goal;
      if (F.kind === 'workbench') { this.ev.emit('dialogue', { knot: '__craft' }); return; }
      if (F.kind === 'door') { this.enterRoom(F.room!); return; }
      if (F.kind === 'exit') { this.leaveRoom(); return; }
      if (F.kind === 'talk') { this.seenBeats.add(F.id); this.interactables = this.interactables.filter((i) => i !== F); this.ev.emit('dialogue', { knot: F.knot! }); return; }
      if (F.kind === 'goal' && G) {
        const guard = G.needsDead ? this.infected.find((z) => z.levelId === G.needsDead && z.alive) : null;
        if (guard) { if (G.guardedInk) this.ev.emit('dialogue', { knot: G.guardedInk }); else this.toast(`Not while ${guard.name} is alive.`, 'warn'); return; }
        if (G.needs && !this.stash.count(G.needs)) { if (G.lockedInk) this.ev.emit('dialogue', { knot: G.lockedInk }); this.ev.emit('objective', { id: 'o_fuse', done: false }); return; }
      }
      this.using = F; this.progress = 0;
      if (F.noise) this.noise(L.x, F.noise, null);
      audio.play('search', L.x, 0.6);
    }
    if (this.using && (Math.abs(f.moveX) > 0.1 || f.held.has('fire') || f.pressed.has('melee') || this.using !== this.focus)) this.using = null;
  }

  private stepUse(dt: number): void {
    const u = this.using; if (!u) { this.progress = 0; return; }
    const speed = this.leader.survivor?.role === 'scavenger' ? 1.5 : 1;
    this.progress += (dt / Math.max(u.style ? 2.2 : 0.1, u.time)) * speed;   // close-ups last long enough to read
    if (this.progress < 1) return;
    this.using = null; this.progress = 0;
    this.interactables = this.interactables.filter((i) => i !== u);
    if (u.kind === 'goal') {
      const G = this.level.goal!;
      if (G.needs) this.stash.take(G.needs, 1);
      this.setObjective(G.objective, true);
      audio.play('radioStatic');
      this.ended = true;
      this.ev.emit('dialogue', { knot: G.doneInk, then: 'complete' });
      return;
    }
    if (u.kind === 'rest') { this.ended = true; this.ev.emit('complete', {}); return; }
    this.looted.add(u.id);
    const spot = this.lootSpots.get(u.id); if (spot) { spot.getObjectByName('glint')?.removeFromParent(); this.lootSpots.delete(u.id); }   // emptied: box stays, glint goes
    const loot = { ...u.loot } as Loot;
    if (u.loot && this.leader.survivor?.role === 'scavenger') { const b = this.rng.pick<ItemId>(['ammo_9mm', 'scrap', 'cloth', 'bandage', 'water']); loot[b] = (loot[b] ?? 0) + (b === 'ammo_9mm' ? 6 : 1); }
    const got: string[] = [], left: string[] = [];
    for (const [k, n] of Object.entries(loot) as [ItemId, number][]) { const a = this.stash.add(k, n); if (a) got.push(`+${a} ${ITEMS[k].name}`); if (a < n) left.push(ITEMS[k].name); }
    if (u.loot) { audio.play('pickup'); this.toast(got.join('  ') || 'Nothing you can carry', 'loot'); }
    if (left.length) this.toast(`Too heavy — left behind: ${left.join(', ')}`, 'warn');
    if (u.note) { this.notes.add(u.note); this.ev.emit('note', { id: u.note }); }
    this.ev.emit('stash', {});
    // a room's street door stops glinting once the room is empty
    const room = this.zone.def;
    if (room && this.roomEmpty(room.id)) { const door = this.level.caches.find((c) => c.room === room.id); const g = door && this.lootSpots.get(door.id); if (door && g) { g.getObjectByName('glint')?.removeFromParent(); this.lootSpots.delete(door.id); } }
    if (!this.objectives.has('o_supplies') && this.looted.size >= 4) this.setObjective('o_supplies', true);
  }

  setObjective(id: string, done: boolean): void { if (done) this.objectives.add(id); this.ev.emit('objective', { id, done }); }

  /** Workbench upgrades: paid in scrap, permanent for the campaign. */
  upgradeCost(id: UpgradeId): number | null { const lv = this.upg[id] ?? 0, c = UPGRADES[id].cost; return lv < c.length ? c[lv] : null; }
  buyUpgrade(id: UpgradeId): boolean {
    const cost = this.upgradeCost(id);
    if (cost === null || this.stash.count('scrap') < cost) { this.toast(cost === null ? 'Already at its best' : 'Not enough scrap', 'warn'); return false; }
    this.stash.take('scrap', cost); this.upg[id] = (this.upg[id] ?? 0) + 1;
    applyUpgrades(this.upg); this.stash.limit = CARRY_LIMIT + 6 * (this.upg.pack ?? 0);
    if (id === 'vitality') for (const sv of this.squad) { sv.maxHp += 15; if (sv.alive) sv.hp += 15; }
    audio.play('craft'); this.toast(`${UPGRADES[id].name} — level ${this.upg[id]}`, 'loot'); this.ev.emit('stash', {});
    return true;
  }

  /** Crafting at the workbench (atomic; role-gated). */
  craft(id: string): boolean {
    const r = RECIPES.find((x) => x.id === id)!;
    const roles = this.squad.filter((s) => s.alive).map((s) => s.survivor!.role) as Role[];
    const res = this.stash.canCraft(r, roles);
    if (!res.ok) { this.toast(res.why ?? 'Cannot craft', 'warn'); return false; }
    this.stash.craft(r, roles); audio.play('craft');
    this.toast(`Crafted ${r.name}`, 'loot'); this.ev.emit('stash', {});
    if (r.output[0] === 'radio_part') this.setObjective('o_fuse', true);
    return true;
  }

  /** Eat / drink for a survivor from the stash. */
  consume(a: Actor, item: 'food' | 'water'): void {
    if (!this.stash.take(item, 1)) { this.toast(`No ${ITEMS[item].name}`, 'warn'); return; }
    if (item === 'food') a.hunger = Math.min(1, a.hunger + 0.55); else a.thirst = Math.min(1, a.thirst + 0.6);
    audio.play('pickup'); this.ev.emit('stash', {});
  }

  toast(text: string, kind: 'loot' | 'info' | 'warn' = 'info'): void { this.ev.emit('toast', { text, kind }); }

  // ------------------------------------------------------------------ simulation
  tick(dt: number, f: InputFrame | null): void {
    this.time += dt;
    if (f && this.camp) { f.held.delete('fire'); f.held.delete('run'); for (const k of ['melee', 'throw', 'heal', 'crouch', 'reload'] as const) f.pressed.delete(k); }   // the safehouse is safe
    if (f && !this.ended) this.commands(f);
    // first sub-step gets the full frame; later sub-steps keep held state but no repeated one-shots
    if (this.ended) this.player.frame = null;
    else if (f) this.player.frame = f;
    for (const a of [...this.squad, ...this.infected]) {
      if (!a.alive) continue;
      const it: Intent = this.ended && a.team === 'squad' ? idle() : this.brains.get(a.id)!.think(a, this, dt);
      const [bx0, bx1] = this.bounds(a.x);
      a.step(dt, it, this, bx0, bx1);
    }
    if (this.player.frame) this.player.frame = { ...this.player.frame, pressed: new Set() };
    this.stepUse(dt);
    this.stepNeeds(dt);
    this.stepPickups();
    this.stepLures(dt);
    if (!this.zone.def) this.stepBeats();
    const hunting = this.infected.filter((z) => z.alive && z.state === 'chase').length;
    if ((hunting > 0) !== this.alert) { this.alert = hunting > 0; this.ev.emit('alert', { on: this.alert }); if (this.alert) { audio.play('alert'); audio.stinger(); } }
    const suspicious = Math.max(0, ...this.infected.filter((z) => z.alive && Math.abs(z.x - this.leader.x) < 18).map((z) => z.suspicion));
    this.intensity = Math.max((this.beat?.intensity ?? 0.1) * 0.35, this.alert ? 0.7 + Math.min(0.3, hunting * 0.06) : suspicious * 0.55);
    if (!this.zone.def) for (const cp of this.level.checkpoints) if (this.leader.x > cp && this.checkpointX < cp && !this.alert) { this.checkpointX = cp; this.ev.emit('checkpoint', { x: cp }); }
    this.world.step(dt, 8, 3);
    for (const c of this.corpses) c.age += dt;
    if (!this.ended && this.squad.every((s) => !s.alive)) { this.ended = true; this.ev.emit('gameover', {}); }
  }

  private stepNeeds(dt: number): void {
    for (const s of this.squad) {
      if (!s.alive) continue;
      if (this.story) { s.bleed = 0; continue; }                     // story: health only drops when attacked
      s.hunger = Math.max(0, s.hunger - NEEDS.hungerRate * dt); s.thirst = Math.max(0, s.thirst - NEEDS.thirstRate * dt);
      let dps = 0;
      if (s.hunger === 0 || s.thirst === 0) dps += NEEDS.starveDps;
      if (s.bleed > 0) { dps += NEEDS.bleedDps * s.bleed; if (Math.random() < dt * 2) this.fx.blood(s.x, 0.4, 0, 0.1); }
      if (dps) { s.hp -= dps * dt; if (s.hp <= 0) { s.hp = 0; s.alive = false; this.kill(s, s.facing, 0.5); } }
      else if (s.hunger > 0.3 && s.thirst > 0.3 && !this.alert && s.hp < s.maxHp * 0.6) s.hp = Math.min(s.maxHp * 0.6, s.hp + NEEDS.regenHps * dt);
    }
  }
  private stepPickups(): void {
    for (const p of this.pickups) {
      if (this.picked.has(p.id) || !this.squad.some((s) => s.alive && Math.abs(s.x - p.x) < 0.5)) continue;
      const got = this.stash.add(p.item, p.qty);
      if (!got) { continue; }
      this.picked.add(p.id); p.mesh.visible = false;
      audio.play('pickup', p.x); this.toast(`+${got} ${ITEMS[p.item].name}`, 'loot'); this.ev.emit('stash', {});
    }
  }
  private stepLures(dt: number): void {
    for (const l of this.lures) {
      l.t += dt;
      const p = l.body.getPosition();
      if (!l.broke && (p.y < 0.12 || (l.t > 0.15 && l.body.getLinearVelocity().length() < 2))) {
        l.broke = true; this.fx.glass(p.x, p.y); audio.play('glassBreak', p.x, 1); this.noise(p.x, NOISE.bottle, null);
        this.world.destroyBody(l.body); this.r.scene.remove(l.mesh);
      }
    }
    this.lures = this.lures.filter((l) => !l.broke);
  }
  private stepBeats(): void {
    const x = this.leader.x;
    const b = this.level.beats.find((q) => x >= q.x0 && x < q.x1) ?? null;
    if (b && b !== this.beat) {
      this.beat = b; this.ev.emit('beat', { beat: b });
      if (b.ink && !this.seenBeats.has(b.id)) { this.seenBeats.add(b.id); this.ev.emit('dialogue', { knot: b.ink }); }
    }
  }

  /** Strongest detection pressure on the leader (HUD stealth eye). */
  detection(): number { let m = 0; for (const z of this.infected) if (z.alive && Math.abs(z.x - this.leader.x) < 16) m = Math.max(m, z.state === 'chase' ? 1 : z.suspicion); return m; }

  // ------------------------------------------------------------------ presentation (render frame)
  update(dt: number, alpha: number): void {
    void alpha;
    const L = this.leader;
    const inRoom = !!this.zone.def;
    this.cam.update(dt, L.x, L.facing, L.vx, this.r.halfWidth, this.zone.x0 - (inRoom ? 1.2 : 0), this.zone.x1 + (inRoom ? 1.2 : 0), this.time);
    this.r.focus.set(this.cam.x, inRoom ? 1.5 : 2.0, 0);
    // camera moments per beat + trailing yaw while moving (2.5D parallax)
    // small searchables get a close-up shot on the hands (T11)
    if (this.using?.style) this.shot = { x: this.using.x, until: this.time + 0.9 };   // hold the shot a beat after the search ends
    const close = this.shot && this.time < this.shot.until ? { zoom: 0.52, lift: -0.55 } : null;
    if (close) this.r.focus.x += (this.shot!.x - this.r.focus.x) * 0.5;
    const k = 1 - Math.exp(-(close ? 3 : 1.6) * dt), cm = close ?? (inRoom ? { zoom: ROOM_ZOOM, lift: 0.4 } : this.beat?.cam);
    this.r.zoom += ((cm?.zoom ?? 1) - this.r.zoom) * k;
    this.r.lift += ((cm?.lift ?? 0) - this.r.lift) * k;
    this.r.swing += (L.vx * 0.5 - this.r.swing) * (1 - Math.exp(-2.2 * dt));
    this.r.shakeOffset.set(this.cam.offset.x, this.cam.offset.y, this.cam.offset.roll);
    audio.listenerX = this.cam.x;
    this.lights.update(this.cam.x, this.time);
    this.rain.update(dt, this.cam.x); this.haze.update(dt, this.cam.x);
    for (const s of this.rain.splashes) if (Math.random() < 0.25) this.fx.splash(s.x, s.z);
    this.fx.update(dt);
    for (const a of [...this.squad, ...this.infected]) if (a.alive) this.updateActorView(a, dt);
    this.corpses = this.corpses.filter((c) => {
      c.view.root.visible = Math.abs(partPivot(c.rd, 'torso').x - this.cam.x) < this.r.halfWidth + 3;
      if (c.view.root.visible) c.view.poseFromBodies((p) => partPivot(c.rd, p), c.rd.facing);
      if (c.age > 600) { c.view.setOpacity(Math.max(0, 1 - (c.age - 600) / 2)); if (c.age > 602) { destroyRagdoll(this.world, c.rd); this.r.scene.remove(c.view.root); c.view.dispose(); return false; } }
      return true;
    });
    for (const p of this.built.props) { const b = p.body.getPosition(); p.mesh.position.set(b.x, b.y - p.half[1], p.z); p.mesh.rotation.z = p.body.getAngle(); }
    for (const l of this.lures) { const p = l.body.getPosition(); l.mesh.position.set(p.x, p.y, 0.2); l.mesh.rotation.z = l.body.getAngle(); }
    for (const p of this.pickups) if (!this.picked.has(p.id)) { p.mesh.rotation.y += dt * 1.5; p.mesh.position.y = 0.05 + Math.sin(this.time * 2 + p.x) * 0.04; }
    if (this.built.beacon) (this.built.beacon as THREE.Mesh).visible = Math.sin(this.time * 3) > 0;
    this.built.blinkers.forEach((b, i) => { b.material.opacity = Math.sin(this.time * 2.2 + i * 1.7) > 0.2 ? 0.95 : 0.12; });
    this.wet.update(this.cam.x, this.time);
    if (!inRoom) this.ambientFx(dt);
    this.flames(dt);
    let i = 0; for (const m of this.lootSpots.values()) { const gl = m.getObjectByName('glint') as THREE.Sprite | undefined; if (gl) { const t = (this.time * 0.7 + i++ * 0.37) % 2.4; gl.material.opacity = t < 0.5 ? Math.sin((t / 0.5) * Math.PI) * 0.9 : 0; } }
    audio.setIntensity(this.intensity);
  }

  /** Candle flames breathe (sprites named 'flame' in rooms). */
  private flameList: THREE.Sprite[] | null = null;
  private flames(dt: number): void {
    void dt;
    if (!this.flameList) { this.flameList = []; this.r.scene.traverse((o) => { if (o.name === 'flame') this.flameList!.push(o as THREE.Sprite); }); }
    this.flameList.forEach((f, i) => { const n = Math.sin(this.time * 9 + i * 2.3) * Math.sin(this.time * 5.3 + i); f.material.opacity = 0.34 + n * 0.1; f.scale.setScalar(0.28 + n * 0.04); });
  }

  /** Ambient life near the camera: manhole steam, awning drips, splashes under running feet. */
  private ambientFx(dt: number): void {
    const cx = this.cam.x, hw = this.r.halfWidth + 2;
    for (let x = Math.ceil((cx - hw) / 23) * 23; x < cx + hw; x += 23) if (Math.random() < dt * 3) this.fx.puff(x + 0.3, 0.05, 3.2, { size: 0.5, vx: -0.2, vy: 0.55, life: 2.6, grow: 0.5, alpha: 0.14, color: 0xb8c4cc });
    if (this.rain.enabled) for (const b of this.level.buildings) if ((b.kind === 'store' || b.kind === 'pharmacy') && b.x < cx + hw && b.x + b.w > cx - hw && Math.random() < dt * 9) this.fx.drip(b.x + 0.6 + Math.random() * (b.w - 1.2), 3.2, FACADE_Z + 1.25);
    for (const s of this.squad) if (s.alive && s.running && Math.random() < dt * 6) this.fx.splash(s.x, 0.1);
  }

  // ------------------------------------------------------------------ rooms
  fading = false;
  private fade(then: () => void): void {
    this.fading = true;
    const el = document.createElement('div'); el.className = 'fade'; document.body.append(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; setTimeout(() => { then(); this.fading = false; el.style.opacity = '0'; setTimeout(() => el.remove(), 450); }, 380); });
  }
  /** Move the whole squad to another zone and switch the look. Infected that were hunting lose the trail. */
  private moveTo(z: Zone, x: number): void {
    for (const q of this.infected) if (q.alive && q.state === 'chase' && !q.isBoss) { q.state = 'investigate'; q.stateT = 0; q.suspicion = 0.3; q.investigateX = q.x; }
    let k = 0;
    for (const sv of this.squad) { if (!sv.alive) continue; sv.x = clampX(x - (sv === this.leader ? 0 : ++k * 0.8), z); sv.vx = 0; sv.knock = 0; }
    this.zone = z; this.using = null; this.focus = null; this.hold.on = false;
    this.setMood(z.mood); this.cam.snap(this.leader.x); this.r.zoom = z.def ? ROOM_ZOOM : 1; this.r.lift = z.def ? 0.4 : 0; this.beat = null;
    for (const a of [...this.squad, ...this.infected]) if (a.alive) this.updateActorView(a, 1);
  }
  private enterRoom(id: string): void {
    const z = this.zones.find((q) => q.id === id); if (!z || this.fading) return;
    audio.play('door', this.leader.x, 0.9);
    this.fade(() => {
      this.moveTo(z, z.x0 + 2.4);
      if (z.def?.title) this.ev.emit('place', { title: z.def.title });
      if (!z.visited) { z.visited = true; if (z.def?.ink && !this.seenBeats.has(`room:${z.id}`)) { this.seenBeats.add(`room:${z.id}`); this.ev.emit('dialogue', { knot: z.def.ink }); } }
    });
  }
  private leaveRoom(): void {
    const z = this.zone; if (!z.def || this.fading) return;
    audio.play('door', this.leader.x, 0.9);
    this.fade(() => this.moveTo(this.zones[0], z.doorX));
  }

  private updateActorView(a: Actor, dt: number): void {
    const v = this.views.get(a.id)!, pose = this.poses.get(a.id)!, w = WEAPONS[a.weapon];
    const sq = a.team === 'squad';
    const ai: AnimIn = {
      t: a.time, phase: a.phase, speed: Math.abs(a.vx), run: a.running || (!sq && a.state === 'chase'), crouch: a.crouching,
      gait: sq ? 'survivor' : a.infected!.gait, stance: sq ? w.stance : 'none', aim: a.aimed ? 1 : 0, recoil: a.recoil,
      melee: a.meleeT >= 0 ? a.meleeT / MELEE_TIME : 0, reload: a.reloadT >= 0 ? a.reloadT / w.reload : 0, heal: a.healT >= 0 ? 1 : 0,
      hurt: a.hurtT, attack: a.attackT >= 0 ? a.attackT / a.infected!.windup : 0, throwT: a.throwT >= 0 ? a.throwT / 0.6 : 0,
      dormant: !sq && a.state === 'dormant', drawn: a.drawn || a.drawT > 0.3,
      scream: a.screamT,
      task: a === this.leader && this.using ? (this.using.kind === 'goal' ? 'interact' : this.using.style === 'car' ? 'open' : this.using.style === 'shelf' ? 'pick' : 'search') : null,
    };
    targetPose(ai, this.tgt);
    blendPose(pose, this.tgt, !sq && a.state === 'waking' ? 3 : 18, dt);
    if (sq) v.setWeapon(a.meleeT >= 0 ? 'pipe' : w.mesh);
    // off-screen actors are neither drawn nor animated (skinned meshes skip frustum culling)
    v.root.visible = Math.abs(a.x - this.cam.x) < this.r.halfWidth + 3;
    if (v instanceof SkinnedView && v.root.visible) v.animate(ai, dt);
    if (a.isBoss && a.chargeT >= 0 && a.chargeT < 0.9) v.root.position.x += Math.sin(this.time * 70) * 0.03;   // wind-up tremor (telegraph)
    v.pose(pose, a.x, 0, a.facing, sq && !a.drawn && a.drawT < 0.3 && a.meleeT < 0);
    v.flash(a.hurtT * 0.6);
  }

  // ------------------------------------------------------------------ persistence
  snapshot(ink: string | null): SaveData {
    return {
      version: SAVE_VERSION, chapter: this.level.id, checkpoint: this.checkpointX, savedAt: Date.now(), stash: this.stash.toJSON(), controlled: this.controlled,
      party: this.squad.map((s) => ({ id: s.survivor!.id, hp: Math.max(s.alive ? 1 : 0, Math.round(s.hp)), alive: s.alive, mag: s.mag, hunger: s.hunger, thirst: s.thirst, bleed: s.bleed })),
      looted: [...this.looted], picked: [...this.picked], killed: [...this.killed].filter((k) => !k.startsWith('sum')), objectives: [...this.objectives], seenBeats: [...this.seenBeats], ink,
      notes: [...this.notes], upgrades: { ...this.upg }, stats: { time: this.time, shots: this.shotsFired },
    };
  }

  dispose(): void {
    this.wet.dispose(); this.haze.dispose();
    // free this level's GPU geometry (merged batches, clones) so retries do not grow memory;
    // shared materials/textures stay cached and simply re-upload if used again
    const tex = new Set<THREE.Texture>();
    this.r.scene.traverse((o) => {
      const m = o as THREE.Mesh; if (m.geometry && !(m.geometry as { userData?: { keep?: boolean } }).userData?.keep) m.geometry.dispose();
      const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
      for (const mat of mats) for (const v of Object.values(mat)) if (v instanceof THREE.Texture && !v.userData.keep) tex.add(v);
    });
    // per-level canvas textures (signs, posters, labels); the shared PBR library is marked `keep`
    tex.forEach((t) => t.dispose());
    this.r.scene.clear();
    this.ev.clear();
  }
}

const clampX = (x: number, z: Zone) => Math.max(z.x0 + 0.6, Math.min(z.x1 - 0.6, x));
