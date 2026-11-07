import { describe, expect, it } from 'vitest';
import manifest from '../src/game/assetManifest.json';
import { createWorld, STEP } from '../src/physics/world';
import { createSpriteRagdoll, kickAll, kickPart } from '../src/physics/spriteRagdoll';

const sheets = manifest.chars;

function drop(id: keyof typeof sheets, facing: 1 | -1, dv: number) {
  const world = createWorld(100);
  const rd = createSpriteRagdoll(world, sheets[id], 50, 1, facing, { x: 1.2 * facing, y: 0 });
  kickAll(rd, { x: dv * 0.45, y: 0.4 }); kickPart(rd, 'torso', { x: dv, y: 0.6 }); kickPart(rd, 'head', { x: dv * 1.3, y: 0.8 });
  for (let i = 0; i < 60 * 5; i++) world.step(STEP, 8, 3);
  return rd;
}

describe('sprite ragdoll (built from the painted cut-out parts)', () => {
  it('has every part and weighs roughly an adult', () => {
    const rd = drop('reed', 1, 0);
    expect([...rd.bodies.keys()].sort()).toEqual(['head', 'shinB', 'shinF', 'thighB', 'thighF', 'torso']);
    const mass = [...rd.bodies.values()].reduce((m, b) => m + b.getMass(), 0);
    expect(mass).toBeGreaterThan(40); expect(mass).toBeLessThan(120);
  });

  for (const id of ['reed', 'infected_a'] as const) for (const facing of [1, -1] as const) {
    it(`${id} collapses, stays together and comes to rest (facing ${facing})`, () => {
      const rd = drop(id, facing, 2.5 * facing);
      const t = rd.bodies.get('torso')!.getPosition();
      expect(t.y).toBeLessThan(0.6);
      expect(Math.abs(t.x - 50)).toBeLessThan(6);
      for (const b of rd.bodies.values()) {
        const p = b.getPosition();
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        expect(Math.hypot(p.x - t.x, p.y - t.y)).toBeLessThan(1.4);
        expect(p.y).toBeGreaterThan(-0.05);
      }
      expect(rd.bodies.get('torso')!.getLinearVelocity().length()).toBeLessThan(0.25);
    });
  }
});
