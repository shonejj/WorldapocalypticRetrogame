import { INFECTED, MELEE_TIME, SURVIVORS, WEAPONS, type InfectedDef, type InfectedType, type ItemId, type SurvivorDef, type WeaponId } from './data';
import { clamp } from '../core/math';

/**
 * Everything that moves is an Actor driven by an Intent from a Brain (player input, squad
 * utility AI, infected behavior tree — later: network). Same rules for all → fair stealth,
 * and the multiplayer seam stays in one place. Pure simulation: no three.js/planck here.
 */
export interface Intent {
  moveX: number; run: boolean; crouch: boolean; aim: boolean; faceX?: number;
  fire: boolean; melee: boolean; reload: boolean; heal: boolean; throwAt?: number;
  /** bosses: speed multiplier while charging */ boost?: number;
}
export const idle = (): Intent => ({ moveX: 0, run: false, crouch: false, aim: false, fire: false, melee: false, reload: false, heal: false });

/** World services actors call into (implemented by Game). */
export interface Host {
  fire(a: Actor): void; meleeHit(a: Actor): void; clawHit(a: Actor): void; footstep(a: Actor): void;
  ammo(t: ItemId): number; take(t: ItemId, n: number): number; heal(a: Actor): boolean; throwLure(a: Actor, targetX: number): void;
  sfx(kind: 'dryfire' | 'reload' | 'heal' | 'throw', a: Actor): void;
}

export type ZState = 'dormant' | 'waking' | 'idle' | 'wander' | 'investigate' | 'chase' | 'stagger';
let nextId = 1;

export class Actor {
  readonly id = nextId++;
  readonly team: 'squad' | 'infected';
  readonly survivor?: SurvivorDef;
  readonly infected?: InfectedDef;
  readonly type?: InfectedType;
  readonly name: string;
  readonly scale: number;
  levelId = ''; isBoss = false;

  x: number; vx = 0; knock = 0; facing: 1 | -1 = 1;
  hp: number; maxHp: number; alive = true;
  hunger = 1; thirst = 1; bleed = 0;
  crouching = false; running = false;

  weapon: WeaponId; mag = 0; drawn = false; drawT = -1; lastCombat = -99;
  cooldown = 0; reloadT = -1; meleeT = -1; meleeDone = false; healT = -1; throwT = -1; throwX = 0;
  aimT = 0; recoil = 0; hurtT = 0; stun = 0; shots = 0;
  attackT = -1; attackDone = false; attackCd = 0;

  phase = 0; time = Math.random() * 9; private lastStep = 0;
  // infected blackboard-facing state (owned by the brain)
  state: ZState = 'idle'; suspicion = 0; targetId = 0; homeX: number; investigateX = 0; stateT = 0;

  constructor(o: { x: number; survivor?: SurvivorDef['id']; infected?: InfectedType }) {
    this.x = o.x; this.homeX = o.x;
    if (o.survivor) {
      const s = SURVIVORS.find((d) => d.id === o.survivor)!;
      this.team = 'squad'; this.survivor = s; this.name = s.name; this.scale = 1;
      this.hp = this.maxHp = s.maxHp; this.weapon = s.weapon; this.mag = WEAPONS[s.weapon].mag;
    } else {
      const t = o.infected ?? 'common', d = INFECTED[t];
      this.isBoss = !!d.boss;
      this.team = 'infected'; this.infected = d; this.type = t; this.name = d.name;
      this.scale = d.scale * (0.96 + Math.random() * 0.08); this.hp = this.maxHp = d.hp; this.weapon = 'pipe';
    }
  }

  get w() { return WEAPONS[this.weapon]; }
  get height() { return (this.state === 'dormant' && this.team === 'infected' ? 0.7 : this.crouching ? 1.2 : 1.8 * (this.infected?.height ?? 1)) * this.scale; }
  /** screamer: time left of the current scream (drives its animation) */
  screamT = 0;
  /** bosses (owned by the brain): charge wind-up / run timers, cooldown, summon waves already called, damage multiplier while exposed */
  chargeT = -1; chargeCd = 3; chargeDir = 0; waves = 0; exposed = 0;
  get busy() { return this.reloadT >= 0 || this.meleeT >= 0 || this.healT >= 0 || this.throwT >= 0 || this.stun > 0 || this.drawT >= 0; }
  /** 0..1 how "aimed" the survivor is (animation blend + accuracy). */
  get aimed() { return this.team === 'squad' && this.drawn && this.reloadT < 0 && this.healT < 0 && this.aimT > 0; }

  damage(amount: number, dir: number, knock: number): void {
    if (!this.alive) return;
    if (this.exposed > 0) amount *= 1.6; else if (this.infected?.armor) amount *= this.infected.armor;
    this.hp -= amount; this.hurtT = 1;
    const poise = this.infected?.poise ?? 1;
    if (!this.isBoss) this.knock += dir * knock * poise * 0.6;      // bosses are not pushed around by gunfire
    if (this.infected && poise > 0.5) this.stun = Math.max(this.stun, 0.2 * poise);
    if (this.team === 'squad' && amount >= 8 && Math.random() < 0.35) this.bleed = Math.min(1, this.bleed + 0.5);
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
  }

