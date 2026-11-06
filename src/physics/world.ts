import * as planck from 'planck';

/** Collision categories (bit flags). */
export const CAT = {
  GROUND: 0x0001, SURVIVOR: 0x0002, INFECTED: 0x0004, PROP: 0x0008, RAGDOLL: 0x0010, DEBRIS: 0x0020,
} as const;

export const GRAVITY = -22;
export const STEP = 1 / 60;

export interface FixtureTag { kind: 'ground' | 'prop' | 'actor' | 'ragdoll'; id?: number; material?: 'metal' | 'wood' | 'flesh' | 'concrete' }

export function createWorld(levelWidth: number): planck.World {
  const world = new planck.World({ gravity: { x: 0, y: GRAVITY } });
  const ground = world.createBody();
  const tag: FixtureTag = { kind: 'ground', material: 'concrete' };
  ground.createFixture(new planck.Edge({ x: -20, y: 0 }, { x: levelWidth + 20, y: 0 }), { friction: 0.9, filterCategoryBits: CAT.GROUND, userData: tag });
  // invisible end walls
  ground.createFixture(new planck.Edge({ x: -0.5, y: 0 }, { x: -0.5, y: 30 }), { filterCategoryBits: CAT.GROUND, userData: tag });
  ground.createFixture(new planck.Edge({ x: levelWidth + 0.5, y: 0 }, { x: levelWidth + 0.5, y: 30 }), { filterCategoryBits: CAT.GROUND, userData: tag });
  return world;
}

export interface RayHit { fixture: planck.Fixture; point: { x: number; y: number }; normal: { x: number; y: number }; fraction: number }

/** Closest hit along a segment, filtered by category mask and an optional predicate. */
export function rayCastClosest(world: planck.World, from: { x: number; y: number }, to: { x: number; y: number }, mask: number,
  accept?: (f: planck.Fixture) => boolean): RayHit | null {
  let best: RayHit | null = null;
  world.rayCast(from, to, (fixture, point, normal, fraction) => {
    if (fixture.isSensor()) return -1;
    if (!(fixture.getFilterCategoryBits() & mask)) return -1;
    if (accept && !accept(fixture)) return -1;
    best = { fixture, point: { x: point.x, y: point.y }, normal: { x: normal.x, y: normal.y }, fraction };
    return fraction;     // clip ray to this hit → keeps looking for closer ones
  });
  return best;
}
