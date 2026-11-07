import { describe, expect, it } from 'vitest';
import { Action, Condition, ReactiveSelector, Sequence, Status } from '../src/ai/bt';
import { Reasoner, curves, score } from '../src/ai/utility';
import { Actor, idle, type Host } from '../src/game/actor';
import { InfectedBrain, type AIWorld } from '../src/game/brains';
import { Rng } from '../src/core/math';

describe('behavior tree', () => {
  it('reactive selector lets a higher priority interrupt a running branch', () => {
    const bb = { alarm: false, log: [] as string[], time: 0 };
    let resets = 0;
    const tree = new ReactiveSelector<typeof bb>([
      new Sequence([new Condition((b) => b.alarm), new Action((b) => { b.log.push('flee'); return Status.Running; })]),
      new Action((b) => { b.log.push('wander'); return Status.Running; }, 'wander', () => resets++),
    ]);
    tree.tick(bb, 0.1); bb.alarm = true; tree.tick(bb, 0.1);
    expect(bb.log).toEqual(['wander', 'flee']); expect(resets).toBe(1);
  });
});

describe('utility AI', () => {
  it('compensated product keeps multi-consideration scores usable', () => {
    expect(score({}, [{ input: () => 0.8, curve: curves.linear() }, { input: () => 0.8, curve: curves.linear() }])).toBeGreaterThan(0.64);
  });
  it('hysteresis keeps the current choice on near ties', () => {
    let v = 0.5;
    const r = new Reasoner<null, 'a' | 'b'>([{ id: 'a', weight: 1, considerations: [{ input: () => v, curve: curves.linear() }] }, { id: 'b', weight: 1, considerations: [{ input: () => 0.52, curve: curves.linear() }] }], 0.1);
    expect(r.decide(null)).toBe('b'); v = 0.55; expect(r.decide(null)).toBe('b'); v = 0.8; expect(r.decide(null)).toBe('a');
  });
});

const host: Host = { fire() {}, meleeHit() {}, clawHit() {}, footstep() {}, ammo: () => 0, take: () => 0, heal: () => false, throwLure() {}, sfx() {} };
function scene(survivorX: number, crouch = false, light = 0.1) {
  const s = new Actor({ x: survivorX, survivor: 'reed' }), z = new Actor({ x: 10, infected: 'common' });
  z.facing = -1; z.state = 'idle';
  const w = { squad: [s], infected: [z], leader: s, time: 0, rng: new Rng(1), x0: 0, x1: 100, hold: { on: false, x: 0 }, slot: () => 0, lightAt: () => light, medical: () => 0, ammoFor: () => 0, weaponsFree: () => false, cry() {}, groan() {} } as AIWorld;
  const brain = new InfectedBrain();
  const run = (sec: number) => { for (let t = 0; t < sec; t += 1 / 60) { const it = idle(); it.crouch = crouch; s.step(1 / 60, it, host, 0, 100); w.time += 1 / 60; z.step(1 / 60, brain.think(z, w, 1 / 60), host, 0, 100); } };
  return { z, brain, run };
}
describe('infected perception', () => {
  it('spots a standing survivor in front and gives chase', () => { const t = scene(5); t.run(3); expect(t.z.state).toBe('chase'); });
  it('misses a survivor crouched in the dark at the same distance', () => { const t = scene(5, true); t.run(3); expect(t.z.state).not.toBe('chase'); });
  it('a lit survivor is seen from further away than one in the dark', () => { const dark = scene(7, true, 0.05); dark.run(3); const lit = scene(7, true, 1); lit.run(3); expect(lit.z.suspicion).toBeGreaterThan(dark.z.suspicion); });
  it('walks to a noise it hears', () => { const t = scene(40); t.brain.hear(t.z, 20, 0.8); expect(t.z.state).toBe('investigate'); t.run(2); expect(t.z.x).toBeGreaterThan(10.5); });
});