  step(dt: number, it: Intent, host: Host, x0: number, x1: number): void {
    if (!this.alive) return;
    this.time += dt;
    this.cooldown = Math.max(0, this.cooldown - dt); this.attackCd = Math.max(0, this.attackCd - dt);
    this.aimT = Math.max(0, this.aimT - dt); this.recoil = Math.max(0, this.recoil - dt * 7);
    this.hurtT = Math.max(0, this.hurtT - dt * 3); this.stun = Math.max(0, this.stun - dt); this.exposed = Math.max(0, this.exposed - dt);
    const dormant = this.team === 'infected' && (this.state === 'dormant' || this.state === 'waking');

    // ---- movement (accelerate toward target speed; knockback decays)
    this.crouching = this.team === 'squad' && it.crouch;
    this.running = it.run && !this.crouching && Math.abs(it.moveX) > 0.1;
    let speed = this.survivor ? (this.running ? this.survivor.run : this.survivor.walk * (this.crouching ? 0.55 : 1)) : it.run ? this.infected!.chase : this.infected!.walk;
    if (this.survivor && this.hp / this.maxHp < 0.3) speed *= 0.8;                       // limping when badly hurt
    if (this.reloadT >= 0) speed *= 0.55;
    if (this.meleeT >= 0 || this.attackT >= 0 || this.throwT >= 0) speed *= 0.25;
    if (this.healT >= 0 || this.stun > 0 || dormant) speed = 0;
    const target = clamp(it.moveX, -1, 1) * speed * (it.boost ?? 1);
    this.vx += (target - this.vx) * Math.min(1, (Math.abs(target) > Math.abs(this.vx) ? 10 : 14) * dt);
    this.knock *= Math.exp(-7 * dt);
    this.x = clamp(this.x + (this.vx + this.knock) * dt, x0 + 0.4, x1 - 0.4);
    const face = it.faceX ?? it.moveX;
    if (Math.abs(face) > 0.1 && this.meleeT < 0 && this.attackT < 0 && !dormant) this.facing = face > 0 ? 1 : -1;

    // ---- footsteps from gait phase
    const stride = (this.running || it.run ? 1.9 : 1.2) * this.scale;
    this.phase += (Math.abs(this.vx) / stride) * Math.PI * dt * 2;
    if (Math.floor(this.phase / Math.PI) !== Math.floor(this.lastStep / Math.PI) && Math.abs(this.vx) > 0.3) host.footstep(this);
    this.lastStep = this.phase;

    if (this.team === 'squad') this.stepSurvivor(dt, it, host); else this.stepInfected(dt, it, host);
  }

  private stepSurvivor(dt: number, it: Intent, host: Host): void {
    const w = this.w;
    const wants = it.aim || it.fire;
    if (wants) this.lastCombat = this.time;
    if (it.aim) this.aimT = Math.max(this.aimT, 0.25);
    // draw from the back the first time a weapon is needed; sling it after a quiet spell
    if (this.drawT >= 0) { this.drawT += dt; if (this.drawT >= 0.55) { this.drawT = -1; this.drawn = true; } return; }
    if (wants && !this.drawn && !this.busy) { this.drawT = 0; return; }
    if (this.drawn && this.time - this.lastCombat > 10 && !this.busy) this.drawn = false;
    // heal (blocks everything)
    if (this.healT >= 0) { this.healT += dt; if (this.healT >= 1.1) { this.healT = -1; host.heal(this); } return; }
    if (it.heal && !this.busy) { this.healT = 0; host.sfx('heal', this); return; }
    // throw a lure
    if (this.throwT >= 0) { this.throwT += dt; if (this.throwT >= 0.35 && this.throwX !== 0) { host.throwLure(this, this.throwX); this.throwX = 0; } if (this.throwT >= 0.6) this.throwT = -1; return; }
    if (it.throwAt !== undefined && !this.busy && host.ammo('bottle') > 0) { this.throwT = 0; this.throwX = it.throwAt; this.facing = it.throwAt > this.x ? 1 : -1; host.sfx('throw', this); return; }
    // reload
    if (this.reloadT >= 0) {
      this.reloadT += dt;
      if (this.reloadT >= w.reload) { this.reloadT = -1; if (w.ammo) this.mag += host.take(w.ammo, w.mag - this.mag); }
      return;
    }
    if (it.reload && w.ammo && this.mag < w.mag && host.ammo(w.ammo) > 0 && this.meleeT < 0) { this.reloadT = 0; host.sfx('reload', this); return; }
    // melee
    if (this.meleeT >= 0) {
      this.meleeT += dt;
      if (!this.meleeDone && this.meleeT >= MELEE_TIME * 0.45) { this.meleeDone = true; host.meleeHit(this); }
      if (this.meleeT >= MELEE_TIME) this.meleeT = -1;
      return;
    }
    if (it.melee && this.cooldown <= 0) { this.meleeT = 0; this.meleeDone = false; this.cooldown = WEAPONS.pipe.cooldown; return; }
    // fire
    if (it.fire && this.cooldown <= 0 && this.drawn) {
      this.aimT = 1.5;
      if (!w.ammo) { this.meleeT = 0; this.meleeDone = false; this.cooldown = w.cooldown; return; }
      if (this.mag <= 0) {
        if (host.ammo(w.ammo) > 0) { this.reloadT = 0; host.sfx('reload', this); } else { host.sfx('dryfire', this); this.cooldown = 0.35; }
        return;
      }
      this.mag--; this.cooldown = w.cooldown; this.recoil = 1; this.shots++;
      host.fire(this);
    }
  }

  private stepInfected(dt: number, it: Intent, host: Host): void {
    const d = this.infected!;
    if (this.attackT >= 0) {
      this.attackT += dt;
      if (!this.attackDone && this.attackT >= d.windup * 0.6) { this.attackDone = true; host.clawHit(this); }
      if (this.attackT >= d.windup) { this.attackT = -1; this.attackCd = d.cooldown; }
      return;
    }
    if (it.melee && this.attackCd <= 0 && this.stun <= 0) { this.attackT = 0; this.attackDone = false; }
  }
}
