import { blendPose, solve, targetPose, zeroPose, type AnimInput, type Gait, type Pose, type Skeleton } from './rig';
import { INFECTED, MELEE_SWING_TIME, WEAPONS, type InfectedDef, type InfectedType, type ItemId, type SurvivorDef, type WeaponId } from './data';
import type { Ragdoll } from '../physics/ragdoll';
import { clamp } from '../core/rng';

/** What a brain (player input, companion AI, infected AI, later: network) wants this tick. */
export interface Intent {
  moveX: number; run: boolean; crouch: boolean; aim: boolean;
  fire: boolean; melee: boolean; reload: boolean; heal: boolean; faceX?: number;
}
export const idleIntent = (): Intent => ({ moveX: 0, run: false, crouch: false, aim: false, fire: false, melee: false, reload: false, heal: false });

/** Services the world provides to actors (implemented by Game). */
export interface ActorHost {
  fire(a: Actor): void;
  meleeStrike(a: Actor): void;
  clawStrike(a: Actor): void;
  footstep(a: Actor): void;
  ammo(type: ItemId): number;
  takeAmmo(type: ItemId, n: number): number;
  sfx(kind: 'empty' | 'reload' | 'heal', a: Actor): void;
  heal(a: Actor): void;
}

export type InfectedState = 'dormant' | 'waking' | 'idle' | 'wander' | 'investigate' | 'chase' | 'stagger';

let nextId = 1;

export class Actor {
  readonly id = nextId++;
  readonly team: 'survivor' | 'infected';
  readonly name: string;
  readonly scale: number;
  readonly gait: Gait;
  readonly survivor?: SurvivorDef;
  readonly infected?: InfectedDef;
  readonly infectedType?: InfectedType;
  levelId = '';

  x: number; y = 0; vx = 0; knockVx = 0;
  facing: 1 | -1 = 1;
  hp: number; maxHp: number; alive = true;
  crouching = false; running = false; aimT = 0; forceAim = false;

  weapon: WeaponId; meleeWeapon: WeaponId;
  mag: Partial<Record<WeaponId, number>> = {};
  cooldown = 0; reloadT = 0; meleeT = -1; meleeHitDone = false;
  attackT = -1; attackHitDone = false; attackCooldown = 0;
  healT = -1;

  hurtT = 0; recoil = 0; stunT = 0;
  phase = 0; time = Math.random() * 10; lastStepPhase = 0;
  pose: Pose = zeroPose(); private tgt: Pose = zeroPose(); skel: Skeleton;
  private anim: AnimInput;

  // infected AI state (owned by InfectedBrain)
  state: InfectedState = 'idle';
  suspicion = 0; targetId = 0; homeX: number; investigateX = 0; stateT = 0;

  ragdoll: Ragdoll | null = null;
  light = 0.4;                 // set by renderer: 0 dark … 1 under a lamp
  lastHit = { dir: 1 as 1 | -1, power: 0, part: 'torso' as const };

  constructor(opts: { x: number; survivor?: SurvivorDef; infected?: InfectedType }) {
    this.x = opts.x; this.homeX = opts.x;
    if (opts.survivor) {
      const s = opts.survivor;
      this.team = 'survivor'; this.survivor = s; this.name = s.name; this.scale = 1; this.gait = 'human';
      this.hp = this.maxHp = s.maxHp; this.weapon = s.weapon; this.meleeWeapon = s.melee;
      this.mag[s.weapon] = WEAPONS[s.weapon].mag;
    } else {
      const t = opts.infected ?? 'common', d = INFECTED[t];
      this.team = 'infected'; this.infected = d; this.infectedType = t; this.name = d.name;
      this.scale = d.scale * (0.94 + Math.random() * 0.1); this.gait = d.gait;
      this.hp = this.maxHp = d.maxHp; this.weapon = 'pipe'; this.meleeWeapon = 'pipe';
    }
    this.anim = { speed: 0, run: false, crouch: false, aim: false, hold: 'none', meleeT: -1, recoil: 0, hurt: 0, attackT: -1, time: 0, phase: 0, gait: this.gait, dormant: false, lean: 0 };
    this.skel = solve(this.pose, this.scale, this.facing);
  }

  get height(): number { return (this.state === 'dormant' && this.team === 'infected' ? 0.95 : this.crouching ? 1.25 : 1.82) * this.scale; }
  get speedAbs(): number { return Math.abs(this.vx); }
  get weaponDef() { return WEAPONS[this.weapon]; }
  get busy(): boolean { return this.reloadT > 0 || this.meleeT >= 0 || this.healT >= 0 || this.stunT > 0; }

  damage(amount: number, dir: 1 | -1, knock: number): void {
    if (!this.alive) return;
    this.hp -= amount;
    this.hurtT = 1;
    const resist = this.infected?.knockbackResist ?? 1;
    this.knockVx += dir * knock * resist * 0.6;
    if (this.infected && resist > 0.5) this.stunT = Math.max(this.stunT, 0.18 * resist);
    this.lastHit = { dir, power: knock, part: 'torso' };
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
  }

