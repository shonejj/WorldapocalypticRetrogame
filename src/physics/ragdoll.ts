import * as planck from 'planck';
import { CAT, kick, type Tag } from './world';
import { JOINTS, PARTS, SEG, solve, type Part, type Pose } from '../game/rig';

/** Ragdoll built from the rig's own FK, so it starts in exactly the animated pose. */
export interface Ragdoll { bodies: Record<Part, planck.Body>; joints: planck.Joint[]; facing: 1 | -1; scale: number }

const LEN: Record<Part, number> = {
  torso: SEG.torso, head: SEG.head, upperArmF: SEG.upperArm, upperArmB: SEG.upperArm, foreArmF: SEG.foreArm + 0.06, foreArmB: SEG.foreArm + 0.06,
  thighF: SEG.thigh, thighB: SEG.thigh, shinF: SEG.shin + 0.06, shinB: SEG.shin + 0.06,
};
const WIDTH: Record<Part, number> = { torso: 0.3, head: 0.22, upperArmF: 0.1, upperArmB: 0.1, foreArmF: 0.09, foreArmB: 0.09, thighF: 0.15, thighB: 0.15, shinF: 0.12, shinB: 0.12 };
const UP = (p: Part) => p === 'torso' || p === 'head';
const DENSITY = 150;                                   // ≈ 75 kg for an adult (2D area units)
let groupId = 0;

export function createRagdoll(w: planck.World, pose: Pose, x: number, y: number, facing: 1 | -1, scale: number,
  vel: { x: number; y: number }, density = 1): Ragdoll {
  const sk = solve(pose, scale), group = -(++groupId % 30000) - 1;
  const bodies = {} as Record<Part, planck.Body>;
  for (const p of PARTS) {
    const xf = sk[p], a = xf.a * facing, len = LEN[p] * scale;
    const dir = UP(p) ? { x: -Math.sin(a), y: Math.cos(a) } : { x: Math.sin(a), y: -Math.cos(a) };
    const px = x + xf.x * facing, py = y + xf.y;
    const b = w.createDynamicBody({ position: { x: px + dir.x * len / 2, y: Math.max(0.06, py + dir.y * len / 2) }, angle: a, linearVelocity: vel, angularDamping: 0.8, linearDamping: 0.05 });
    const tag: Tag = { kind: 'ragdoll', material: 'flesh' };
    const shape = p === 'head' ? new planck.Circle(0.11 * scale) : new planck.Box(WIDTH[p] * scale / 2, len / 2);
    b.createFixture(shape, { density: DENSITY * density * (p === 'torso' ? 1 : 1.25), friction: 0.8, restitution: 0.04, filterGroupIndex: group, filterCategoryBits: CAT.RAGDOLL, filterMaskBits: CAT.GROUND | CAT.PROP, userData: tag });
    bodies[p] = b;
  }
  const joints: planck.Joint[] = [];
  for (const j of JOINTS) {
    const c = sk[j.child], lo = facing > 0 ? j.lo : -j.hi, hi = facing > 0 ? j.hi : -j.lo;
    // planck honours referenceAngle at runtime (missing from the anchor-form typing)
    const opt: planck.RevoluteJointOpt & { referenceAngle: number } = { enableLimit: true, lowerAngle: lo, upperAngle: hi, referenceAngle: 0, enableMotor: true, maxMotorTorque: 14 * scale * scale * density, motorSpeed: 0 };
    const jt = w.createJoint(new planck.RevoluteJoint(opt, bodies[j.parent], bodies[j.child], { x: x + c.x * facing, y: y + c.y }));
    if (jt) joints.push(jt);
  }
  return { bodies, joints, facing, scale };
}

/** Pivot world position + world angle of a part (inverse of the centre offset). */
export function partPivot(r: Ragdoll, p: Part): { x: number; y: number; a: number } {
  const b = r.bodies[p], a = b.getAngle(), c = b.getPosition(), len = LEN[p] * r.scale;
  const dir = UP(p) ? { x: -Math.sin(a), y: Math.cos(a) } : { x: Math.sin(a), y: -Math.cos(a) };
  return { x: c.x - dir.x * len / 2, y: c.y - dir.y * len / 2, a };
}

export function shove(r: Ragdoll, dir: number, power: number): void {
  for (const p of PARTS) kick(r.bodies[p], dir * power * 0.4, power * 0.25);
  kick(r.bodies.torso, dir * power, power * 0.4);
  kick(r.bodies.head, dir * power * 1.3, power * 0.5);
}

export function destroyRagdoll(w: planck.World, r: Ragdoll): void {
  for (const j of r.joints) w.destroyJoint(j);
  for (const p of PARTS) w.destroyBody(r.bodies[p]);
}
