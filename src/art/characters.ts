import * as THREE from 'three';
import { Rng } from '../core/math';
import { M } from './kit';
import { PARTS, SEG, type Part, type Pose } from '../game/rig';
import { weaponMesh, type WeaponKind } from './weapons';

/**
 * Characters authored in code on the shared rig (create-game-assets "character family").
 * Readable silhouettes at game scale: backpack / headwear / weapon identify each survivor;
 * infected read through hunched pose, pale skin, darker torn clothes. All parts pivot exactly
 * where the rig's FK says, so animation and the physics ragdoll drive the same hierarchy.
 */
export interface Look {
  skin: number; hair: number; hairStyle: 'short' | 'messy' | 'ponytail' | 'buzz' | 'long' | 'bald';
  beard?: boolean; headwear?: 'cap' | 'beanie' | 'headphones' | 'hood';
  top: number; topStyle: 'jacket' | 'hoodie' | 'vest' | 'coat' | 'tshirt'; shirt: number; pants: number; boots: number;
  gloves?: number; backpack?: number; mask?: number; scarf?: number;
  build?: number;              // width multiplier (brute ≈ 1.5, runner ≈ 0.85)
  infected?: boolean; seed: number;
}

const capsule = (r: number, len: number, mat: THREE.Material, y: number, sx = 1, sz = 1) => {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat); m.position.y = y; m.scale.set(sx, 1, sz); m.castShadow = true; return m;
};
const boxm = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; return m;
};

/**
 * Character readability (art pass 2): a camera-space Fresnel rim + a small self-fill on every
 * character material, so survivors and infected keep a readable silhouette against bright shop
 * windows and black alleys alike (the reference's rim-lit figures). One shared uniform set.
 */