  /** One fixed simulation step. */
  step(dt: number, it: Intent, host: ActorHost, levelWidth: number): void {
    if (!this.alive) return;
    this.time += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.aimT = Math.max(0, this.aimT - dt);
    this.hurtT = Math.max(0, this.hurtT - dt * 3);
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.stunT = Math.max(0, this.stunT - dt);
    const dormant = this.team === 'infected' && (this.state === 'dormant' || this.state === 'waking');

    // ---- movement
    this.crouching = this.team === 'survivor' && it.crouch;
    this.running = it.run && !this.crouching && Math.abs(it.moveX) > 0.1;
    let speed: number;
    if (this.survivor) speed = this.running ? this.survivor.run : this.survivor.walk * (this.crouching ? 0.5 : 1);
    else speed = (it.run ? this.infected!.chase : this.infected!.walk);
    if (this.busy && this.meleeT < 0) speed *= this.reloadT > 0 ? 0.6 : 0.0;
    if (this.meleeT >= 0 || this.attackT >= 0) speed *= 0.25;
    if (dormant) speed = 0;
    const target = clamp(it.moveX, -1, 1) * speed;
    const accel = Math.abs(target) > Math.abs(this.vx) ? 10 : 14;
    this.vx += (target - this.vx) * Math.min(1, accel * dt);
    this.knockVx *= Math.exp(-7 * dt);
    this.x = clamp(this.x + (this.vx + this.knockVx) * dt, 0.4, levelWidth - 0.4);
    const face = it.faceX ?? it.moveX;
    if (Math.abs(face) > 0.1 && this.meleeT < 0 && this.attackT < 0 && !dormant) this.facing = face > 0 ? 1 : -1;

    // ---- gait phase + footsteps
    const stride = (this.running || it.run ? 1.9 : 1.25) * this.scale;
    this.phase += (Math.abs(this.vx) / stride) * Math.PI * 2 * dt;
    if (Math.floor(this.phase / Math.PI) !== Math.floor(this.lastStepPhase / Math.PI) && Math.abs(this.vx) > 0.3) host.footstep(this);
    this.lastStepPhase = this.phase;

    // ---- weapons (survivors)
    if (this.team === 'survivor') this.stepWeapons(dt, it, host);
    else this.stepClaws(dt, it, host);

    // ---- animation
    const a = this.anim;
    a.speed = Math.abs(this.vx); a.run = this.running || (this.team === 'infected' && it.run); a.crouch = this.crouching;
    a.aim = this.team === 'survivor' && (this.aimT > 0 || it.aim) && this.weaponDef.hold !== 'melee' && this.reloadT <= 0 && this.healT < 0;
    a.hold = this.team === 'survivor' ? this.weaponDef.hold : 'none';
    a.meleeT = this.meleeT >= 0 ? this.meleeT / MELEE_SWING_TIME : -1;
    a.attackT = this.attackT >= 0 && this.infected ? this.attackT / this.infected.attackTime : -1;
    a.recoil = this.recoil; a.hurt = this.hurtT; a.time = this.time; a.phase = this.phase;
    a.dormant = this.state === 'dormant'; a.lean = this.reloadT > 0 ? -0.1 : 0;
    a.gait = this.team === 'infected' && !it.run && this.gait === 'sprint' ? 'shamble' : this.gait;
    targetPose(a, this.tgt);
    blendPose(this.pose, this.tgt, this.state === 'waking' ? 4 : 16, dt);
    solve(this.pose, this.scale, this.facing, this.skel);
  }

  private stepWeapons(dt: number, it: Intent, host: ActorHost): void {
    const w = this.weaponDef;
    // healing (medkit use) is an action that blocks other actions
    if (this.healT >= 0) {
      this.healT += dt;
      if (this.healT >= 1.1) { this.healT = -1; host.heal(this); }
      return;
    }
    if (it.heal && !this.busy) { this.healT = 0; host.sfx('heal', this); return; }
    // reload
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0 && w.ammo) {
        const need = w.mag - (this.mag[this.weapon] ?? 0);
        this.mag[this.weapon] = (this.mag[this.weapon] ?? 0) + host.takeAmmo(w.ammo, need);
      }
      return;
    }
    if (it.reload && w.ammo && (this.mag[this.weapon] ?? 0) < w.mag && host.ammo(w.ammo) > 0 && this.meleeT < 0) {
      this.reloadT = w.reload; host.sfx('reload', this); return;
    }
    // melee swing
    if (this.meleeT >= 0) {
      this.meleeT += dt;
      if (!this.meleeHitDone && this.meleeT >= MELEE_SWING_TIME * 0.45) { this.meleeHitDone = true; host.meleeStrike(this); }
      if (this.meleeT >= MELEE_SWING_TIME) this.meleeT = -1;
      return;
    }
    if (it.melee && this.cooldown <= 0) {
      this.meleeT = 0; this.meleeHitDone = false; this.cooldown = WEAPONS[this.meleeWeapon].cooldown; return;
    }
    // fire
    if (it.fire && this.cooldown <= 0) {
      if (!w.ammo) { this.meleeT = 0; this.meleeHitDone = false; this.cooldown = w.cooldown; return; }
      const m = this.mag[this.weapon] ?? 0;
      if (m <= 0) {
        if (host.ammo(w.ammo) > 0) { this.reloadT = w.reload; host.sfx('reload', this); }
        else { host.sfx('empty', this); this.cooldown = 0.4; }
        return;
      }
      this.mag[this.weapon] = m - 1;
      this.cooldown = w.cooldown; this.aimT = 1.6; this.recoil = 1;
      host.fire(this);
    }
  }

  private stepClaws(dt: number, it: Intent, host: ActorHost): void {
    const d = this.infected!;
    if (this.attackT >= 0) {
      this.attackT += dt;
      if (!this.attackHitDone && this.attackT >= d.attackTime * 0.55) { this.attackHitDone = true; host.clawStrike(this); }
      if (this.attackT >= d.attackTime) { this.attackT = -1; this.attackCooldown = d.cooldown; }
      return;
    }
    if (it.melee && this.attackCooldown <= 0 && this.stunT <= 0) { this.attackT = 0; this.attackHitDone = false; }
  }
}
