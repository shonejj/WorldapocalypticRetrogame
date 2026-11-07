/**
 * Character rig — pure math shared by animation, rendering and ragdoll (no three/planck here).
 * 2D side-view angles in radians in the character's RIGHT-FACING frame:
 *   limbs hang down at 0, +angle swings FORWARD (+x); spine/head point up at 0, −angle leans forward.
 * Facing −1 is applied by the renderer (rotate 180° about Y) and by mirroring for physics.
 */
export const SEG = {
  torso: 0.52, head: 0.24, upperArm: 0.30, foreArm: 0.29, thigh: 0.45, shin: 0.44, ankle: 0.06, shoulderAt: 0.46,
} as const;
export const PARTS = ['torso', 'head', 'upperArmB', 'foreArmB', 'thighB', 'shinB', 'thighF', 'shinF', 'upperArmF', 'foreArmF'] as const;
export type Part = (typeof PARTS)[number];

export interface Pose {
  bob: number; lean: number; neck: number;
  shF: number; elF: number; shB: number; elB: number;
  thF: number; knF: number; thB: number; knB: number;
  gun: number;          // weapon angle relative to torso (0 = horizontal forward)
  gunY: number;         // weapon height offset along torso (0 = shoulder)
  lie: number;          // 0 standing … 1 lying (dormant / downed), applied as root rotation
}
export const zeroPose = (): Pose => ({ bob: 0, lean: 0, neck: 0, shF: 0, elF: 0, shB: 0, elB: 0, thF: 0, knF: 0, thB: 0, knB: 0, gun: -1.2, gunY: 0, lie: 0 });
const KEYS = Object.keys(zeroPose()) as (keyof Pose)[];

/** Hip height that keeps the lowest foot on the ground. */
export function hipHeight(p: Pose, scale = 1): number {
  const drop = (th: number, kn: number) => SEG.thigh * Math.cos(th) + SEG.shin * Math.cos(th + kn) + SEG.ankle;
  return (Math.max(drop(p.thF, p.knF), drop(p.thB, p.knB)) + p.bob) * scale;
}

export interface XForm { x: number; y: number; a: number }
export type Skeleton = Record<Part, XForm> & { hipY: number };

/** Forward kinematics: pivot position + absolute angle of each part (feet-root frame, facing +x). */
export function solve(p: Pose, scale = 1): Skeleton {
  const s = scale, hipY = hipHeight(p, s);
  const rot = (x: number, y: number, a: number): [number, number] => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  const out = { hipY } as Skeleton;
  out.torso = { x: 0, y: hipY, a: p.lean };
  const [hx, hy] = rot(0, SEG.torso * s, p.lean); out.head = { x: hx, y: hipY + hy, a: p.lean + p.neck };
  const [sx, sy] = rot(0, SEG.shoulderAt * s, p.lean);
  const arm = (u: Part, f: Part, sh: number, el: number) => {
    const ua = p.lean + sh; out[u] = { x: sx, y: hipY + sy, a: ua };
    const [ex, ey] = rot(0, -SEG.upperArm * s, ua); out[f] = { x: sx + ex, y: hipY + sy + ey, a: ua + el };
  };
  arm('upperArmB', 'foreArmB', p.shB, p.elB); arm('upperArmF', 'foreArmF', p.shF, p.elF);
  const leg = (t: Part, sh: Part, th: number, kn: number) => {
    out[t] = { x: 0, y: hipY, a: th };
    const [kx, ky] = rot(0, -SEG.thigh * s, th); out[sh] = { x: kx, y: hipY + ky, a: th + kn };
  };
  leg('thighB', 'shinB', p.thB, p.knB); leg('thighF', 'shinF', p.thF, p.knF);
  return out;
}

