import { idleIntent, type Actor, type Intent } from './actor';
import { WEAPONS } from './data';
import type { Command } from '../core/input';
import type { Rng } from '../core/rng';

/** What AI can ask of the world. Game implements it. */
export interface AIWorld {
  survivors: Actor[]; infected: Actor[];
  leader: Actor;
  holdPosition: boolean; holdX: number;
  levelWidth: number; rng: Rng;
  partySlot(a: Actor): number;
  emitNoise(x: number, radius: number, source: Actor | null): void;
  medkits(): number;
  lightAt(x: number): number;      // 0 dark .. 1 lit
  ammoFor(a: Actor): number;
  aiFireAllowed(): boolean;       // squad weapons-free?
}

export interface Brain { think(a: Actor, w: AIWorld, dt: number): Intent }

// ---------------------------------------------------------------- player
export class PlayerBrain implements Brain {
  crouch = false;
  cmd: Command | null = null;
  think(): Intent {
    const c = this.cmd, it = idleIntent();
    if (!c) return it;
    if (c.crouch) this.crouch = !this.crouch;
    if (c.run && c.moveX !== 0) this.crouch = false;
    it.moveX = c.moveX; it.run = c.run; it.crouch = this.crouch; it.fire = c.fire; it.melee = c.melee;
    it.reload = c.reload; it.heal = c.heal;
    return it;
  }
}

// ---------------------------------------------------------------- companion
/**
 * Squad bot: follows the leader in a loose file, mirrors their stance (crouches
 * when the leader sneaks), engages threats that are actively hunting the squad,
 * holds fire on unaware infected so stealth isn't ruined, reloads in cover,
 * and the medic patches up wounded teammates.
 */
export class CompanionBrain implements Brain {
  private engageId = 0;
  private reconsider = 0;
  private healTarget: Actor | null = null;
  think(a: Actor, w: AIWorld, dt: number): Intent {
    const it = idleIntent();
    const L = w.leader;
    if (!L.alive) return it;
    const slot = w.partySlot(a);
    it.crouch = L.crouching;

    // --- medic duty
    if (a.survivor?.role === 'medic' && w.medkits() > 0) {
      const hurt = w.survivors.filter((s) => s.alive && s.hp / s.maxHp < 0.5).sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp)[0];
      this.healTarget = hurt ?? null;
    } else this.healTarget = null;

    // --- threat selection (re-evaluated a few times per second)
    this.reconsider -= dt;
    const wdef = WEAPONS[a.weapon];
    if (this.reconsider <= 0) {
      this.reconsider = 0.25;
      let best: Actor | null = null, bestD = Infinity;
      for (const z of w.infected) {
        if (!z.alive || z.state === 'dormant') continue;
        const d = Math.abs(z.x - a.x);
        const hunting = z.state === 'chase';
        if (!hunting && !w.aiFireAllowed()) continue;          // don't blow stealth
        if (d < Math.max(wdef.range, 6) && d < bestD) { best = z; bestD = d; }
      }
      this.engageId = best?.id ?? 0;
    }
    const enemy = this.engageId ? w.infected.find((z) => z.id === this.engageId && z.alive) : undefined;

    // --- movement target
    let tx: number;
    if (this.healTarget && this.healTarget !== a) tx = this.healTarget.x - Math.sign(this.healTarget.x - a.x || 1) * 0.6;
    else if (w.holdPosition) tx = w.holdX - L.facing * (0.9 + slot * 0.85);
    else tx = L.x - L.facing * (1.1 + slot * 1.05);
    tx = Math.max(0.5, Math.min(w.levelWidth - 0.5, tx));
    const dx = tx - a.x;

    if (enemy) {
      const ex = enemy.x - a.x, d = Math.abs(ex);
      it.faceX = Math.sign(ex); it.aim = true;
      if (d < 1.05) it.melee = true;                            // too close: shove/swing
      else if ((a.mag[a.weapon] ?? 0) > 0 && d < wdef.range) it.fire = true;
      else if ((a.mag[a.weapon] ?? 0) === 0 && w.ammoFor(a) > 0) it.reload = true;
      else if (w.ammoFor(a) === 0 && (a.mag[a.weapon] ?? 0) === 0 && d < 2.5) it.melee = true;
      // keep formation-ish but back-pedal from close threats
      if (d < 1.6 && enemy.state === 'chase') it.moveX = -Math.sign(ex) * 0.8;
      else if (Math.abs(dx) > 2.5) it.moveX = Math.sign(dx);
    } else {
      if (Math.abs(dx) > 0.35) { it.moveX = Math.sign(dx) * Math.min(1, Math.abs(dx) / 0.8); it.run = Math.abs(dx) > 3.5 && !L.crouching; }
      else it.faceX = L.facing;
      // top up magazine when calm
      const w2 = WEAPONS[a.weapon];
      if (w2.ammo && (a.mag[a.weapon] ?? 0) < w2.mag * 0.5 && w.ammoFor(a) > 0) it.reload = true;
    }
    if (this.healTarget && Math.abs(this.healTarget.x - a.x) < 1.2 && !enemy) {
      it.moveX = 0;
      if (this.healTarget === a) it.heal = true; else { it.heal = true; it.faceX = Math.sign(this.healTarget.x - a.x); }
    }
    return it;
  }
}

