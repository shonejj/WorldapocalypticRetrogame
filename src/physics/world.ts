import * as planck from 'planck';

/**
 * 2D physics in the gameplay plane (physics-tuning): fixed 60 Hz step, named collision
 * categories with both-sided masks, sane densities (2D kg/m²), sleeping on.
 * Characters are kinematic gameplay entities (not bodies); physics is used for props,
 * debris, thrown lures and ragdolls.
 */
export const CAT = { GROUND: 1, PROP: 2, RAGDOLL: 4, DEBRIS: 8, LURE: 16 } as const;
export interface Tag { kind: 'ground' | 'prop' | 'ragdoll' | 'lure'; material: 'concrete' | 'metal' | 'wood' | 'plastic' | 'glass' | 'flesh'; id?: number }

export function createWorld(x0: number, x1: number): planck.World {
  const w = new planck.World({ gravity: { x: 0, y: -22 }, allowSleep: true });
  const g = w.createBody();
  const tag: Tag = { kind: 'ground', material: 'concrete' };
  const mask = CAT.PROP | CAT.RAGDOLL | CAT.DEBRIS | CAT.LURE;
  g.createFixture(new planck.Edge({ x: x0 - 30, y: 0 }, { x: x1 + 30, y: 0 }), { friction: 0.85, filterCategoryBits: CAT.GROUND, filterMaskBits: mask, userData: tag });
  for (const x of [x0 - 0.3, x1 + 0.3]) g.createFixture(new planck.Edge({ x, y: 0 }, { x, y: 40 }), { filterCategoryBits: CAT.GROUND, filterMaskBits: mask, userData: tag });
  return w;
}

export interface Hit { tag: Tag; body: planck.Body; point: { x: number; y: number }; normal: { x: number; y: number }; fraction: number }

/** Closest non-sensor hit along a segment, filtered by category mask. */
export function raycast(w: planck.World, a: { x: number; y: number }, b: { x: number; y: number }, mask: number): Hit | null {
  let best: Hit | null = null;
  w.rayCast(a, b, (f, p, n, frac) => {
    if (f.isSensor() || !(f.getFilterCategoryBits() & mask)) return -1;
    best = { tag: f.getUserData() as Tag, body: f.getBody(), point: { x: p.x, y: p.y }, normal: { x: n.x, y: n.y }, fraction: frac };
    return frac;
  });
  return best;
}

/** Give a body a velocity change (mass-independent impulse) at a point. */
export function kick(b: planck.Body, dvx: number, dvy: number, at?: { x: number; y: number }): void {
  const m = b.getMass(); b.applyLinearImpulse({ x: dvx * m, y: dvy * m }, at ?? b.getWorldCenter(), true);
}