export const RIM = { uRimColor: { value: new THREE.Color(0.42, 0.52, 0.62) }, uRimPow: { value: 2.6 }, uFill: { value: 0.16 } };
const rimmed = new WeakSet<THREE.Material>();
export function rimify(mat: THREE.Material): void {
  const m = mat as THREE.MeshStandardMaterial;
  if (rimmed.has(m) || !m.isMeshStandardMaterial) return;
  rimmed.add(m);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, RIM);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uRimColor; uniform float uRimPow; uniform float uFill;')
      .replace('#include <opaque_fragment>', `{ float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), uRimPow);
        outgoingLight += uRimColor * rimF * 0.55 + diffuseColor.rgb * uFill; }
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'rim';
}

const skinMats = new Map<string, THREE.MeshStandardMaterial>();
function skinMat(c: number, infected: boolean): THREE.MeshStandardMaterial {
  const k = `${c}${infected}`; let m = skinMats.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: c, roughness: infected ? 0.75 : 0.6, emissive: infected ? 0x0a0f08 : 0x000000 }); skinMats.set(k, m); }
  return m;
}

export class CharacterView {
  readonly root = new THREE.Group();         // at the feet; rotated Y for facing
  private body = new THREE.Group();          // lies down for dormant / downed
  readonly pivots = {} as Record<Part, THREE.Group>;
  private gunPivot = new THREE.Group();
  private weapon: THREE.Object3D | null = null;
  private weaponKind: WeaponKind | null = null;
  private meshes: THREE.Mesh[] = [];
  private flashMats: THREE.MeshStandardMaterial[] = [];
  private shadow: THREE.Mesh;
  readonly scale: number;
  ragdolled = false;

  constructor(readonly look: Look, scale = 1) {
    this.scale = scale;
    const R = new Rng(look.seed), b = look.build ?? 1;
    const skin = skinMat(look.skin, !!look.infected);
    const cloth = (c: number) => { const m = (M.cloth(c) as THREE.MeshStandardMaterial).clone(); this.flashMats.push(m); return m; };
    const top = cloth(look.top), shirt = cloth(look.shirt), pants = cloth(look.pants), boots = cloth(look.boots);
    const glove = look.gloves !== undefined ? cloth(look.gloves) : skin;
    const sleeve = look.topStyle === 'tshirt' || look.topStyle === 'vest' ? shirt : top;
    for (const p of PARTS) { const g = new THREE.Group(); g.name = p; this.pivots[p] = g; }
    const P = this.pivots;

    // torso (pivot at hips, extends up)
    const tw = 0.17 * b;
    P.torso.add(capsule(tw, SEG.torso - 0.18, look.topStyle === 'tshirt' ? shirt : top, SEG.torso / 2, 0.82, 1.15));
    const chest = new THREE.Mesh(new THREE.SphereGeometry(tw * 1.02, 14, 10), look.topStyle === 'tshirt' ? shirt : top);   // shoulder girdle
    chest.position.set(0.015, SEG.torso * 0.72, 0); chest.scale.set(0.95, 0.8, 1.35); P.torso.add(chest);
    P.torso.add(capsule(tw * 0.96, 0.1, pants, 0.02, 1, 0.66));                              // hips
    if (look.build && look.build > 1.3) P.torso.add(new THREE.Mesh(new THREE.SphereGeometry(0.24 * b * 0.75, 14, 10), look.infected ? skin : shirt).translateY(0.22).translateX(0.06));
    if (look.topStyle === 'vest') P.torso.add(boxm(0.27 * b, 0.36, 0.3 * b, top, 0, 0.3));
    if (look.topStyle === 'coat') P.torso.add(capsule(tw * 1.05, 0.12, top, -0.08, 1, 0.72));
    if (look.topStyle === 'hoodie' || look.headwear === 'hood') P.torso.add(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.045, 6, 12), top).rotateX(Math.PI / 2).translateZ(-0.47).translateY(-0.04));
    P.torso.add(boxm(0.05, 0.05, 0.3 * b, cloth(0x2a2018), 0.02, 0.06));                     // belt
    if (look.scarf !== undefined) P.torso.add(new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.04, 6, 12), cloth(look.scarf)).rotateX(Math.PI / 2).translateZ(-0.5));
    if (look.backpack !== undefined) {
      const bp = cloth(look.backpack);
      P.torso.add(boxm(0.24, 0.5, 0.34, bp, -0.25 * b, 0.33), boxm(0.2, 0.1, 0.32, bp, -0.24 * b, 0.62), boxm(0.07, 0.2, 0.26, bp, -0.39 * b, 0.22));   // hiking pack, lid, front pocket
      P.torso.add(boxm(0.03, 0.42, 0.05, cloth(0x2a2620), -0.12 * b, 0.32, 0.12), boxm(0.03, 0.42, 0.05, cloth(0x2a2620), -0.12 * b, 0.32, -0.12));   // straps
      P.torso.add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.4, 10), cloth(0x5a5a46)).rotateX(Math.PI / 2).translateY(0.62).translateX(-0.24 * b));   // bedroll
    }
    // head (pivot at neck)
    const head = new THREE.Group(); P.head.add(head);
    head.add(capsule(0.05, 0.06, skin, 0.04));                                                 // neck
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), skin); skull.scale.set(1, 1.12, 0.92); skull.position.set(0.01, 0.15, 0); skull.castShadow = true; head.add(skull);
    head.add(boxm(0.07, 0.07, 0.11, skin, 0.06, 0.08));                                        // jaw
    head.add(boxm(0.03, 0.045, 0.03, skin, 0.115, 0.13));                                      // nose
    const eyeM = new THREE.MeshStandardMaterial({ color: look.infected ? 0xc9c8a8 : 0x121010, roughness: 0.3, emissive: look.infected ? 0x2a2a18 : 0 });
    for (const z of [0.042, -0.042]) head.add(new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), eyeM).translateX(0.098).translateY(0.17).translateZ(z));
    const hairM = cloth(look.hair);
    if (look.hairStyle !== 'bald') {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.113, 14, 10, 0, Math.PI * 2, 0, look.hairStyle === 'buzz' ? 1.1 : 1.5), hairM);
      cap.scale.set(1.02, 1.12, 0.96); cap.position.set(-0.005, 0.16, 0); cap.rotation.z = 0.35; cap.castShadow = true; head.add(cap);
      if (look.hairStyle === 'messy') for (let i = 0; i < 6; i++) head.add(boxm(0.04, 0.03, 0.05, hairM, R.range(-0.08, 0.06), 0.27 + R.range(0, 0.03), R.range(-0.07, 0.07)));
      if (look.hairStyle === 'ponytail') head.add(capsule(0.035, 0.14, hairM, 0.12).translateX(-0.13).rotateZ(0.5));
      if (look.hairStyle === 'long') head.add(boxm(0.07, 0.24, 0.2, hairM, -0.08, 0.07));
    }
    if (look.beard) head.add(boxm(0.075, 0.07, 0.115, hairM, 0.065, 0.065));
    if (look.headwear === 'cap') { const c = cloth(0x4f5a38); head.add(new THREE.Mesh(new THREE.SphereGeometry(0.118, 14, 8, 0, Math.PI * 2, 0, 1.25), c).translateY(0.17)); head.add(boxm(0.12, 0.015, 0.16, c, 0.13, 0.205)); }
    if (look.headwear === 'beanie') head.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 8, 0, Math.PI * 2, 0, 1.35), cloth(0x3a3f48)).translateY(0.18));
    if (look.headwear === 'headphones') {
      const hp = cloth(0x22262a); head.add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 16, Math.PI), hp).rotateY(Math.PI / 2).translateY(0.17).rotateZ(0));
      for (const z of [0.11, -0.11]) head.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12), hp).rotateX(Math.PI / 2).translateY(0.15).translateZ(z));
      head.add(new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), M.emissive(0x5ad1e6, 4)).translateY(0.15).translateZ(0.13));
    }
    if (look.headwear === 'hood') head.add(new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 10, Math.PI * 0.6, Math.PI * 1.4), top).translateY(0.15).rotateY(0));
    if (look.mask !== undefined) head.add(boxm(0.08, 0.085, 0.12, cloth(look.mask), 0.07, 0.085));
    if (look.infected) {   // dark veins + blood on chin
      const vein = new THREE.MeshStandardMaterial({ color: 0x3a1e22, roughness: 0.8 });
      head.add(boxm(0.01, 0.06, 0.005, vein, 0.06, 0.13, 0.075), boxm(0.08, 0.025, 0.1, new THREE.MeshStandardMaterial({ color: 0x4a0a08, roughness: 0.4 }), 0.085, 0.045));
    }
    // arms (pivot at shoulder, extend down)
    const armW = 0.055 * Math.min(1.4, b);
    for (const side of ['F', 'B'] as const) {
      const ua = P[`upperArm${side}`], fa = P[`foreArm${side}`];
      ua.add(capsule(armW, SEG.upperArm - 0.06, sleeve, -SEG.upperArm / 2));
      fa.add(capsule(armW * 0.88, SEG.foreArm - 0.1, look.topStyle === 'tshirt' ? skin : sleeve, -SEG.foreArm / 2 + 0.02));
      fa.add(boxm(0.07, 0.1, 0.06, glove, 0.005, -SEG.foreArm - 0.02));                    // hand
      fa.position.y = -SEG.upperArm; ua.add(fa);
    }
    // legs (pivot at hip, extend down)
    for (const side of ['F', 'B'] as const) {
      const th = P[`thigh${side}`], sh = P[`shin${side}`];
      th.add(capsule(0.075 * Math.min(1.3, b), SEG.thigh - 0.1, pants, -SEG.thigh / 2));
      sh.add(capsule(0.06 * Math.min(1.3, b), SEG.shin - 0.12, pants, -SEG.shin / 2 + 0.03));
      sh.add(boxm(0.13, 0.15, 0.11, boots, 0.01, -SEG.shin + 0.02), boxm(0.24, 0.07, 0.11, boots, 0.06, -SEG.shin - 0.035));
      sh.position.y = -SEG.thigh; th.add(sh);
    }
    // hierarchy: torso→(head, arms); body→(torso, legs). z offsets give near/far depth
    P.head.position.y = SEG.torso;
    for (const s of ['upperArmF', 'upperArmB'] as const) { P[s].position.y = SEG.shoulderAt; P.torso.add(P[s]); }
    P.upperArmF.position.z = 0.19 * b; P.upperArmB.position.z = -0.19 * b;
    P.thighF.position.z = 0.09 * b; P.thighB.position.z = -0.09 * b;
    P.torso.add(P.head, this.gunPivot);
    this.body.add(P.torso, P.thighF, P.thighB);
    this.root.add(this.body);
    this.root.scale.setScalar(scale);
    this.gunPivot.position.set(0.02, SEG.shoulderAt - 0.03, 0.12);

    const sg = new THREE.CircleGeometry(0.45, 20); sg.rotateX(-Math.PI / 2);
    this.shadow = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.4, depthWrite: false })); this.shadow.position.y = 0.012; this.shadow.scale.z = 0.45;
    this.root.add(this.shadow);
    this.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m !== this.shadow) { m.castShadow = true; this.meshes.push(m); } });
    this.flashMats.push(skin.clone()); // not shared: used only for flash bookkeeping
    for (const m of this.meshes) rimify(m.material as THREE.Material);
  }

  setWeapon(kind: WeaponKind | null): void {
    if (kind === this.weaponKind) return;
    if (this.weapon) this.gunPivot.remove(this.weapon);
    this.weaponKind = kind; this.weapon = kind ? weaponMesh(kind) : null;
    if (this.weapon) { this.gunPivot.add(this.weapon); this.weapon.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) rimify(m.material as THREE.Material); }); }
  }

  /** Living pose. x,y = feet position. */
  pose(p: Pose, x: number, y: number, facing: 1 | -1, holstered: boolean): void {
    this.root.position.set(x, y, 0);
    this.root.rotation.set(0, facing > 0 ? 0 : Math.PI, 0);
    const P = this.pivots;
    const hip = hipFrom(p);
    this.body.position.y = hip; this.body.rotation.z = -p.lie * 1.45; this.body.position.x = -p.lie * 0.6;
    this.body.position.y = hip * (1 - p.lie) + p.lie * 0.22;
    P.torso.rotation.z = p.lean; P.head.rotation.z = p.neck;
    P.upperArmF.rotation.z = p.shF; P.foreArmF.rotation.z = p.elF;
    P.upperArmB.rotation.z = p.shB; P.foreArmB.rotation.z = p.elB;
    P.thighF.rotation.z = p.thF; P.shinF.rotation.z = p.knF;
    P.thighB.rotation.z = p.thB; P.shinB.rotation.z = p.knB;
    if (holstered) { this.gunPivot.position.set(-0.36, 0.2, -0.2); this.gunPivot.rotation.z = 1.85; }      // slung behind the pack, muzzle over the shoulder
    else { this.gunPivot.position.set(0.04, SEG.shoulderAt - 0.06 + p.gunY, 0.14); this.gunPivot.rotation.z = p.gun; }
    this.shadow.visible = true; this.shadow.scale.set(1 + p.lie * 1.4, 1, 0.45);
  }

  /** Ragdoll display: each part takes its physics body's world angle; torso pivot = root. */
  poseFromBodies(get: (p: Part) => { x: number; y: number; a: number }, facing: 1 | -1): void {
    const t = get('torso');
    this.root.position.set(t.x, 0, 0);
    this.root.rotation.set(0, facing > 0 ? 0 : Math.PI, 0);
    this.body.rotation.z = 0; this.body.position.set(0, t.y, 0);
    const local = (a: number) => a * facing;
    const P = this.pivots, A = (p: Part) => local(get(p).a);
    // legs are children of `body`, not torso: give them absolute angles, positioned at their hip pivots
    P.torso.rotation.z = A('torso');
    P.head.rotation.z = A('head') - A('torso');
    P.upperArmF.rotation.z = A('upperArmF') - A('torso'); P.foreArmF.rotation.z = A('foreArmF') - A('upperArmF');
    P.upperArmB.rotation.z = A('upperArmB') - A('torso'); P.foreArmB.rotation.z = A('foreArmB') - A('upperArmB');
    for (const s of ['F', 'B'] as const) {
      const th = get(`thigh${s}`);
      P[`thigh${s}`].position.x = (th.x - t.x) * facing / this.scale; P[`thigh${s}`].position.y = (th.y - t.y) / this.scale;
      P[`thigh${s}`].rotation.z = local(th.a); P[`shin${s}`].rotation.z = A(`shin${s}`) - local(th.a);
    }
    this.gunPivot.visible = false;
    this.shadow.position.x = 0; this.shadow.scale.set(2.2, 1, 0.5);
  }

  /** Damage flash / lighting tweaks shared by all cloth materials of this character. */
  flash(v: number): void { for (const m of this.flashMats) m.emissive.setRGB(v * 0.55, v * 0.06, v * 0.04); }
  setOpacity(o: number): void {
    for (const m of this.meshes) { const mat = m.material as THREE.MeshStandardMaterial; mat.transparent = o < 1; mat.opacity = o; }
  }
  /** Muzzle world position for the current pose. */
  muzzle(): THREE.Vector3 | null {
    if (!this.weapon) return null;
    const tip = this.weapon.getObjectByName('muzzle');
    return tip ? tip.getWorldPosition(new THREE.Vector3()) : null;
  }
  get muzzleReady(): boolean { return !!this.weapon; }
  dispose(): void { this.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); }); for (const m of this.flashMats) m.dispose(); }
}

function hipFrom(p: Pose): number {
  const drop = (th: number, kn: number) => SEG.thigh * Math.cos(th) + SEG.shin * Math.cos(th + kn) + SEG.ankle;
  return Math.max(drop(p.thF, p.knF), drop(p.thB, p.knB)) + p.bob;
}

// ---------------------------------------------------------------- the cast
export const LOOKS = {
  reed: { seed: 11, skin: 0xc08a68, hair: 0x1e1612, hairStyle: 'messy', beard: true, top: 0x444a36, topStyle: 'jacket', shirt: 0x5a5f62, pants: 0x4a5058, boots: 0x4a3322, gloves: 0x2a2a28, backpack: 0x5e4c32 },
  maya: { seed: 23, skin: 0xa8725a, hair: 0x241812, hairStyle: 'ponytail', top: 0x8e2e28, topStyle: 'jacket', shirt: 0xb8b0a0, pants: 0x585a5c, boots: 0x3a2a1e, backpack: 0x7a2e2a, mask: 0xc9d6d8 },
  miller: { seed: 37, skin: 0xd29a7a, hair: 0xd6d2c8, hairStyle: 'buzz', beard: true, headwear: 'cap', top: 0x8c7c52, topStyle: 'coat', shirt: 0x4a5058, pants: 0x5a5644, boots: 0x3a2a1a, gloves: 0x5a4a32, backpack: 0x4a4a3a, build: 1.12 },
  iris: { seed: 41, skin: 0xc89a7a, hair: 0x121214, hairStyle: 'long', headwear: 'headphones', top: 0x5a4878, topStyle: 'hoodie', shirt: 0x8a8a7a, pants: 0x8a7a5c, boots: 0x2a2622, backpack: 0x3d4a3a, scarf: 0x2f4a52, build: 0.92 },
} satisfies Record<string, Look>;

const INFECTED_SKIN = [0xa8908a, 0x9c8682, 0xb39a90, 0x8f8480, 0x9a948a];   // bloodless grey-pink (reference)
const INFECTED_CLOTH = [0x4a4238, 0x3a4450, 0x6a3a32, 0x3e4a3a, 0x6e6658, 0x2c2c30, 0x7a6e5a];
export function infectedLook(kind: 'common' | 'runner' | 'brute', seed: number): Look {
  const R = new Rng(seed);
  return {
    seed, infected: true, skin: R.pick(INFECTED_SKIN), hair: R.pick([0x1a1612, 0x3a2a20, 0x4a4438]),
    hairStyle: kind === 'brute' ? 'bald' : R.pick(['messy', 'short', 'long', 'bald'] as const),
    headwear: kind === 'common' && R.chance(0.25) ? 'hood' : undefined,
    top: R.pick(INFECTED_CLOTH), topStyle: kind === 'brute' ? 'tshirt' : R.pick(['jacket', 'hoodie', 'tshirt', 'coat'] as const),
    shirt: kind === 'brute' ? 0x7a7466 : R.pick(INFECTED_CLOTH), pants: R.pick([0x2a2e38, 0x3a3428, 0x30302e]), boots: 0x241c16,
    build: kind === 'brute' ? 1.55 : kind === 'runner' ? 0.82 : R.range(0.92, 1.08),
  };
}
