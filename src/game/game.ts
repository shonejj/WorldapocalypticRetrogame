import * as THREE from 'three';
import * as planck from 'planck';
import { animate } from 'animejs';
import { Actor, idleIntent, type ActorHost, type Intent } from './actor';
import { CompanionBrain, InfectedBrain, PlayerBrain, type AIWorld, type Brain } from './ai';
import { ITEMS, NOISE, SURVIVORS, WEAPONS, type ItemId } from './data';
import type { LevelDef, Loot } from './levels/types';
import { CAT, createWorld, rayCastClosest, STEP, type FixtureTag } from '../physics/world';
import { createSpriteRagdoll, destroySpriteRagdoll, kickAll, kickPart, type SpriteRagdoll } from '../physics/spriteRagdoll';
import { Rng, clamp, damp } from '../core/rng';
import { audio, type Sfx } from '../core/audio';
import type { Command } from '../core/input';
import { store } from '../core/storage';
import type { Renderer } from '../render/renderer';
import { WorldView } from '../render/worldView';
import { CharacterSprite } from '../render/spriteView';
import { Fx } from '../render/fx';
import { Rain } from '../render/weather';
import { CAMERA_Y } from '../render/renderer';
import { litMaterial, uploadLights, type Light } from '../render/lighting';
import { ITEM_PICKUP_TEX } from '../render/art/items';
import type { Assets, CharId } from '../render/assets';
import { KIT, PX_PER_M } from './levels/kit';

export type GameEvent =
  | { type: 'toast'; text: string; kind?: 'loot' | 'info' | 'warn' }
  | { type: 'radio'; speaker: string; text: string }
  | { type: 'alert'; on: boolean }
  | { type: 'damage'; amount: number }
  | { type: 'switch'; index: number }
  | { type: 'death'; name: string; player: boolean }
  | { type: 'gameover' }
  | { type: 'complete' }
  | { type: 'checkpoint' };

interface PropEnt { body: planck.Body; mesh: THREE.Mesh; material: 'metal' | 'wood' | 'concrete'; hp: number }
interface Corpse { actor: Actor; ragdoll: SpriteRagdoll; view: CharacterSprite; age: number }
interface Interactable { id: string; x: number; label: string; kind: 'cache' | 'goal'; loot?: Loot; time: number; noise?: number }

export interface SaveData {
  level: string; checkpoint: number; stash: Partial<Record<ItemId, number>>;
  party: { id: string; hp: number; alive: boolean; mag: Record<string, number> }[];
  looted: string[]; picked: string[]; killed: string[]; controlled: number; objectivesDone: string[];
}


export class Game implements ActorHost, AIWorld {
  readonly world: planck.World;
  readonly view: WorldView;
  readonly fx: Fx;
  readonly rain: Rain;
  readonly rng: Rng;
  readonly survivors: Actor[] = [];
  readonly infected: Actor[] = [];
  private brains = new Map<number, Brain>();
  private views = new Map<number, CharacterSprite>();
  private props: PropEnt[] = [];
  private corpses: Corpse[] = [];
  private pickups: { id: string; x: number; item: ItemId; qty: number; mesh: THREE.Mesh }[] = [];
  private interactables: Interactable[] = [];
  readonly stash: Partial<Record<ItemId, number>> = { ammo_pistol: 24, ammo_shells: 8, ammo_rifle: 10, medkit: 1, bandage: 1, food: 2, water: 2 };
  readonly portraits: string[] = [];
  readonly listeners: ((e: GameEvent) => void)[] = [];
  controlled = 0;
  holdPosition = false; holdX = 0;
  looted = new Set<string>(); picked = new Set<string>(); killed = new Set<string>();
  objectivesDone = new Set<string>();
  checkpointX: number;
  focus: Interactable | null = null;
  searchProgress = 0;
  private searching: Interactable | null = null;
  private radioDone = new Set<number>();
  private acc = 0;
  time = 0;
  alertLevel = 0;               // 0..1 how many infected hunting the squad
  private alertOn = false;
  private camX = 0; private camLead = 0;
  paused = false;
  ended = false;
  playerBrain = new PlayerBrain();
  shakeEnabled = true;
  private flashes: { light: Light; t: number }[] = [];
  private lastShots = new Map<number, number>();

