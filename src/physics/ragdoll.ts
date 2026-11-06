import * as planck from 'planck';
import { CAT, type FixtureTag } from './world';
import { DIMS, JOINTS, PART_ORDER, type PartName, type Skeleton } from '../game/rig';

let groupCounter = 0;

export interface Ragdoll {
  bodies: Record<PartName, planck.Body>;
  joints: planck.Joint[];
  age: number;
  facing: 1 | -1;
}

/** 2D density giving ~70 kg for an adult rig (total limb area ≈ 0.5 m²). */
export const FLESH_DENSITY = 140;

/** Centre of a part relative to its pivot, in the part's local (right-facing) frame. */
function centreOffset(n: PartName, s: number): [number, number] {
  const d = DIMS[n];
  if (n === 'torso') return [0, (d.len / 2) * s];
  if (n === 'head') return [0.02 * s, (d.len / 2) * s];
  return [0, (-d.len / 2) * s];
}

/**
 * Build a ragdoll matching the current animated skeleton exactly, inheriting the
 * actor's velocity. Each limb is a box; joints are revolute with angle limits.
 * referenceAngle = 0 so limits are expressed in the rest frame of the rig.
 */
export function createRagdoll(world: planck.World, skel: Skeleton, rootX: number, rootY: number, scale: number,
  facing: 1 | -1, vel: { x: number; y: number }, density = 1): Ragdoll {
  const group = -(++groupCounter % 30000) - 1;
  const bodies = {} as Record<PartName, planck.Body>;
  for (const n of PART_ORDER) {
    const xf = skel[n];
    const [ox, oy] = centreOffset(n, scale);
    const lx = ox * facing;                                   // mirror local offset
    const c = Math.cos(xf.a), s = Math.sin(xf.a);
    const cx = rootX + xf.x + lx * c - oy * s, cy = rootY + xf.y + lx * s + oy * c;
    const b = world.createDynamicBody({ position: { x: cx, y: cy }, angle: xf.a, linearDamping: 0.05, angularDamping: 0.6, linearVelocity: vel });
    const d = DIMS[n];
    const tag: FixtureTag = { kind: 'ragdoll', material: 'flesh' };
    const shape = n === 'head' ? new planck.Circle(d.width / 2 * scale) : new planck.Box((d.width / 2) * scale, (d.len / 2) * scale);
    const dens = FLESH_DENSITY * density * (n === 'torso' ? 1.1 : n === 'head' ? 0.9 : 0.8);
    b.createFixture(shape, { density: dens, friction: 0.7, restitution: 0.05, filterGroupIndex: group, filterCategoryBits: CAT.RAGDOLL, filterMaskBits: CAT.GROUND | CAT.PROP, userData: tag });
    bodies[n] = b;
  }
  const joints: planck.Joint[] = [];
  for (const j of JOINTS) {
    const child = skel[j.b];
    const lo = facing === 1 ? j.lo : -j.hi, hi = facing === 1 ? j.hi : -j.lo;
    // referenceAngle is honoured by planck at runtime but missing from RevoluteJointOpt's type.
    const opt: planck.RevoluteJointOpt & { referenceAngle: number } = {
      enableLimit: true, lowerAngle: lo, upperAngle: hi, referenceAngle: 0,
      enableMotor: true, maxMotorTorque: 6 * scale * scale * density, motorSpeed: 0,   // joint friction so limbs don't flail forever
    };
    const joint = world.createJoint(new planck.RevoluteJoint(opt, bodies[j.a], bodies[j.b], { x: rootX + child.x, y: rootY + child.y }));
    if (joint) joints.push(joint);
  }
  return { bodies, joints, age: 0, facing };
}

/** Add a velocity change (m/s) to one part — mass-independent, so tuning stays sane. */
export function kickPart(r: Ragdoll, part: PartName, dv: { x: number; y: number }): void {
  const b = r.bodies[part], m = b.getMass();
  b.applyLinearImpulse({ x: dv.x * m, y: dv.y * m }, b.getWorldCenter(), true);
}

/** Add a velocity change to every part (whole-body shove). */
export function kickAll(r: Ragdoll, dv: { x: number; y: number }): void {
  for (const n of PART_ORDER) kickPart(r, n, dv);
}

export function destroyRagdoll(world: planck.World, r: Ragdoll): void {
  for (const j of r.joints) world.destroyJoint(j);
  for (const n of PART_ORDER) world.destroyBody(r.bodies[n]);
}
