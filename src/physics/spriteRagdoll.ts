import * as planck from 'planck';
import { CAT, type FixtureTag } from './world';

/** Minimal description of a character's cut-out parts (from the asset manifest). */
export interface RagdollSheet {
  cellH: number; footX: number; figureH: number;
  parts: { list: { name: string; aw: number; ah: number; x: number; y: number }[]; joints: Record<string, number[]> };
}

export interface SpriteRagdoll {
  bodies: Map<string, planck.Body>;
  joints: planck.Joint[];
  facing: 1 | -1;
  k: number;               // metres per sheet pixel
}

export const HUMAN_HEIGHT = 1.85;
const DENSITY = 95;        // 2D density → ~80 kg for an adult figure
let group = 0;

const JOINTS: { a: string; b: string; at: string; lo: number; hi: number }[] = [
  { a: 'torso', b: 'head', at: 'neck', lo: -0.55, hi: 0.5 },
  { a: 'torso', b: 'thighB', at: 'hipB', lo: -0.6, hi: 1.6 },
  { a: 'torso', b: 'thighF', at: 'hipF', lo: -0.6, hi: 1.6 },
  { a: 'thighB', b: 'shinB', at: 'kneeB', lo: -2.1, hi: 0.05 },
  { a: 'thighF', b: 'shinF', at: 'kneeF', lo: -2.1, hi: 0.05 },
];

/** Sheet pixel → world offset from the actor's feet. */
export function sheetToWorld(s: RagdollSheet, px: number, py: number, scale: number, facing: 1 | -1): [number, number] {
  const k = (HUMAN_HEIGHT * scale) / s.figureH, footY = s.cellH - 3;
  return [(px - s.footX) * k * facing, (footY - py) * k];
}

/**
 * Turn a character's painted pose into a physical ragdoll: one body per cut-out
 * part, revolute joints at neck/hips/knees with limits (mirrored for facing).
 */
export function createSpriteRagdoll(world: planck.World, s: RagdollSheet, x: number, scale: number, facing: 1 | -1,
  vel: { x: number; y: number }, density = 1): SpriteRagdoll {
  const g = -(++group % 30000) - 1;
  const k = (HUMAN_HEIGHT * scale) / s.figureH;
  const bodies = new Map<string, planck.Body>();
  for (const p of s.parts.list) {
    const [cx, cy] = sheetToWorld(s, p.x + p.aw / 2, p.y + p.ah / 2, scale, facing);
    const b = world.createDynamicBody({ position: { x: x + cx, y: Math.max(0.05, cy) }, linearVelocity: vel, linearDamping: 0.05, angularDamping: 0.7 });
    const tag: FixtureTag = { kind: 'ragdoll', material: 'flesh' };
    const shape = p.name === 'head' ? new planck.Circle(Math.min(p.aw, p.ah) * k * 0.42) : new planck.Box(p.aw * k * 0.36, p.ah * k * 0.46);
    b.createFixture(shape, { density: DENSITY * density * (p.name === 'torso' ? 1 : 1.3), friction: 0.75, restitution: 0.04, filterGroupIndex: g, filterCategoryBits: CAT.RAGDOLL, filterMaskBits: CAT.GROUND | CAT.PROP, userData: tag });
    bodies.set(p.name, b);
  }
  const joints: planck.Joint[] = [];
  for (const j of JOINTS) {
    const A = bodies.get(j.a), B = bodies.get(j.b), at = s.parts.joints[j.at];
    if (!A || !B || !at) continue;
    const [ax, ay] = sheetToWorld(s, at[0], at[1], scale, facing);
    const lo = facing === 1 ? j.lo : -j.hi, hi = facing === 1 ? j.hi : -j.lo;
    const opt: planck.RevoluteJointOpt & { referenceAngle: number } = { enableLimit: true, lowerAngle: lo, upperAngle: hi, referenceAngle: 0, enableMotor: true, maxMotorTorque: 18 * scale * scale * density, motorSpeed: 0 };
    const jt = world.createJoint(new planck.RevoluteJoint(opt, A, B, { x: x + ax, y: ay }));
    if (jt) joints.push(jt);
  }
  return { bodies, joints, facing, k };
}

export function kickPart(r: SpriteRagdoll, part: string, dv: { x: number; y: number }): void {
  const b = r.bodies.get(part); if (!b) return;
  const m = b.getMass(); b.applyLinearImpulse({ x: dv.x * m, y: dv.y * m }, b.getWorldCenter(), true);
}
export function kickAll(r: SpriteRagdoll, dv: { x: number; y: number }): void { for (const n of r.bodies.keys()) kickPart(r, n, dv); }
export function destroySpriteRagdoll(world: planck.World, r: SpriteRagdoll): void {
  for (const j of r.joints) world.destroyJoint(j);
  for (const b of r.bodies.values()) world.destroyBody(b);
}