  constructor(readonly r: Renderer, readonly level: LevelDef, save: SaveData | null, readonly assets: Assets) {
    this.rng = new Rng(level.seed);
    this.world = createWorld(level.width);
    this.view = new WorldView(r, level, assets);
    this.view.onLightning = () => setTimeout(() => audio.play('thunder'), 700 + Math.random() * 1500);
    this.fx = new Fx(r.scene);
    this.rain = new Rain(r.rig);
    this.checkpointX = save?.checkpoint ?? level.spawnX;
    if (save) {
      Object.assign(this.stash, save.stash);
      save.looted.forEach((x) => this.looted.add(x)); save.picked.forEach((x) => this.picked.add(x));
      save.killed.forEach((x) => this.killed.add(x)); save.objectivesDone.forEach((x) => this.objectivesDone.add(x));
    }
    this.buildSquad(save);
    this.buildInfected();
    this.buildProps();
    this.buildInteractables();
    this.camX = this.leader.x;
    r.rig.position.set(this.camX, CAMERA_Y, 0);
  }

  // ------------------------------------------------------------------ setup
  private buildSquad(save: SaveData | null): void {
    SURVIVORS.forEach((def, i) => {
      const a = new Actor({ x: this.checkpointX - i * 1.1, survivor: def });
      const s = save?.party.find((p) => p.id === def.id);
      if (s) { a.hp = s.hp; Object.assign(a.mag, s.mag); if (!s.alive) { a.alive = false; a.hp = 0; } }
      const c = this.assets.chars[def.id as CharId];
      this.portraits.push(c.portraitUrl);
      const v = new CharacterSprite(c, a.scale, 0.3 - i * 0.05);
      this.r.scene.add(v.group);
      this.views.set(a.id, v);
      this.survivors.push(a);
      if (!a.alive) v.group.visible = false;
    });
    this.controlled = save?.controlled ?? 0;
    if (!this.survivors[this.controlled]?.alive) this.controlled = this.survivors.findIndex((s) => s.alive);
    this.survivors.forEach((a, i) => this.brains.set(a.id, i === this.controlled ? this.playerBrain : new CompanionBrain()));
  }

  private buildInfected(): void {
    const looks: CharId[] = ['infected_a', 'infected_b', 'infected_c'];
    for (const def of this.level.infected) {
      if (this.killed.has(def.id)) continue;
      const a = new Actor({ x: def.x, infected: def.type });
      a.levelId = def.id; a.state = def.state; a.facing = def.facing ?? (this.rng.chance(0.5) ? 1 : -1);
      const look = def.type === 'brute' ? 'infected_c' : looks[this.rng.int(0, 2)];
      const tint = def.type === 'brute' ? 0xb8a8a0 : def.type === 'runner' ? 0xd8e0d0 : 0xffffff;
      const v = new CharacterSprite(this.assets.chars[look], a.scale, 0.12 + this.rng.range(0, 0.1), tint);
      if (def.state === 'dormant') v.lying = 1;
      this.r.scene.add(v.group); this.views.set(a.id, v);
      this.brains.set(a.id, new InfectedBrain((z) => this.cry(z), (z) => this.sfxAt('groan', z.x, z.infectedType === 'brute' ? 1.4 : 0.7)));
      this.infected.push(a);
    }
  }

