import { idle, type Actor, type Intent } from './actor';
import { ReactiveSelector, Sequence, Condition, Action, Status, type Node } from '../ai/bt';
import { Reasoner, curves } from '../ai/utility';
import { WEAPONS } from './data';
import type { InputFrame } from '../core/input';
import type { Rng } from '../core/math';

/** What brains may ask of the world (Game implements it). */
export interface AIWorld {
  squad: Actor[]; infected: Actor[]; leader: Actor; time: number; rng: Rng; x0: number; x1: number;
  hold: { on: boolean; x: number };
  slot(a: Actor): number;
  lightAt(x: number): number;
  medical(): number;
  ammoFor(a: Actor): number;
  weaponsFree(): boolean;
  cry(z: Actor): void;
  groan(z: Actor): void;
}
export interface Brain { think(a: Actor, w: AIWorld, dt: number): Intent }

// ================================================================ player
export class PlayerBrain implements Brain {
  frame: InputFrame | null = null;
  crouch = false;
  think(a: Actor): Intent {
    const f = this.frame, it = idle();
    if (!f) return it;
    if (f.pressed.has('crouch')) this.crouch = !this.crouch;               // toggle (input-systems: accessibility)
    if (f.held.has('run') && f.moveX !== 0) this.crouch = false;
    it.moveX = f.moveX; it.run = f.held.has('run'); it.crouch = this.crouch;
    it.fire = f.held.has('fire'); it.aim = f.held.has('fire');
    it.melee = f.pressed.has('melee'); it.reload = f.pressed.has('reload'); it.heal = f.pressed.has('heal');
    if (f.pressed.has('throw')) it.throwAt = a.x + a.facing * 9;
    return it;
  }
}

// ================================================================ squad (utility AI)
type SquadAct = 'follow' | 'engage' | 'reload' | 'heal' | 'retreat';
interface SquadCtx { a: Actor; w: AIWorld; threat: Actor | null; threatD: number; hurtAlly: Actor | null; magFrac: number; reserve: number; leaderGap: number }

export class SquadBrain implements Brain {
  private reasoner = new Reasoner<SquadCtx, SquadAct>([
    { id: 'follow', weight: 0.55, considerations: [{ input: () => 1, curve: curves.linear() }] },
    { id: 'engage', weight: 1.0, considerations: [
      { input: (c) => (c.threat ? 1 - c.threatD / Math.max(8, WEAPONS[c.a.weapon].range) : 0), curve: curves.sigmoid(0.15, 9) },
      { input: (c) => c.magFrac, curve: curves.step(0.01) },
    ] },
    { id: 'reload', weight: 0.9, considerations: [
      { input: (c) => 1 - c.magFrac, curve: curves.quad(1.6) },
      { input: (c) => (c.reserve > 0 ? 1 : 0), curve: curves.step(0.5) },
      { input: (c) => (c.threat ? c.threatD / 10 : 1), curve: curves.linear(1.2, 0.1) },
    ] },
    { id: 'heal', weight: 1.1, considerations: [
      { input: (c) => (c.a.survivor?.role === 'medic' && c.hurtAlly ? 1 - c.hurtAlly.hp / c.hurtAlly.maxHp : 0), curve: curves.sigmoid(0.45, 12) },
      { input: (c) => (c.w.medical() > 0 ? 1 : 0), curve: curves.step(0.5) },
      { input: (c) => (c.threat ? c.threatD / 8 : 1), curve: curves.linear(1, 0) },
    ] },
    { id: 'retreat', weight: 0.95, considerations: [
      { input: (c) => (c.threat && c.threat.state === 'chase' ? 1 - c.threatD / 2.2 : 0), curve: curves.linear() },
      { input: (c) => 1 - c.a.hp / c.a.maxHp, curve: curves.linear(0.8, 0.4) },
    ] },
  ], 0.12);
  private nextThink = 0;
  private act: SquadAct = 'follow';
  private threat: Actor | null = null;
  private hurt: Actor | null = null;
  get current(): SquadAct { return this.act; }