/** Ragdoll joint table: child pivots on parent; limits are child-minus-parent angle (facing +x). */
export const JOINTS: { parent: Part; child: Part; lo: number; hi: number }[] = [
  { parent: 'torso', child: 'head', lo: -0.7, hi: 0.5 },
  { parent: 'torso', child: 'upperArmF', lo: -1.4, hi: 2.9 }, { parent: 'upperArmF', child: 'foreArmF', lo: 0, hi: 2.4 },
  { parent: 'torso', child: 'upperArmB', lo: -1.4, hi: 2.9 }, { parent: 'upperArmB', child: 'foreArmB', lo: 0, hi: 2.4 },
  { parent: 'torso', child: 'thighF', lo: -0.6, hi: 1.9 }, { parent: 'thighF', child: 'shinF', lo: -2.4, hi: 0 },
  { parent: 'torso', child: 'thighB', lo: -0.6, hi: 1.9 }, { parent: 'thighB', child: 'shinB', lo: -2.4, hi: 0 },
];

// ---------------------------------------------------------------- procedural animation
export type Stance = 'none' | 'pistol' | 'long';
export type Gait = 'survivor' | 'shamble' | 'sprint' | 'brute';
export interface AnimIn {
  t: number; phase: number; speed: number; run: boolean; crouch: boolean;
  gait: Gait; stance: Stance; aim: number;       // 0 lowered … 1 fully aimed (blended)
  recoil: number; melee: number; reload: number; heal: number; hurt: number; attack: number; throwT: number;
  dormant: boolean; drawn: boolean;
  /** contextual task the actor is doing (skinned bodies pick a matching clip) */
  task?: 'search' | 'interact' | null;
}