  private buildProps(): void {
    for (const p of this.level.props) {
      const k = KIT[p.kind], tex = this.assets.layers[k.layer], size = this.assets.layerSize[k.layer];
      const [x0, y0, x1, y1] = k.rect, w = (x1 - x0) / PX_PER_M, h = (y1 - y0) / PX_PER_M;
      const g = new THREE.PlaneGeometry(w, h);
      const uv = g.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + uv.getX(i) * (x1 - x0)) / size.w, 1 - (y1 - uv.getY(i) * (y1 - y0)) / size.h);
      const mesh = new THREE.Mesh(g, litMaterial(tex, { alphaTest: 0.3 }));
      mesh.position.z = -0.5;
      this.r.scene.add(mesh);
      const sink = (y1 - k.ground) / PX_PER_M;
      const body = this.world.createDynamicBody({ position: { x: p.x, y: h / 2 - sink + 0.01 }, angularDamping: 0.4 });
      const material = p.kind === 'crates' ? 'wood' : 'metal';
      const tag: FixtureTag = { kind: 'prop', id: this.props.length, material };
      body.createFixture(new planck.Box(w * 0.46, h / 2 - sink * 0.5), { density: p.kind === 'cone' ? 12 : p.kind === 'barrel' ? 55 : 40, friction: 0.6, restitution: 0.1, filterCategoryBits: CAT.PROP, filterMaskBits: CAT.GROUND | CAT.PROP | CAT.RAGDOLL, userData: tag });
      this.props.push({ body, mesh, material, hp: 100 });
    }
    for (const p of this.level.pickups) {
      if (this.picked.has(p.id)) continue;
      const painter = ITEM_PICKUP_TEX(p.item);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.33).translate(0, 0.165, 0), litMaterial(painter.texture(), { alphaTest: 0.4 }));
      mesh.position.set(p.x, 0.02, 0.15); this.r.scene.add(mesh);
      this.pickups.push({ ...p, mesh });
      animate(mesh.position, { y: [0.02, 0.1], duration: 900, loop: true, alternate: true, ease: 'inOutSine' });
    }
  }

  private buildInteractables(): void {
    for (const c of this.level.caches) if (!this.looted.has(c.id)) this.interactables.push({ id: c.id, x: c.x, label: c.label, kind: 'cache', loot: c.loot, time: c.time, noise: c.noise });
    const g = this.level.goal;
    if (!this.objectivesDone.has(g.objective)) this.interactables.push({ id: 'goal', x: g.x, label: g.label, kind: 'goal', time: 2.5 });
  }

  // ------------------------------------------------------------------ queries
  get leader(): Actor { return this.survivors[this.controlled]; }
  get levelWidth(): number { return this.level.width; }
  partySlot(a: Actor): number {
    let k = 0;
    for (const s of this.survivors) { if (s === this.leader) continue; if (s === a) return k; if (s.alive) k++; }
    return k;
  }
  medkits(): number { return this.stash.medkit ?? 0; }
  lightAt(x: number): number { return this.view.lightAt(x); }
  ammo(type: ItemId): number { return this.stash[type] ?? 0; }
  ammoFor(a: Actor): number { const t = WEAPONS[a.weapon].ammo; return t ? this.ammo(t) : 0; }
  takeAmmo(type: ItemId, n: number): number { const have = this.stash[type] ?? 0, k = Math.min(have, n); this.stash[type] = have - k; return k; }
  aiFireAllowed(): boolean { return this.alertLevel > 0 || this.time - this.lastPlayerShot < 6; }
  private lastPlayerShot = -100;

  emit(e: GameEvent): void { for (const l of this.listeners) l(e); }
  private sfxAt(kind: Sfx, x: number, vol = 1): void { audio.play(kind, x, vol); }

  // ------------------------------------------------------------------ noise
  emitNoise(x: number, radius: number, source: Actor | null): void {
    if (radius <= 0) return;
    for (const z of this.infected) {
      if (!z.alive || z === source) continue;
      const d = Math.abs(z.x - x), r = radius * (z.infected?.hearing ?? 1);
      if (d < r) (this.brains.get(z.id) as InfectedBrain).hear(z, x, 1 - d / r);
    }
  }
  private cry(z: Actor): void {
    this.sfxAt('screech', z.x, z.infectedType === 'runner' ? 1 : 0.6);
    this.emitNoise(z.x, z.infectedType === 'runner' ? NOISE.shout : 7, z);
  }

  // ------------------------------------------------------------------ ActorHost
  footstep(a: Actor): void {
    const wet = this.rain.enabled;
    if (a.team === 'survivor') {
      if (a === this.leader || Math.abs(a.x - this.leader.x) < 8) this.sfxAt(wet ? 'stepWet' : 'step', a.x, a.running ? 0.9 : a.crouching ? 0.25 : 0.5);
      if (wet && Math.random() < 0.6) this.fx.splash(a.x + a.facing * 0.1);
      this.emitNoise(a.x, a.crouching ? NOISE.crouch : a.running ? NOISE.run : NOISE.walk, null);
    } else if (a.infectedType === 'brute') { this.sfxAt('impactWood', a.x, 0.6); this.shake(0.03); }
  }

  sfx(kind: 'empty' | 'reload' | 'heal', a: Actor): void {
    this.sfxAt(kind, a.x, a === this.leader ? 1 : 0.6);
    if (kind === 'reload') this.emitNoise(a.x, NOISE.reload, null);
  }

  heal(a: Actor): void {
    // medic heals the most hurt nearby teammate; others heal themselves
    let target = a;
    if (a.survivor?.role === 'medic') {
      const near = this.survivors.filter((s) => s.alive && Math.abs(s.x - a.x) < 1.6).sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp)[0];
      if (near) target = near;
    }
    const missing = target.maxHp - target.hp;
    const useBandage = missing <= 30 && (this.stash.bandage ?? 0) > 0;
    const item: ItemId | null = useBandage ? 'bandage' : (this.stash.medkit ?? 0) > 0 ? 'medkit' : (this.stash.bandage ?? 0) > 0 ? 'bandage' : null;
    if (!item) { if (a === this.leader) this.emit({ type: 'toast', text: 'No medical supplies', kind: 'warn' }); return; }
    this.stash[item] = (this.stash[item] ?? 0) - 1;
    const amt = item === 'medkit' ? (a.survivor?.role === 'medic' ? 70 : 50) : 22;
    target.hp = Math.min(target.maxHp, target.hp + amt);
    this.emit({ type: 'toast', text: `${a.name} used ${ITEMS[item].name}${target !== a ? ` on ${target.name}` : ''} (+${amt})`, kind: 'info' });
  }

  fire(a: Actor): void {
    const w = WEAPONS[a.weapon];
    const m = this.views.get(a.id)?.muzzle(a.facing);
    const muzzleY = m?.y ?? 1.32 * a.scale;
    const mx = m?.x ?? a.x + a.facing * 0.9 * a.scale;
    this.sfxAt(w.sound, a.x, a === this.leader ? 1 : 0.75);
    this.fx.muzzle(mx, muzzleY, w.pellets > 1 ? 1.3 : 0.9);
    this.flashes.push({ light: { x: mx, y: muzzleY, radius: 4.5, intensity: 2.2, color: new THREE.Color(1, 0.75, 0.4) }, t: 0.07 });
    this.fx.casing(a.x + a.facing * 0.2, muzzleY, a.facing, w.pellets > 1);
    this.emitNoise(a.x, w.noise, null);
    if (a === this.leader) { this.lastPlayerShot = this.time; this.shake(w.shake); }
    for (let k = 0; k < w.pellets; k++) {
      const ang = (this.rng.next() - 0.5) * 2 * w.spread;
      const ex = mx + a.facing * Math.cos(ang) * w.range, ey = muzzleY + Math.sin(ang) * w.range;
      this.hitscan(a, mx, muzzleY, ex, ey, w.damage, w.knockback);
    }
  }

  /** Bullet: nearest of {enemy actor, prop, ground}. */
  private hitscan(src: Actor, x0: number, y0: number, x1: number, y1: number, dmg: number, knock: number): void {
    const dir = x1 > x0 ? 1 : -1;
    let best = 1, bestActor: Actor | null = null;
    const foes = src.team === 'survivor' ? this.infected : this.survivors;
    for (const z of foes) {
      if (!z.alive) continue;
      const half = 0.2 * z.scale;
      const left = z.x - half, right = z.x + half;
      const tEnter = ((dir > 0 ? left : right) - x0) / (x1 - x0);
      if (tEnter < 0 || tEnter > best) continue;
      const yAt = y0 + (y1 - y0) * tEnter;
      if (yAt < 0.05 || yAt > z.height) continue;
      best = tEnter; bestActor = z;
    }
    const hit = rayCastClosest(this.world, { x: x0, y: y0 }, { x: x0 + (x1 - x0) * best, y: y0 + (y1 - y0) * best }, CAT.GROUND | CAT.PROP | CAT.RAGDOLL);
    if (hit) {
      this.fx.tracer(x0, y0, hit.point.x, hit.point.y);
      const tag = hit.fixture.getUserData() as FixtureTag;
      const body = hit.fixture.getBody();
      if ((tag.kind === 'prop' || tag.kind === 'ragdoll') && body.isDynamic()) { const m = body.getMass(), dv = tag.kind === 'ragdoll' ? knock * 0.35 : Math.min(3, knock * 6 / Math.max(5, m)); body.applyLinearImpulse({ x: dir * dv * m, y: dv * m * 0.25 }, hit.point, true); }
      if (tag.material === 'wood') { this.fx.splinters(hit.point.x, hit.point.y, -dir); this.sfxAt('impactWood', hit.point.x, 0.7); }
      else if (tag.material === 'flesh') this.fx.blood(hit.point.x, hit.point.y, dir, 0.5);
      else { this.fx.sparks(hit.point.x, hit.point.y, hit.normal.x, hit.normal.y); this.sfxAt('impactMetal', hit.point.x, 0.5); if (tag.kind === 'ground') this.fx.dust(hit.point.x, 0.02, 4); }
      this.emitNoise(hit.point.x, NOISE.impact, null);
      return;
    }
    const tx = x0 + (x1 - x0) * best, ty = y0 + (y1 - y0) * best;
    this.fx.tracer(x0, y0, tx, ty);
    if (bestActor) {
      this.fx.blood(tx, ty, dir, bestActor.infectedType === 'brute' ? 1.4 : 1);
      this.sfxAt('hit', tx, 0.6);
      this.hurt(bestActor, dmg, dir, knock, src);
    }
  }

  meleeStrike(a: Actor): void {
    const w = WEAPONS[a.meleeWeapon];
    const knock = w.knockback * (a.survivor?.role === 'mechanic' ? 1.6 : 1);
    this.sfxAt('melee', a.x, 0.8);
    this.emitNoise(a.x, NOISE.melee, null);
    let hitAny = false;
    for (const z of this.infected) {
      if (!z.alive) continue;
      const dx = (z.x - a.x) * a.facing;
      if (dx > -0.2 && dx < w.range * a.scale) {
        hitAny = true;
        const dormantBonus = z.state === 'dormant' || z.state === 'waking' || (z.state !== 'chase' && a.crouching) ? 2.5 : 1;   // stealth takedown
        this.fx.blood(z.x - a.facing * 0.1, 1.3 * z.scale, a.facing, 0.8);
        this.sfxAt('hit', z.x, 0.9);
        this.hurt(z, w.damage * dormantBonus, a.facing, knock, a);
      }
    }
    // knock props too
    const aabb = new planck.AABB({ x: a.x + (a.facing > 0 ? 0 : -w.range), y: 0.2 }, { x: a.x + (a.facing > 0 ? w.range : 0), y: 1.8 });
    this.world.queryAABB(aabb, (f) => {
      const t = f.getUserData() as FixtureTag;
      const b = f.getBody();
      if ((t.kind === 'prop' || t.kind === 'ragdoll') && b.isDynamic()) { const m = b.getMass(), dv = Math.min(4, (knock * 14) / Math.max(4, m)); b.applyLinearImpulse({ x: a.facing * dv * m, y: dv * m * 0.4 }, b.getWorldCenter(), true); hitAny = true; }
      return true;
    });
    if (hitAny && a === this.leader) this.shake(w.shake);
  }

  clawStrike(z: Actor): void {
    const d = z.infected!;
    for (const s of this.survivors) {
      if (!s.alive) continue;
      const dx = (s.x - z.x) * z.facing;
      if (dx > -0.25 && dx < d.reach + 0.15) {
        this.fx.blood(s.x, 1.25, z.facing, 0.6);
        this.sfxAt('hurt', s.x, 0.8);
        this.hurt(s, d.damage, z.facing, z.infectedType === 'brute' ? 9 : 3, z);
        if (s === this.leader) { this.emit({ type: 'damage', amount: d.damage }); this.shake(0.12); }
        if (z.infectedType !== 'brute') break;
      }
    }
  }

  private hurt(t: Actor, dmg: number, dir: 1 | -1, knock: number, src: Actor): void {
    t.damage(dmg, dir, knock);
    if (t.team === 'infected' && t.alive) {
      if (t.state !== 'chase') { t.state = 'chase'; t.stateT = 0; t.targetId = src.id; t.suspicion = 1; }
    }
    if (!t.alive) this.kill(t, dir, knock);
  }

  private kill(t: Actor, dir: 1 | -1, knock: number): void {
    const v = this.views.get(t.id)!;
    const rd = createSpriteRagdoll(this.world, v.c.meta, t.x, t.scale, t.facing, { x: t.vx + t.knockVx, y: 0 }, t.infected?.density ?? 1);
    v.enterRagdoll();
    const k = Math.min(5, 0.6 + knock * 0.3) * ((t.infected?.knockbackResist ?? 1) < 0.5 ? 0.5 : 1);
    kickAll(rd, { x: dir * k * 0.45, y: 0.4 });
    kickPart(rd, 'torso', { x: dir * k, y: 0.6 });
    kickPart(rd, 'head', { x: dir * k * 1.3, y: 0.8 });
    this.corpses.push({ actor: t, ragdoll: rd, view: v, age: 0 });
    if (t.team === 'infected') {
      this.killed.add(t.levelId);
      this.sfxAt('death', t.x, 0.5);
    } else {
      this.sfxAt('death', t.x, 1);
      this.emit({ type: 'death', name: t.name, player: t === this.leader });
      if (t === this.leader) {
        const next = this.survivors.findIndex((s) => s.alive);
        if (next >= 0) this.setControlled(next); else { this.ended = true; this.emit({ type: 'gameover' }); }
      }
    }
    // cap corpses: fade out oldest
    const live = this.corpses.filter((c) => c.age < 900);
    if (live.length > 14) live[0].age = 900;
  }

  // ------------------------------------------------------------------ control
  setControlled(i: number): void {
    if (i < 0 || i >= this.survivors.length || !this.survivors[i].alive || i === this.controlled) return;
    const old = this.leader;
    this.brains.set(old.id, new CompanionBrain());
    this.controlled = i;
    this.playerBrain.crouch = this.leader.crouching;
    this.brains.set(this.leader.id, this.playerBrain);
    this.searching = null;
    this.emit({ type: 'switch', index: i });
    audio.play('ui');
  }

  /** Called once per fixed tick with the player's command. */
  private applyCommand(c: Command): void {
    if (c.switchChar > 0) this.setControlled(c.switchChar - 1);
    else if (c.switchChar === -1) {
      for (let k = 1; k <= this.survivors.length; k++) { const j = (this.controlled + k) % this.survivors.length; if (this.survivors[j].alive) { this.setControlled(j); break; } }
    }
    if (c.orderHold) {
      this.holdPosition = !this.holdPosition; this.holdX = this.leader.x;
      this.emit({ type: 'toast', text: this.holdPosition ? 'Squad: HOLD position' : 'Squad: FOLLOW me', kind: 'info' });
    }
    // interaction
    const L = this.leader;
    this.focus = null;
    let bestD = 1.1;
    for (const it of this.interactables) { const d = Math.abs(it.x - L.x); if (d < bestD) { bestD = d; this.focus = it; } }
    if (c.interact && this.focus && !this.searching) { this.searching = this.focus; this.searchProgress = 0; if (this.focus.noise) this.emitNoise(L.x, this.focus.noise, null); }
    if (this.searching && (Math.abs(c.moveX) > 0.1 || c.fire || c.melee || this.searching !== this.focus)) this.searching = null;
  }

  private stepInteraction(dt: number): void {
    const s = this.searching;
    if (!s) { this.searchProgress = 0; return; }
    this.searchProgress += dt / s.time;
    if (this.searchProgress < 1) return;
    this.searching = null; this.searchProgress = 0;
    this.interactables = this.interactables.filter((i) => i !== s);
    if (s.kind === 'goal') {
      this.objectivesDone.add(this.level.goal.objective);
      audio.play('radio');
      this.emit({ type: 'radio', speaker: 'RELAY 7', text: '…emergency protocol seven… coordinates follow… if you can hear this, you are not alone…' });
      this.ended = true;
      setTimeout(() => this.emit({ type: 'complete' }), 2600);
      return;
    }
    this.looted.add(s.id);
    const loot = { ...s.loot } as Loot;
    if (this.leader.survivor?.role === 'scavenger') {        // Reed's trait
      const bonus = this.rng.pick<ItemId>(['ammo_pistol', 'scrap', 'food', 'bandage', 'water']);
      loot[bonus] = (loot[bonus] ?? 0) + (bonus === 'ammo_pistol' ? 4 : 1);
    }
    const parts: string[] = [];
    for (const [k, n] of Object.entries(loot) as [ItemId, number][]) {
      const before = this.stash[k] ?? 0;
      this.stash[k] = Math.min(ITEMS[k].max, before + n);
      parts.push(`+${this.stash[k]! - before} ${ITEMS[k].name}`);
    }
    audio.play('pickup');
    this.emit({ type: 'toast', text: parts.join('  '), kind: 'loot' });
    if (!this.objectivesDone.has('o_supplies') && this.looted.size >= 4) { this.objectivesDone.add('o_supplies'); this.emit({ type: 'toast', text: 'Objective complete: supplies scavenged', kind: 'info' }); }
  }

  // ------------------------------------------------------------------ main loop
  /** Advance the simulation with fixed steps, then update visuals. */
  update(frameDt: number, cmd: Command): void {
    if (this.paused) return;
    this.acc += Math.min(frameDt, 0.1);
    let first = true;
    while (this.acc >= STEP) {
      this.tick(STEP, first ? cmd : null);
      first = false;
      this.acc -= STEP;
    }
    this.updateView(frameDt);
  }

  private tick(dt: number, cmd: Command | null): void {
    this.time += dt;
    if (this.ended) this.playerBrain.cmd = null;
    else if (cmd) { this.applyCommand(cmd); this.playerBrain.cmd = cmd; }
    else if (this.playerBrain.cmd) this.playerBrain.cmd = heldOnly(this.playerBrain.cmd);   // extra sub-steps: no repeated one-shot actions
    for (const a of [...this.survivors, ...this.infected]) {
      if (!a.alive) continue;
      const brain = this.brains.get(a.id)!;
      const it: Intent = this.ended && a.team === 'survivor' ? idleIntent() : brain.think(a, this, dt);
      a.step(dt, it, this, this.level.width);
    }
    this.stepInteraction(dt);
    // pickups
    for (const p of this.pickups) {
      if (this.picked.has(p.id)) continue;
      if (this.survivors.some((s) => s.alive && Math.abs(s.x - p.x) < 0.45)) {
        this.picked.add(p.id); p.mesh.visible = false;
        this.stash[p.item] = Math.min(ITEMS[p.item].max, (this.stash[p.item] ?? 0) + p.qty);
        audio.play('pickup', p.x); this.emit({ type: 'toast', text: `+${p.qty} ${ITEMS[p.item].name}`, kind: 'loot' });
      }
    }
    // checkpoints + radio chatter
    for (const cp of this.level.checkpoints) if (this.leader.x > cp && this.checkpointX < cp && this.alertLevel === 0) { this.checkpointX = cp; this.save(); this.emit({ type: 'checkpoint' }); }
    this.level.radioLines.forEach((l, i) => { if (!this.radioDone.has(i) && this.leader.x > l.x) { this.radioDone.add(i); this.emit({ type: 'radio', speaker: l.speaker, text: l.text }); } });
    // alert state
    const hunting = this.infected.filter((z) => z.alive && z.state === 'chase').length;
    this.alertLevel = clamp(hunting / 4, 0, 1);
    if ((hunting > 0) !== this.alertOn) { this.alertOn = hunting > 0; this.emit({ type: 'alert', on: this.alertOn }); if (this.alertOn) audio.play('alert'); }
    // physics
    this.world.step(dt, 8, 3);
    for (const c of this.corpses) c.age += dt;
    if (!this.ended && this.survivors.every((s) => !s.alive)) { this.ended = true; this.emit({ type: 'gameover' }); }
  }

  /** Strongest stealth threat on the controlled character (0..1) for the HUD eye meter. */
  detection(): number {
    let m = 0;
    for (const z of this.infected) if (z.alive && Math.abs(z.x - this.leader.x) < 16) m = Math.max(m, z.state === 'chase' ? 1 : z.suspicion);
    return m;
  }

  private updateView(dt: number): void {
    const L = this.leader;
    this.camLead = damp(this.camLead, L.facing * 1.8 + L.vx * 0.35, 2.5, dt);
    const half = this.r.viewWidth / 2;
    const target = clamp(L.x + this.camLead, half - 1.5, this.level.width - half + 1.5);
    this.camX = damp(this.camX, target, 5, dt);
    this.r.rig.position.x = this.camX;
    audio.listenerX = this.camX;
    this.view.update(dt, this.camX, this.time);
    this.rain.update(dt, this.r.rig.position.y);
    for (const x of this.rain.splashX) if (Math.random() < 0.3) this.fx.splash(this.camX + x);
    this.fx.update(dt);
    for (const a of [...this.survivors, ...this.infected]) {
      if (!a.alive) continue;
      const v = this.views.get(a.id)!;
      const speed = Math.abs(a.vx);
      if (a.team === 'survivor') {
        const anim = a.drawT >= 0 ? 'draw' : a.aiming ? (speed > 0.25 ? 'aimWalk' : 'aim') : a.running ? 'run' : speed > 0.25 ? 'walk' : 'idle';
        v.play(anim, dt, speed);
        v.squash = damp(v.squash, a.crouching ? 0.9 : 1, 10, dt);
        const shots = this.lastShots.get(a.id) ?? 0;
        if (a.shotsFired !== shots) { this.lastShots.set(a.id, a.shotsFired); v.recoil = 0.07; }
        if (a.meleeT >= 0) v.lunge = Math.sin(Math.min(1, a.meleeT / 0.42) * Math.PI) * 0.28;
      } else {
        v.lying = damp(v.lying, a.state === 'dormant' ? 1 : 0, a.state === 'waking' ? 3 : 8, dt);
        v.play(speed > 0.15 ? 'walk' : 'idle', dt, speed, a.infectedType === 'runner' && speed > 2 ? 1.1 : 1);
        if (a.attackT >= 0) v.lunge = Math.sin(Math.min(1, a.attackT / a.infected!.attackTime) * Math.PI) * 0.35;
      }
      v.hurtFlash(a.hurtT * 0.5);
      v.pose(a.x, a.y, a.facing, dt);
    }
    this.corpses = this.corpses.filter((c) => {
      c.view.poseRagdoll(c.ragdoll);
      if (c.age > 900) {
        c.view.opacity -= dt * 0.8;
        if (c.view.opacity <= 0) { destroySpriteRagdoll(this.world, c.ragdoll); this.r.scene.remove(c.view.group); c.view.dispose(); return false; }
      }
      return true;
    });
    for (const p of this.props) { const b = p.body.getPosition(); p.mesh.position.x = b.x; p.mesh.position.y = b.y; p.mesh.rotation.z = p.body.getAngle(); }
    this.flashes = this.flashes.filter((f) => (f.t -= dt) > 0);
    uploadLights([...this.flashes.map((f) => f.light), ...this.view.allLights()], this.camX);
  }

  /** Screen-space anchor above an actor's head (HUD name tags). */
  tagAnchor(a: Actor): { x: number; y: number } { return this.r.toScreen(a.x, 2.1 * a.scale + 0.1); }

  shake(amount: number): void {
    if (!this.shakeEnabled || amount <= 0) return;
    const s = this.r.shake.position;
    animate(s, { x: [{ to: amount, duration: 30 }, { to: -amount * 0.8, duration: 40 }, { to: amount * 0.4, duration: 40 }, { to: 0, duration: 70 }], y: [{ to: -amount * 0.6, duration: 35 }, { to: amount * 0.4, duration: 45 }, { to: 0, duration: 90 }], composition: 'blend' });
  }

  // ------------------------------------------------------------------ persistence
  snapshot(): SaveData {
    return {
      level: this.level.id, checkpoint: this.checkpointX, stash: { ...this.stash },
      party: this.survivors.map((s) => ({ id: s.survivor!.id, hp: Math.max(s.alive ? 1 : 0, Math.round(s.hp)), alive: s.alive, mag: { ...(s.mag as Record<string, number>) } })),
      looted: [...this.looted], picked: [...this.picked], killed: [...this.killed], controlled: this.controlled, objectivesDone: [...this.objectivesDone],
    };
  }
  save(): void { store.set('save', this.snapshot()); }

  dispose(): void {
    this.view.dispose();
    for (const c of this.corpses) destroySpriteRagdoll(this.world, c.ragdoll);
    for (const v of this.views.values()) { this.r.scene.remove(v.group); v.dispose(); }
    for (const p of this.props) { this.r.scene.remove(p.mesh); p.mesh.geometry.dispose(); (p.mesh.material as THREE.Material).dispose(); }
    for (const p of this.pickups) this.r.scene.remove(p.mesh);
    this.r.rig.remove(this.rain.group);
    this.fx.dispose();
  }
}

const heldOnly = (c: Command): Command => ({ ...c, melee: false, interact: false, reload: false, heal: false, crouch: false, switchChar: 0, orderHold: false, pause: false, inventory: false, debug: false });