  think(a: Actor, w: AIWorld): Intent {
    const it = idle(), L = w.leader;
    it.crouch = L.crouching;
    if (w.time >= this.nextThink) {                       // decide at 6 Hz, not every frame
      this.nextThink = w.time + 0.16;
      const range = Math.max(7, WEAPONS[a.weapon].range * 0.9);
      let best: Actor | null = null, bd = 1e9;
      for (const z of w.infected) {
        if (!z.alive || z.state === 'dormant') continue;
        if (z.state !== 'chase' && !w.weaponsFree()) continue;          // don't blow the squad's stealth
        const d = Math.abs(z.x - a.x);
        if (d < range && d < bd) { best = z; bd = d; }
      }
      this.threat = best;
      this.hurt = w.squad.filter((s) => s.alive && s.hp / s.maxHp < 0.55).sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp)[0] ?? null;
      const wdef = WEAPONS[a.weapon];
      this.act = this.reasoner.decide({ a, w, threat: best, threatD: bd, hurtAlly: this.hurt, magFrac: wdef.mag ? a.mag / wdef.mag : 1, reserve: w.ammoFor(a), leaderGap: Math.abs(L.x - a.x) });
    }
    const slot = w.slot(a);
    const formX = w.hold.on ? w.hold.x - L.facing * (0.9 + slot * 0.9) : L.x - L.facing * (1.15 + slot * 1.05);
    const goTo = (tx: number, run = false) => { const dx = tx - a.x; if (Math.abs(dx) > 0.35) { it.moveX = Math.sign(dx) * Math.min(1, Math.abs(dx) / 0.8); it.run = run || Math.abs(dx) > 3.5; } };
    const z = this.threat && this.threat.alive ? this.threat : null;
    switch (this.act) {
      case 'follow': goTo(formX); if (Math.abs(formX - a.x) < 0.4) it.faceX = L.facing; break;
      case 'engage': {
        if (!z) break;
        const dx = z.x - a.x; it.faceX = Math.sign(dx); it.aim = true;
        if (Math.abs(dx) < 1.0) it.melee = true; else it.fire = true;
        if (Math.abs(formX - a.x) > 3) goTo(formX);
        break;
      }
      case 'reload': it.reload = true; goTo(formX); break;
      case 'heal': {
        const t = this.hurt; if (!t) break;
        if (Math.abs(t.x - a.x) > 1.0) goTo(t.x - Math.sign(t.x - a.x) * 0.7); else it.heal = true;
        break;
      }
      case 'retreat': if (z) { it.moveX = -Math.sign(z.x - a.x); it.run = true; it.faceX = Math.sign(z.x - a.x); it.aim = true; it.fire = Math.abs(z.x - a.x) > 1.2; } break;
    }
    return it;
  }
}

// ================================================================ infected (behavior tree + perception service)
interface ZBoard { a: Actor; w: AIWorld; dt: number; time: number; seen: Actor | null; seenD: number; out: Intent }

export class InfectedBrain implements Brain {
  private wanderT = 0; private wanderDir = 0; private lostT = 0; private groanT = Math.random() * 8;
  private bb!: ZBoard;
  private tree: Node<ZBoard>;

  constructor() {
    const set = (a: Actor, s: Actor['state']) => { a.state = s; a.stateT = 0; };
    this.tree = new ReactiveSelector<ZBoard>([
      new Sequence([new Condition((b) => b.a.stun > 0, 'stunned'), new Action(() => Status.Running, 'reel')]),
      new Sequence([new Condition((b) => b.a.state === 'dormant' || b.a.state === 'waking', 'dormant?'), new Action((b) => {
        if (b.a.state === 'dormant' && (b.a.suspicion > 0.6 || (b.seen && b.seenD < 1.6))) set(b.a, 'waking');
        if (b.a.state === 'waking' && b.a.stateT > 0.9) {
          if (b.seen) { b.a.targetId = b.seen.id; set(b.a, 'chase'); b.w.cry(b.a); } else set(b.a, 'investigate');
        }
        return Status.Running;
      }, 'rest/rise')]),
      new Sequence([new Condition((b) => b.a.state === 'chase', 'hunting?'), new Action((b) => this.chase(b), 'chase')]),
      new Sequence([new Condition((b) => b.a.state === 'investigate', 'curious?'), new Action((b) => {
        const dx = b.a.investigateX - b.a.x;
        if (Math.abs(dx) > 0.5) { b.out.moveX = Math.sign(dx) * 0.9; b.out.run = b.a.suspicion > 0.7 && b.a.type !== 'runner'; return Status.Running; }
        if (b.a.stateT > 4) { set(b.a, 'wander'); return Status.Success; }
        if (Math.floor(b.time * 0.8) % 2) b.out.faceX = -b.a.facing;      // look around
        return Status.Running;
      }, 'investigate')]),
      new Action((b) => {
        if (b.a.state === 'idle') { if (Math.floor(b.time / 3 + b.a.id) % 5 === 0) b.out.faceX = -b.a.facing; return Status.Running; }
        this.wanderT -= b.dt;
        if (this.wanderT <= 0) {
          this.wanderT = b.w.rng.range(2, 5);
          const away = b.a.x - b.a.homeX;
          this.wanderDir = Math.abs(away) > 4 ? -Math.sign(away) : b.w.rng.pick([-1, 0, 0, 1]);
        }
        b.out.moveX = this.wanderDir * 0.6;
        return Status.Running;
      }, 'wander'),
    ]);
  }

