import { describe, expect, it } from 'vitest';
import { createWorld, STEP } from '../src/physics/world';
import { createRagdoll, kickAll, kickPart } from '../src/physics/ragdoll';
import { PART_ORDER, solve, targetPose, zeroPose } from '../src/game/rig';

function settle(facing: 1 | -1, dv: number) {
  const world = createWorld(100);
  const pose = targetPose({ speed: 1.6, run: false, crouch: false, aim: false, hold: 'none', meleeT: -1, recoil: 0, hurt: 0, attackT: -1, time: 0, phase: 1, gait: 'human', dormant: false, lean: 0 }, zeroPose());
  const skel = solve(pose, 1, facing);
  const rd = createRagdoll(world, skel, 50, 0, 1, facing, { x: 1.2 * facing, y: 0 });
  kickAll(rd, { x: dv * 0.45, y: 0.4 }); kickPart(rd, 'torso', { x: dv, y: 0.6 }); kickPart(rd, 'head', { x: dv * 1.3, y: 0.8 });
  for (let i = 0; i < 60 * 5; i++) world.step(STEP, 8, 3);
  return rd;
}

describe('ragdoll', () => {
  it('weighs roughly an adult', () => {
    const rd = settle(1, 0);
    const mass = PART_ORDER.reduce((m, n) => m + rd.bodies[n].getMass(), 0);
    expect(mass).toBeGreaterThan(45); expect(mass).toBeLessThan(110);
  });

  for (const facing of [1, -1] as const) {
    it(`collapses to the floor and stays together (facing ${facing})`, () => {
      const rd = settle(facing, 2.5 * facing);
      const t = rd.bodies.torso.getPosition();
      expect(t.y).toBeLessThan(0.45);                       // lying down
      expect(Math.abs(t.x - 50)).toBeLessThan(6);           // knocked back, not launched
      for (const n of PART_ORDER) {
        const p = rd.bodies[n].getPosition();
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        expect(Math.hypot(p.x - t.x, p.y - t.y)).toBeLessThan(1.3);   // joints held
        expect(p.y).toBeGreaterThan(-0.05);                // nothing through the ground
      }
      expect(rd.bodies.torso.getLinearVelocity().length()).toBeLessThan(0.2);   // at rest
    });
  }
});