// ---------------------------------------------------------------- infected
/**
 * Mindless, biologically-driven behaviour: they react to movement in view and
 * to sound, not to tactics. Suspicion builds while a survivor is visible (faster
 * when close / lit / running, slower when crouched in the dark). At 1 they
 * commit to a chase and cry out, which pulls nearby infected in.
 */
export class InfectedBrain implements Brain {
  private wanderT = 0; private wanderDir = 0; private lostT = 0; private groanT = Math.random() * 8;
  constructor(private onCry: (a: Actor) => void, private onGroan: (a: Actor) => void) {}

  think(a: Actor, w: AIWorld, dt: number): Intent {
    const it = idleIntent();
    const d = a.infected!;
    a.stateT += dt;
    this.groanT -= dt;
    if (this.groanT <= 0) { this.groanT = 5 + w.rng.range(0, 9); if (a.state !== 'dormant') this.onGroan(a); }
    if (a.stunT > 0) return it;

    // ---- perception
    let seen: Actor | null = null, seenD = Infinity, gain = 0;
    for (const s of w.survivors) {
      if (!s.alive) continue;
      const dx = s.x - a.x, dist = Math.abs(dx);
      const inFront = Math.sign(dx) === a.facing || dist < 1.4;
      const dormantMul = a.state === 'dormant' ? 0.25 : 1;
      const stealth = (s.crouching ? 0.45 : 1) * (s.running ? 1.35 : 1) * (0.7 + 0.5 * w.lightAt(s.x));
      const range = d.sight * stealth * dormantMul * (inFront ? 1 : 0.3);
      if (dist < range) {
        const g = (1 - dist / range) * 2.2 + (s.speedAbs > 0.3 ? 0.6 : 0.1);
        if (g > gain) { gain = g; seen = s; seenD = dist; }
      }
    }
    if (seen) a.suspicion = Math.min(1, a.suspicion + gain * dt * (a.state === 'chase' ? 3 : 1));
    else a.suspicion = Math.max(0, a.suspicion - dt * 0.15);

    switch (a.state) {
      case 'dormant':
        if (a.suspicion > 0.6 || (seen && seenD < 1.6)) this.set(a, 'waking');
        return it;
      case 'waking':
        if (a.stateT > 0.9) { this.set(a, seen ? 'chase' : 'investigate'); if (seen) { a.targetId = seen.id; this.onCry(a); } a.investigateX = seen?.x ?? a.x; }
        return it;
      case 'idle': case 'wander': case 'investigate':
        if (a.suspicion >= 1 && seen) { a.targetId = seen.id; this.set(a, 'chase'); this.onCry(a); break; }
        if (a.suspicion > 0.45 && seen) { a.investigateX = seen.x; if (a.state !== 'investigate') this.set(a, 'investigate'); }
        break;
    }

    if (a.state === 'chase') {
      let t = w.survivors.find((s) => s.id === a.targetId && s.alive) ?? null;
      if (seen && (!t || seenD < Math.abs(t.x - a.x) - 1.5)) { t = seen; a.targetId = seen.id; }
      if (!t) { this.set(a, 'investigate'); return it; }
      const dx = t.x - a.x, dist = Math.abs(dx);
      if (seen) this.lostT = 0; else this.lostT += dt;
      if (this.lostT > 5 && dist > d.sight) { a.investigateX = t.x; this.set(a, 'investigate'); return it; }
      it.faceX = Math.sign(dx);
      if (dist <= d.reach) it.melee = true;
      else { it.moveX = Math.sign(dx); it.run = true; }
      return it;
    }
    if (a.state === 'investigate') {
      const dx = a.investigateX - a.x;
      if (Math.abs(dx) > 0.5) { it.moveX = Math.sign(dx) * 0.9; it.run = a.suspicion > 0.7 && a.infectedType !== 'runner'; }
      else if (a.stateT > 4) this.set(a, 'wander');
      return it;
    }
    if (a.state === 'wander') {
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = 2 + w.rng.range(0, 4);
        const away = a.x - a.homeX;
        this.wanderDir = Math.abs(away) > 4 ? -Math.sign(away) : w.rng.pick([-1, 0, 0, 1]);
      }
      it.moveX = this.wanderDir * 0.6;
    }
    return it;
  }

  /** Noise stimulus: move toward the sound; loud + close sounds wake the dormant. */
  hear(a: Actor, x: number, strength: number): void {
    if (!a.alive) return;
    if (a.state === 'chase') return;
    if (a.state === 'dormant') { if (strength > 0.35) this.set(a, 'waking'); a.investigateX = x; return; }
    a.investigateX = x;
    a.suspicion = Math.min(0.9, a.suspicion + strength * 0.6);
    if (a.state !== 'waking') this.set(a, 'investigate');
    a.facing = x > a.x ? 1 : -1;
  }

  private set(a: Actor, s: Actor['state']): void { a.state = s; a.stateT = 0; }
}