  private chase(b: ZBoard): Status {
    const a = b.a, d = a.infected!;
    let t = b.w.squad.find((s) => s.id === a.targetId && s.alive) ?? null;
    if (b.seen && (!t || b.seenD < Math.abs(t.x - a.x) - 1.5)) { t = b.seen; a.targetId = b.seen.id; }
    if (!t) { a.state = 'investigate'; a.stateT = 0; return Status.Failure; }
    if (b.seen) this.lostT = 0; else this.lostT += b.dt;
    const dx = t.x - a.x;
    if (this.lostT > 5 && Math.abs(dx) > d.sight) { a.investigateX = t.x; a.state = 'investigate'; a.stateT = 0; return Status.Failure; }
    b.out.faceX = Math.sign(dx);
    if (Math.abs(dx) <= d.reach) b.out.melee = true; else { b.out.moveX = Math.sign(dx); b.out.run = true; }
    return Status.Running;
  }

  /** Perception service: sight cone shaped by light, stance and movement; builds suspicion. */
  private perceive(a: Actor, w: AIWorld, dt: number): { seen: Actor | null; d: number } {
    const d = a.infected!;
    let seen: Actor | null = null, seenD = 1e9, gain = 0;
    for (const s of w.squad) {
      if (!s.alive) continue;
      const dx = s.x - a.x, dist = Math.abs(dx);
      const inFront = Math.sign(dx) === a.facing || dist < 1.3;
      const stealth = (s.crouching ? 0.42 : 1) * (s.running ? 1.4 : 1) * (0.6 + 0.6 * w.lightAt(s.x));
      const range = d.sight * stealth * (a.state === 'dormant' ? 0.25 : 1) * (inFront ? 1 : 0.28);
      if (dist < range) {
        const g = (1 - dist / range) * 2.3 + (Math.abs(s.vx) > 0.3 ? 0.6 : 0.05);
        if (g > gain) { gain = g; seen = s; seenD = dist; }
      }
    }
    if (seen) a.suspicion = Math.min(1, a.suspicion + gain * dt * (a.state === 'chase' ? 3 : 1));
    else a.suspicion = Math.max(0, a.suspicion - dt * 0.14);
    if (seen && a.state !== 'chase' && a.state !== 'dormant' && a.state !== 'waking') {
      if (a.suspicion >= 1) { a.targetId = seen.id; a.state = 'chase'; a.stateT = 0; w.cry(a); }
      else if (a.suspicion > 0.45) { a.investigateX = seen.x; if (a.state !== 'investigate') { a.state = 'investigate'; a.stateT = 0; } }
    }
    return { seen, d: seenD };
  }

  think(a: Actor, w: AIWorld, dt: number): Intent {
    a.stateT += dt;
    this.groanT -= dt;
    if (this.groanT <= 0) { this.groanT = 5 + w.rng.range(0, 9); if (a.state !== 'dormant') w.groan(a); }
    const p = this.perceive(a, w, dt);
    this.bb = { a, w, dt, time: w.time, seen: p.seen, seenD: p.d, out: idle() };
    this.tree.tick(this.bb, dt);
    return this.bb.out;
  }

  /** Hearing: loud/close noises wake the dormant and pull the curious. */
  hear(a: Actor, x: number, strength: number): void {
    if (!a.alive || a.state === 'chase') return;
    if (a.state === 'dormant') { if (strength > 0.35) { a.state = 'waking'; a.stateT = 0; } a.investigateX = x; return; }
    a.investigateX = x;
    a.suspicion = Math.min(0.9, a.suspicion + strength * 0.6);
    if (a.state !== 'waking') { a.state = 'investigate'; a.stateT = 0; }
    a.facing = x > a.x ? 1 : -1;
  }
}
