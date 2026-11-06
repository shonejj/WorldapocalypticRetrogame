/**
 * 2D cut-out skeleton shared by animation (alive) and ragdoll (dead).
 * Angles in radians, CCW positive, right-facing frame:
 *  - limbs hang down at 0; +angle swings the limb FORWARD
 *  - torso points up at 0; -angle leans FORWARD
 * Facing (-1) mirrors x and negates angles. Pure math: no Three/Planck imports.
 */
export type PartName = 'torso' | 'head' | 'uArmB' | 'lArmB' | 'uLegB' | 'lLegB' | 'uLegF' | 'lLegF' | 'uArmF' | 'lArmF';

/** Draw order back→front. */
export const PART_ORDER: PartName[] = ['uArmB', 'lArmB', 'uLegB', 'lLegB', 'torso', 'head', 'uLegF', 'lLegF', 'uArmF', 'lArmF'];

export interface PartDim { len: number; width: number }
/** Physical dimensions in metres (scale 1 = 1.84 m adult). */
export const DIMS: Record<PartName, PartDim> = {
  torso: { len: 0.60, width: 0.30 }, head: { len: 0.27, width: 0.24 },
  uArmF: { len: 0.30, width: 0.09 }, lArmF: { len: 0.30, width: 0.08 },
  uArmB: { len: 0.30, width: 0.09 }, lArmB: { len: 0.30, width: 0.08 },
  uLegF: { len: 0.46, width: 0.14 }, lLegF: { len: 0.46, width: 0.12 },
  uLegB: { len: 0.46, width: 0.14 }, lLegB: { len: 0.46, width: 0.12 },
};
export const NECK_Y = 0.60, SHOULDER_Y = 0.52;

export interface Pose {
  lean: number; neck: number;
  shF: number; elF: number; shB: number; elB: number;
  hipF: number; knF: number; hipB: number; knB: number;
  bob: number;           // extra vertical offset of the hips (m)
}
export const zeroPose = (): Pose => ({ lean: 0, neck: 0, shF: 0, elF: 0, shB: 0, elB: 0, hipF: 0, knF: 0, hipB: 0, knB: 0, bob: 0 });

export interface PartXf { x: number; y: number; a: number }
export type Skeleton = Record<PartName, PartXf> & { hand: PartXf; hipY: number };

const rot = (x: number, y: number, a: number): [number, number] => {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
};

/** Forward kinematics. Root = point on the ground between the feet. Each part's
 *  transform is its PIVOT position + absolute angle (in world, after facing). */
export function solve(p: Pose, scale: number, facing: 1 | -1, out?: Skeleton): Skeleton {
  const s = scale;
  const L = (n: PartName) => DIMS[n].len * s;
  // hip height so that the lower foot touches the ground
  const footDrop = (h: number, k: number) => L('uLegF') * Math.cos(h) + L('lLegF') * Math.cos(h + k);
  const hipY = Math.max(footDrop(p.hipF, p.knF), footDrop(p.hipB, p.knB)) + p.bob * s;
  const o = (out ?? ({} as Skeleton));
  const set = (n: PartName | 'hand', x: number, y: number, a: number) => {
    const t = (o[n] ??= { x: 0, y: 0, a: 0 }); t.x = x * facing; t.y = y; t.a = a * facing;
  };
  set('torso', 0, hipY, p.lean);
  const [nx, ny] = rot(0.02 * s, NECK_Y * s, p.lean);
  set('head', nx, hipY + ny, p.lean + p.neck);
  const [sx, sy] = rot(0, SHOULDER_Y * s, p.lean);
  const arm = (u: PartName, l: PartName, sh: number, el: number, hand: boolean) => {
    const ua = p.lean + sh; set(u, sx, hipY + sy, ua);
    const [ex, ey] = rot(0, -L(u), ua); const la = ua + el;
    set(l, sx + ex, hipY + sy + ey, la);
    if (hand) { const [hx, hy] = rot(0, -L(l) * 0.9, la); set('hand', sx + ex + hx, hipY + sy + ey + hy, la); }
  };
  arm('uArmB', 'lArmB', p.shB, p.elB, false);
  arm('uArmF', 'lArmF', p.shF, p.elF, true);
  const leg = (u: PartName, l: PartName, h: number, k: number) => {
    set(u, 0, hipY, h);
    const [kx, ky] = rot(0, -L(u), h); set(l, kx, hipY + ky, h + k);
  };
  leg('uLegB', 'lLegB', p.hipB, p.knB);
  leg('uLegF', 'lLegF', p.hipF, p.knF);
  o.hipY = hipY;
  return o;
}

/** Ragdoll joint table: parent, child, limits (relative angle child-parent in right-facing frame). */
export const JOINTS: { a: PartName; b: PartName; lo: number; hi: number }[] = [
  { a: 'torso', b: 'head', lo: -0.6, hi: 0.5 },
  { a: 'torso', b: 'uArmF', lo: -1.2, hi: 2.8 }, { a: 'uArmF', b: 'lArmF', lo: 0, hi: 2.4 },
  { a: 'torso', b: 'uArmB', lo: -1.2, hi: 2.8 }, { a: 'uArmB', b: 'lArmB', lo: 0, hi: 2.4 },
  { a: 'torso', b: 'uLegF', lo: -0.5, hi: 1.9 }, { a: 'uLegF', b: 'lLegF', lo: -2.4, hi: 0 },
  { a: 'torso', b: 'uLegB', lo: -0.5, hi: 1.9 }, { a: 'uLegB', b: 'lLegB', lo: -2.4, hi: 0 },
];

// ---------------------------------------------------------------- procedural animation
export type Gait = 'human' | 'shamble' | 'sprint' | 'brute';
export type WeaponHold = 'none' | 'pistol' | 'long' | 'melee';

