import { describe, expect, it } from 'vitest';
import { createWorld } from '../src/physics/world';
import { createRagdoll, partPivot, shove } from '../src/physics/ragdoll';
import { PARTS, targetPose, type AnimIn } from '../src/game/rig';

const pose = targetPose({ t: 0, phase: 1, speed: 1.6, run: false, crouch: false, gait: 'survivor', stance: 'none', aim: 0, recoil: 0, melee: 0, reload: 0, heal: 0, hurt: 0, attack: 0, throwT: 0, dormant: false, drawn: false } as AnimIn);

describe('ragdoll', () => {
  it('spawns exactly at the animated pose (pivots match FK)', () => {
    const w = createWorld(0, 100), rd = createRagdoll(w, pose, 50, 0, 1, 1, { x: 0, y: 0 });
    const head = partPivot(rd, 'head'), torso = partPivot(rd, 'torso');
    expect(torso.x).toBeCloseTo(50, 3); expect(head.y).toBeGreaterThan(torso.y + 0.4);
  });
  for (const facing of [1, -1] as const) for (const scale of [1, 1.35]) {
    it(`falls, holds together and rests (facing ${facing}, scale ${scale})`, () => {
      const w = createWorld(0, 100), rd = createRagdoll(w, pose, 50, 0, facing, scale, { x: facing * 1.2, y: 0 });
      shove(rd, facing, 3);
      for (let i = 0; i < 60 * 6; i++) w.step(1 / 60, 8, 3);
      const t = rd.bodies.torso.getPosition();
      const mass = PARTS.reduce((m, p) => m + rd.bodies[p].getMass(), 0);
      expect(mass).toBeGreaterThan(40 * scale); expect(mass).toBeLessThan(150 * scale * scale);
      expect(t.y).toBeLessThan(0.5 * scale); expect(Math.abs(t.x - 50)).toBeLessThan(7);
      for (const p of PARTS) { const q = rd.bodies[p].getPosition(); expect(q.y).toBeGreaterThan(-0.05); expect(Math.hypot(q.x - t.x, q.y - t.y)).toBeLessThan(1.6 * scale); }
      expect(rd.bodies.torso.getLinearVelocity().length()).toBeLessThan(0.3);
    });
  }
});