export function targetPose(i: AnimIn, p: Pose = zeroPose()): Pose {
  const φ = i.phase, moving = i.speed > 0.12;
  const amp = Math.min(1, i.speed / (i.run ? 4.2 : 1.7));
  Object.assign(p, zeroPose());
  if (i.dormant) { Object.assign(p, { lean: -0.2, neck: 0.55, shF: 0.35, elF: 0.6, shB: 0.15, elB: 0.5, thF: 1.45, knF: -1.5, thB: 1.35, knB: -1.7, lie: 1, gun: -1.2 }); return p; }
  if (moving) {
    const stride = i.run ? 0.72 : 0.42;
    p.thF = stride * amp * Math.sin(φ); p.thB = -stride * amp * Math.sin(φ);
    p.knF = -(i.run ? 1.35 : 0.7) * amp * Math.max(0, Math.cos(φ)) - 0.05;
    p.knB = -(i.run ? 1.35 : 0.7) * amp * Math.max(0, -Math.cos(φ)) - 0.05;
    p.bob = (i.run ? 0.035 : 0.018) * Math.abs(Math.sin(φ)) * amp;
    p.shF = -0.55 * stride * amp * Math.sin(φ); p.shB = 0.55 * stride * amp * Math.sin(φ);
    p.elF = p.elB = i.run ? 1.25 : 0.3;
    p.lean = i.run ? -0.2 : -0.04;
  } else {
    const br = Math.sin(i.t * 1.6) * 0.02;
    p.thF = 0.08; p.thB = -0.06; p.knF = -0.05; p.knB = -0.03;
    p.shF = 0.06 + br; p.shB = -0.05 - br; p.elF = 0.22; p.elB = 0.18; p.lean = br * 0.5; p.neck = br * 0.6;
  }
  if (i.crouch) { p.thF += 1.1; p.thB += 0.95; p.knF -= 1.8; p.knB -= 1.9; p.lean -= 0.42; p.neck += 0.3; }

  // infected gaits: hunched, arms reaching, irregular limp
  if (i.gait !== 'survivor') {
    const lurch = Math.sin(i.t * 2.3 + φ * 0.5);
    p.lean -= i.gait === 'brute' ? 0.22 : i.gait === 'sprint' ? 0.42 : 0.32;
    p.neck += 0.35 + lurch * 0.12;
    if (i.gait === 'sprint' && moving) { p.shF = -1.0 * Math.sin(φ) + 0.6; p.shB = 1.0 * Math.sin(φ) + 0.6; p.elF = p.elB = 1.1; }
    else if (i.run) { p.shF = 0.95 + Math.sin(φ + 0.4) * 0.25; p.shB = 0.75 + Math.sin(φ + 1.6) * 0.25; p.elF = 0.3; p.elB = 0.45; }   // chasing: grasping forward
    else {   // unaware: hunched, arms hanging loose and swaying (reference posture, not "zombie arms")
      p.lean -= 0.12; p.neck += 0.12;
      p.shF = 0.32 + Math.sin(φ + 0.4) * 0.14 + Math.sin(i.t * 1.3) * 0.05; p.shB = 0.18 + Math.sin(φ + 1.6) * 0.12; p.elF = 0.35; p.elB = 0.25;
    }
    p.knB *= 0.45;                                       // stiff dragging leg
    if (i.attack > 0) { const k = Math.sin(Math.min(1, i.attack) * Math.PI); p.lean -= 0.35 * k; p.shF = 1.1 + 1.6 * k; p.shB = 1.0 + 1.3 * k; p.elF = p.elB = 0.15; }
    if (i.hurt > 0) { p.lean += 0.3 * i.hurt; p.neck -= 0.4 * i.hurt; }
    return p;
  }

  // survivors: weapon handling. gun angle is relative to the torso.
  const aim = i.aim;
  if (i.stance === 'long' && i.drawn) {
    // low-ready → shouldered
    const lowered = { gun: -0.55, gunY: -0.12, shF: 0.75, elF: 0.95, shB: 0.35, elB: 1.2 };
    const raised = { gun: 0, gunY: 0, shF: 1.25, elF: 0.55, shB: 0.55, elB: 1.75 };
    for (const k of ['gun', 'gunY', 'shF', 'elF', 'shB', 'elB'] as const) p[k] = lowered[k] + (raised[k] - lowered[k]) * aim - (k === 'shF' || k === 'shB' ? p.lean : 0) * aim;
    p.gun -= i.recoil * 0.12; p.shF -= i.recoil * 0.15; p.lean += i.recoil * 0.05;
  } else if (i.stance === 'pistol' && i.drawn) {
    const lowered = { gun: -0.9, gunY: -0.1, shF: 0.35, elF: 0.4, shB: 0.25, elB: 0.6 };
    const raised = { gun: 0, gunY: 0.02, shF: 1.48, elF: 0.08, shB: 1.3, elB: 0.45 };
    for (const k of ['gun', 'gunY', 'shF', 'elF', 'shB', 'elB'] as const) p[k] = lowered[k] + (raised[k] - lowered[k]) * aim - (k === 'shF' || k === 'shB' ? p.lean : 0) * aim;
    p.gun -= i.recoil * 0.3; p.shF += i.recoil * 0.25; p.elF += i.recoil * 0.25;
  } else p.gun = -1.25;                                     // slung on the back
  if (i.reload > 0) { const k = Math.sin(i.reload * Math.PI); p.gun = -0.6; p.gunY = -0.12; p.shB = 0.9 + 0.5 * k; p.elB = 1.6; p.shF = 0.7; p.elF = 1.0; p.neck += 0.35 * k; }
  if (i.heal > 0) { p.thF += 1.2; p.knF -= 2.0; p.thB += 0.2; p.knB -= 1.9; p.lean -= 0.35; p.shF = 1.0; p.elF = 1.4; p.shB = 0.9; p.elB = 1.5; p.neck += 0.4; }
  if (i.melee > 0) {                                        // wind-up → strike → follow-through
    const t = i.melee;
    const sh = t < 0.35 ? 0.4 + (t / 0.35) * 2.5 : 2.9 - Math.min(1, (t - 0.35) / 0.25) * 3.2;
    p.shF = sh; p.elF = t < 0.35 ? 1.0 : 0.15; p.shB = sh - 0.2; p.elB = 0.6; p.lean += t < 0.35 ? 0.12 : -0.25;
    p.gun = sh - Math.PI / 2 - 0.2; p.gunY = 0;
  }
  if (i.throwT > 0) { const t = i.throwT; p.shF = t < 0.5 ? 2.8 * (t / 0.5) : 2.8 - (t - 0.5) * 4; p.elF = 0.5; }
  if (i.hurt > 0) { p.lean += 0.22 * i.hurt; p.neck -= 0.3 * i.hurt; }
  return p;
}

/** Exponential blend toward the target pose (frame-rate independent). */
export function blendPose(cur: Pose, tgt: Pose, rate: number, dt: number): void {
  const k = 1 - Math.exp(-rate * dt);
  for (const key of KEYS) cur[key] += (tgt[key] - cur[key]) * k;
}