export interface AnimInput {
  speed: number;        // m/s ground speed (abs)
  run: boolean;
  crouch: boolean;
  aim: boolean;
  hold: WeaponHold;
  meleeT: number;       // 0..1 progress of a melee swing, <0 if none
  recoil: number;       // 0..1 decays after shots
  hurt: number;         // 0..1 flinch
  attackT: number;      // infected lunge 0..1, <0 none
  time: number;         // seconds (for idle breathing)
  phase: number;        // walk cycle phase (rad), advanced by caller
  gait: Gait;
  dormant: boolean;
  lean: number;         // extra lean (e.g. hunched)
}

export function targetPose(i: AnimInput, out: Pose = zeroPose()): Pose {
  const p = out;
  const moving = i.speed > 0.15;
  const φ = i.phase;
  const amp = Math.min(1, i.speed / (i.run ? 4 : 1.6));
  p.bob = 0; p.neck = 0;
  if (i.dormant) {            // slumped sitting against something
    Object.assign(p, { lean: 0.35, neck: 0.5, shF: 0.2, elF: 0.4, shB: -0.1, elB: 0.3, hipF: 1.5, knF: -1.4, hipB: 1.45, knB: -1.6, bob: 0 });
    return p;
  }
  if (moving) {
    const stride = i.run ? 0.75 : 0.45;
    p.hipF = stride * amp * Math.sin(φ);
    p.hipB = stride * amp * Math.sin(φ + Math.PI);
    p.knF = -(i.run ? 1.3 : 0.75) * amp * Math.max(0, Math.cos(φ));
    p.knB = -(i.run ? 1.3 : 0.75) * amp * Math.max(0, Math.cos(φ + Math.PI));
    p.bob = (i.run ? 0.035 : 0.02) * Math.abs(Math.sin(φ)) * amp;
    p.shF = -0.5 * stride * amp * Math.sin(φ); p.shB = 0.5 * stride * amp * Math.sin(φ);
    p.elF = 0.25 + (i.run ? 0.9 : 0.25); p.elB = 0.25 + (i.run ? 0.9 : 0.25);
    p.lean = i.run ? -0.22 : -0.05;
  } else {
    const br = Math.sin(i.time * 1.7) * 0.02;
    p.hipF = 0.06; p.hipB = -0.05; p.knF = -0.04; p.knB = -0.02;
    p.shF = 0.06 + br; p.shB = -0.04 - br; p.elF = 0.18; p.elB = 0.15; p.lean = br * 0.5; p.neck = br;
  }
  if (i.crouch) {
    p.hipF += 1.05; p.hipB += 0.95; p.knF -= 1.75; p.knB -= 1.85; p.lean -= 0.35; p.neck += 0.25;
  }
  // gait flavour
  if (i.gait === 'shamble' || i.gait === 'brute') {
    p.lean -= i.gait === 'brute' ? 0.25 : 0.32; p.neck += 0.35 + Math.sin(i.time * 2.3) * 0.12;
    p.shF = 1.15 + Math.sin(φ) * 0.18; p.shB = 0.95 + Math.sin(φ + 1.3) * 0.18; p.elF = 0.15; p.elB = 0.25;
    p.knB *= 0.4;            // limp: stiff back leg
  } else if (i.gait === 'sprint') {
    p.lean -= 0.3; p.shF = -0.9 * Math.sin(φ) + 0.4; p.shB = 0.9 * Math.sin(φ) + 0.4; p.elF = 1.2; p.elB = 1.2;
  }
  p.lean += i.lean;
  // weapon holds (front arm F = trigger hand)
  if (i.aim && i.hold === 'pistol') {
    p.shF = Math.PI / 2 - p.lean - 0.02; p.elF = 0.02; p.shB = Math.PI / 2 - p.lean - 0.25; p.elB = 0.45;
    p.shF += i.recoil * 0.35; p.elF += i.recoil * 0.2;
  } else if (i.aim && i.hold === 'long') {
    p.shF = 1.15 - p.lean; p.elF = 0.42; p.shB = 1.42 - p.lean; p.elB = 0.15;
    p.shF += i.recoil * 0.2; p.shB += i.recoil * 0.15; p.lean += i.recoil * 0.06;
  } else if (!i.aim && i.hold === 'long') {
    p.shF = 0.35; p.elF = 0.9; p.shB = 0.8; p.elB = 0.7;
  }
  if (i.meleeT >= 0) {        // overhead swing: wind-up → strike → follow-through
    const t = i.meleeT;
    const sh = t < 0.35 ? 0.3 + (t / 0.35) * 2.6 : 2.9 - Math.min(1, (t - 0.35) / 0.25) * 3.1;
    p.shF = sh; p.elF = t < 0.35 ? 0.9 : 0.15; p.lean += t < 0.35 ? 0.1 : -0.2;
  }
  if (i.attackT >= 0) {       // infected lunge / claw
    const t = i.attackT, k = t < 0.5 ? t / 0.5 : 1 - (t - 0.5) / 0.5;
    p.lean -= 0.35 * k; p.shF = 1.0 + 1.6 * k; p.shB = 0.9 + 1.2 * k; p.elF = 0.1; p.elB = 0.1;
  }
  if (i.hurt > 0) { p.lean += 0.25 * i.hurt; p.neck -= 0.3 * i.hurt; }
  return p;
}

/** Exponentially approach target pose (frame-rate independent). */
export function blendPose(cur: Pose, tgt: Pose, rate: number, dt: number): void {
  const k = 1 - Math.exp(-rate * dt);
  for (const key in tgt) (cur as unknown as Record<string, number>)[key] += ((tgt as unknown as Record<string, number>)[key] - (cur as unknown as Record<string, number>)[key]) * k;
}
