import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Rng } from '../core/math';
import type { AnimIn, Part, Pose } from '../game/rig';
import { M } from './kit';
import { weaponMesh, type WeaponKind } from './weapons';
import { rimify, type Look } from './characters';

/**
 * Skinned characters (art pass 3, threejs-gltf-loading): one CC0 rigged human —
 * Quaternius "Universal Animation Library" (public/models/survivor.glb, licence alongside) —
 * dressed per character by painting vertex colours from each vertex's dominant bone and height
 * (jacket / sleeves / gloves / trousers / boots / skin / hair), plus code-built gear attached to
 * bones (packs, caps, headphones, weapons). Motion is the asset's mocap-style clips, layered:
 * the lower body plays locomotion while the upper body aims, shoots, reloads or strikes.
 * Infected reuse the same body with grey-pink skin, torn clothes and a procedural hunch.
 * On death the bones follow the Planck ragdoll (each part's rotation is applied in world space).
 */
let SRC: GLTF | null = null;
export const characterAssetReady = () => !!SRC;
export async function loadCharacterAsset(url: string): Promise<void> {
  if (SRC) return;
  SRC = await new GLTFLoader().loadAsync(url);
}

const LOWER = /hips|thigh|shin|foot|toe|root/i;
const clipCache = new Map<string, THREE.AnimationClip>();
function clip(name: string, part: 'full' | 'upper' | 'lower' = 'full'): THREE.AnimationClip {
  const key = `${name}|${part}`; let c = clipCache.get(key);
  if (!c) {
    const src = SRC!.animations.find((a) => a.name === name) ?? SRC!.animations[0];
    c = part === 'full' ? src : new THREE.AnimationClip(`${name}_${part}`, src.duration,
      src.tracks.filter((t) => { const bone = t.name.split('.')[0]; return part === 'lower' ? LOWER.test(bone) : !LOWER.test(bone); }));
    clipCache.set(key, c);
  }
  return c;
}

// ------------------------------------------------------------------ dressing (vertex colours)
type Region = 'skin' | 'hair' | 'top' | 'sleeve' | 'hand' | 'pants' | 'boots' | 'belt';
const geoCache = new Map<string, THREE.BufferGeometry[]>();

function dress(meshes: THREE.SkinnedMesh[], look: Look): void {
  const key = JSON.stringify(look);
  let geos = geoCache.get(key);
  if (!geos) {
    const R = new Rng(look.seed);
    const col = (h: number) => new THREE.Color(h);
    const pal: Record<Region, THREE.Color> = {
      skin: col(look.skin), hair: col(look.hair), top: col(look.top), sleeve: col(look.topStyle === 'vest' || look.topStyle === 'tshirt' ? look.shirt : look.top),
      hand: col(look.gloves ?? look.skin), pants: col(look.pants), boots: col(look.boots), belt: col(0x2a2018),
    };
    if (look.topStyle === 'tshirt') pal.sleeve = col(look.shirt);
    // bounds from the first mesh (bind pose)
    const bb = new THREE.Box3(); for (const m of meshes) { m.geometry.computeBoundingBox(); bb.union(m.geometry.boundingBox!); }
    const H = bb.max.y - bb.min.y, Z = bb.max.z - bb.min.z;
    geos = meshes.map((m) => {
      const g = m.geometry.clone(), pos = g.getAttribute('position'), si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight');
      const bones = m.skeleton.bones.map((b) => b.name);
      const out = new Float32Array(pos.count * 3), c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
        const bn = bones[best] ?? '', y = (pos.getY(i) - bb.min.y) / H, z = (pos.getZ(i) - bb.min.z) / Z - 0.5, x = pos.getX(i);
        let r: Region;
        if (/head/.test(bn)) {
          const top = y > 0.935 || (z < -0.1 && y > 0.88) || (look.hairStyle === 'long' && z < 0.05 && y > 0.86);
          r = look.hairStyle !== 'bald' && top ? 'hair' : look.beard && z > 0.12 && y < 0.905 ? 'hair' : 'skin';
          if (look.headwear === 'hood' && (y > 0.9 || z < 0)) r = 'top';
        } else if (/neck/.test(bn)) r = look.scarf !== undefined ? 'top' : 'skin';
        else if (/hand|f_|thumb/.test(bn)) r = 'hand';
        else if (/forearm/.test(bn)) r = look.topStyle === 'tshirt' ? 'skin' : 'sleeve';
        else if (/upper_arm|shoulder/.test(bn)) r = 'sleeve';
        else if (/spine|chest/.test(bn)) r = 'top';
        else if (/hips/.test(bn)) r = y > 0.555 ? (look.topStyle === 'coat' ? 'top' : 'belt') : look.topStyle === 'coat' && y > 0.45 ? 'top' : 'pants';
        else if (/foot|toe/.test(bn)) r = 'boots';
        else if (/shin/.test(bn)) r = y < 0.16 ? 'boots' : 'pants';
        else r = 'pants';
        c.copy(pal[r]);
        // cloth/skin variation; infected: torn clothes show skin, dark blood stains
        const n = Math.sin(x * 37 + y * 53 + look.seed) * 0.5 + 0.5;
        c.multiplyScalar(0.9 + n * 0.16);
        if (look.infected && r !== 'skin' && r !== 'hair' && R.next() < 0.002) c.copy(pal.skin);
        if (look.infected && (r === 'top' || r === 'pants') && Math.sin(x * 9 + y * 21 + look.seed) > 0.82) c.copy(pal.skin).multiplyScalar(0.9);
        if (look.infected && ((r === 'skin' && /head/.test(bn) && z > 0.15 && y < 0.9) || (r === 'top' && Math.sin(x * 13 - y * 17 + look.seed * 3) > 0.9))) c.setRGB(0.24, 0.04, 0.03);
        out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(out, 3));
      return g;
    });
    geoCache.set(key, geos);
  }
  meshes.forEach((m, i) => { m.geometry = geos![i]; });
}

// ------------------------------------------------------------------ the view
const ARM_UP = new THREE.Vector3(1, 0, 0), WORLD_Z = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3();

/** Rotate a bone about a model-space axis (applied after the mixer: hunch, reaching arms). */
function rotateModelSpace(b: THREE.Object3D, axis: THREE.Vector3, ang: number): void {
  b.parent!.getWorldQuaternion(_q2);
  _q.setFromAxisAngle(axis, ang);
  // local' = P⁻¹ · Q · P · local   (P = parent world rotation, Q in world space)
  const P = _q2.clone(); b.quaternion.premultiply(P.clone().invert().multiply(_q).multiply(P));
}

export class SkinnedView {
  readonly root = new THREE.Group();
  private model: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private meshes: THREE.SkinnedMesh[] = [];
  private mat: THREE.MeshStandardMaterial;
  private bone: Record<string, THREE.Bone> = {};
  private lowerA: THREE.AnimationAction | null = null; private upperA: THREE.AnimationAction | null = null;
  private lowerName = ''; private upperName = '';
  private weaponMount = new THREE.Group(); private weapon: THREE.Object3D | null = null; private weaponKind: WeaponKind | null = null;
  private slung = new THREE.Group();
  private shadow: THREE.Mesh;
  private shotT = 0; private lastRecoil = 0;
  private rag: { w0: Map<THREE.Bone, THREE.Quaternion>; a0: Map<Part, number>; hips0: THREE.Vector3; piv0: THREE.Vector2 } | null = null;
  ragdolled = false;

  constructor(readonly look: Look, readonly scale = 1) {
    this.model = cloneSkinned(SRC!.scene);
    this.model.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) { this.meshes.push(m); m.castShadow = true; m.frustumCulled = false; }
      if ((o as THREE.Bone).isBone) this.bone[o.name] = o as THREE.Bone;
    });
    dress(this.meshes, look);
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
    rimify(this.mat);
    for (const m of this.meshes) m.material = this.mat;
    this.mixer = new THREE.AnimationMixer(this.model);
    this.root.add(this.model);
    this.root.scale.setScalar(scale * (look.build && look.build > 1.3 ? 1.08 : 1));
    if (look.build) this.model.scale.set(look.build, 1, Math.min(1.25, look.build));

    // pose once (idle) and attach gear in that pose with Object3D.attach (keeps world placement)
    this.play('Idle_Loop', 'lower'); this.play('Idle_Loop', 'upper'); this.mixer.update(0); this.model.updateMatrixWorld(true);
    this.gear();
    const sg = new THREE.CircleGeometry(0.45, 20); sg.rotateX(-Math.PI / 2);
    this.shadow = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.4, depthWrite: false }));
    this.shadow.position.y = 0.012; this.shadow.scale.z = 0.45; this.root.add(this.shadow);
  }

  private b(n: string): THREE.Bone { return this.bone[n] ?? this.bone['DEF-hips']; }

  private gear(): void {
    const L = this.look, head = this.b('DEF-head'), chest = this.b('DEF-spine003');
    const hp = head.getWorldPosition(new THREE.Vector3()), cp = chest.getWorldPosition(new THREE.Vector3());
    const cloth = (c: number) => { const m = (M.cloth(c) as THREE.MeshStandardMaterial).clone(); rimify(m); return m; };
    const put = (bone: THREE.Bone, mesh: THREE.Object3D, x: number, y: number, z: number) => { mesh.position.set(x, y, z); mesh.traverse((o) => { o.castShadow = true; }); this.model.add(mesh); mesh.updateMatrixWorld(true); bone.attach(mesh); };
    const skull = hp.clone().add(new THREE.Vector3(0, 0.12, 0.01));
    if (L.headwear === 'cap') {
      const c = cloth(0x4f5a38), g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.112, 14, 8, 0, Math.PI * 2, 0, 1.3), c));
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.014, 0.12), c); brim.position.set(0, 0.03, 0.12); g.add(brim);
      put(head, g, skull.x, skull.y + 0.015, skull.z);
    }
    if (L.headwear === 'beanie') put(head, new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 8, 0, Math.PI * 2, 0, 1.35), cloth(0x3a3f48)), skull.x, skull.y + 0.02, skull.z);
    if (L.headwear === 'headphones') {
      const g = new THREE.Group(), m = cloth(0x22262a);
      g.add(new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.012, 6, 16, Math.PI), m));
      for (const x of [0.115, -0.115]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 12), m); cup.rotation.z = Math.PI / 2; cup.position.set(x, -0.02, 0); g.add(cup); }
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), M.emissive(0x5ad1e6, 4)); led.position.set(0.135, -0.02, 0); g.add(led);
      put(head, g, skull.x, skull.y + 0.01, skull.z - 0.01);
    }
    if (L.hairStyle === 'ponytail') { const p = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.16, 4, 8), cloth(L.hair)); p.rotation.x = 0.5; put(head, p, skull.x, skull.y - 0.08, skull.z - 0.13); }
    if (L.hairStyle === 'long') { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.06), cloth(L.hair)); put(head, p, skull.x, skull.y - 0.14, skull.z - 0.09); }
    if (L.mask !== undefined) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.06), cloth(L.mask)); put(head, p, skull.x, skull.y - 0.09, skull.z + 0.09); }
    if (L.backpack !== undefined) {
      const bp = cloth(L.backpack), g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.22), bp); g.add(body);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.2), bp); lid.position.set(0, 0.29, 0.01); g.add(lid);
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.07), bp); pocket.position.set(0, -0.1, -0.13); g.add(pocket);
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.4, 10), cloth(0x5a5a46)); roll.rotation.z = Math.PI / 2; roll.position.set(0, 0.38, 0); g.add(roll);
      put(chest, g, cp.x, cp.y - 0.1, cp.z - 0.19);
    }
    // slung weapon rides on the pack (behind the back, muzzle up over the shoulder)
    this.slung.position.set(cp.x + 0.12, cp.y - 0.1, cp.z - 0.38); this.slung.rotation.set(0, Math.PI / 2, 1.9);
    this.model.add(this.slung); this.slung.updateMatrixWorld(true); chest.attach(this.slung);
    // hand mount: grip in the palm, muzzle along the model's forward (+Z) in the aim pose
    const hand = this.b('DEF-handR');
    this.play('Pistol_Aim_Neutral', 'upper', 0); this.mixer.update(0); this.model.updateMatrixWorld(true);
    const hpw = hand.localToWorld(new THREE.Vector3(0, 0.07, 0.02));
    this.weaponMount.position.copy(hpw); this.weaponMount.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
    this.model.add(this.weaponMount); this.weaponMount.updateMatrixWorld(true); hand.attach(this.weaponMount);
    this.play('Idle_Loop', 'upper', 0); this.mixer.update(0);
  }

  private play(name: string, part: 'upper' | 'lower', fade = 0.22, speed = 1, once = false): void {
    const cur = part === 'upper' ? this.upperName : this.lowerName;
    const prev = part === 'upper' ? this.upperA : this.lowerA;
    if (cur === name) { if (prev) prev.timeScale = speed; return; }
    const a = this.mixer.clipAction(clip(name, part));
    a.reset(); a.timeScale = speed; a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once;
    a.play();
    if (prev && fade > 0) prev.crossFadeTo(a, fade, false); else if (prev) prev.stop();
    if (part === 'upper') { this.upperA = a; this.upperName = name; } else { this.lowerA = a; this.lowerName = name; }
  }

  setWeapon(kind: WeaponKind | null): void {
    if (kind === this.weaponKind) return;
    this.weaponKind = kind;
    if (this.weapon) this.weapon.parent?.remove(this.weapon);
    this.weapon = kind ? weaponMesh(kind) : null;
    if (this.weapon) { this.weapon.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; rimify(m.material as THREE.Material); } }); this.weaponMount.add(this.weapon); }
  }

  /** Drive the clips from the simulation's animation inputs (called every rendered frame). */
  animate(i: AnimIn, dt: number): void {
    if (this.ragdolled) return;
    const moving = i.speed > 0.15, inf = i.gait !== 'survivor';
    const walkRate = (sp: number) => Math.max(0.35, sp / 1.45);
    // ---- lower body: locomotion
    if (i.dormant) this.play('Death01', 'lower', 0.3, 1, true);
    else if (i.heal > 0) this.play('Fixing_Kneeling', 'lower');
    else if (i.crouch) this.play(moving ? 'Crouch_Fwd_Loop' : 'Crouch_Idle_Loop', 'lower', 0.2, moving ? Math.max(0.5, i.speed / 1.0) : 1);
    else if (!moving) this.play('Idle_Loop', 'lower');
    else if (i.speed > 3.2) this.play('Sprint_Loop', 'lower', 0.2, i.speed / 5.6);
    else if (i.speed > 2.1) this.play('Jog_Fwd_Loop', 'lower', 0.2, i.speed / 3.4);
    else this.play('Walk_Loop', 'lower', 0.25, walkRate(i.speed) * (inf && i.gait !== 'sprint' ? 0.85 : 1));
    // ---- upper body: actions over locomotion
    const lowerName = this.lowerName;
    if (i.recoil > this.lastRecoil + 0.2) this.shotT = 0.18;
    this.lastRecoil = i.recoil; this.shotT -= dt;
    if (i.dormant) this.play('Death01', 'upper', 0.3, 1, true);
    else if (i.heal > 0) this.play('Fixing_Kneeling', 'upper');
    else if (inf && i.attack > 0) this.play(i.gait === 'brute' ? 'Sword_Attack' : 'Punch_Cross', 'upper', 0.12, i.gait === 'brute' ? 1.1 : 1.3, true);
    else if (i.hurt > 0.5) this.play('Hit_Chest', 'upper', 0.08, 1, true);
    else if (i.melee > 0) this.play('Sword_Attack', 'upper', 0.1, 1.6, true);
    else if (i.throwT > 0) this.play('Spell_Simple_Shoot', 'upper', 0.1, 1.2, true);
    else if (i.reload > 0) this.play('Pistol_Reload', 'upper', 0.15);
    else if (!inf && i.drawn && (i.aim > 0.4 || this.shotT > 0)) this.play(this.shotT > 0 ? 'Pistol_Shoot' : 'Pistol_Aim_Neutral', 'upper', 0.1, 1.4, this.shotT > 0);
    else if (!inf && i.drawn && i.stance !== 'none') this.play('Pistol_Idle_Loop', 'upper', 0.25);
    else this.play(lowerName, 'upper', 0.25, this.lowerA?.timeScale ?? 1, lowerName === 'Death01');
    if (this.upperA && this.lowerA && this.upperName === this.lowerName) this.upperA.time = this.lowerA.time;   // stay in step
    this.mixer.update(dt);

    // ---- procedural layer: infected hunch + reaching arms; survivors lean when sprinting
    const spine = this.b('DEF-spine001'), neck = this.b('DEF-neck');
    if (inf && !i.dormant) {
      const hunch = i.gait === 'sprint' ? 0.35 : i.gait === 'brute' ? 0.25 : 0.42;
      rotateModelSpace(spine, ARM_UP, hunch); rotateModelSpace(neck, ARM_UP, -0.25 + Math.sin(i.t * 2.3) * 0.08);
      if (i.attack <= 0) {
        const reach = i.run ? -1.25 : -0.35 + Math.sin(i.t * 1.7) * 0.08;
        for (const s of ['L', 'R'] as const) rotateModelSpace(this.b(`DEF-upper_arm${s}`), ARM_UP, reach + (s === 'L' ? Math.sin(i.t * 2) * 0.1 : 0));
      }
    } else if (!inf && this.lowerName === 'Sprint_Loop') rotateModelSpace(spine, ARM_UP, 0.12);

    const holstered = !i.drawn && i.melee <= 0;
    if (this.weapon) { const p = holstered ? this.slung : this.weaponMount; if (this.weapon.parent !== p) p.add(this.weapon); }
  }

  /** Living placement (the procedural Pose is kept for the ragdoll; the skinned body animates itself). */
  pose(_p: Pose, x: number, y: number, facing: 1 | -1, _holstered = false): void {
    this.root.position.set(x, y, 0);
    this.root.rotation.set(0, facing > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
  }

  /** Ragdoll display: every mapped bone takes its part's rotation delta (world Z) since death. */
  poseFromBodies(get: (p: Part) => { x: number; y: number; a: number }, facing: 1 | -1): void {
    const near = facing > 0 ? 'R' : 'L', far = facing > 0 ? 'L' : 'R';
    const map: [Part, string][] = [['torso', 'DEF-hips'], ['head', 'DEF-head'],
      ['upperArmF', `DEF-upper_arm${near}`], ['foreArmF', `DEF-forearm${near}`], ['upperArmB', `DEF-upper_arm${far}`], ['foreArmB', `DEF-forearm${far}`],
      ['thighF', `DEF-thigh${near}`], ['shinF', `DEF-shin${near}`], ['thighB', `DEF-thigh${far}`], ['shinB', `DEF-shin${far}`]];
    this.model.updateMatrixWorld(true);
    if (!this.rag) {
      const w0 = new Map<THREE.Bone, THREE.Quaternion>(), a0 = new Map<Part, number>();
      for (const [p, n] of map) { w0.set(this.b(n), this.b(n).getWorldQuaternion(new THREE.Quaternion())); a0.set(p, get(p).a); }
      const t = get('torso');
      this.rag = { w0, a0, hips0: this.b('DEF-hips').getWorldPosition(new THREE.Vector3()), piv0: new THREE.Vector2(t.x, t.y) };
      this.weapon?.parent?.remove(this.weapon);
    }
    const R = this.rag;
    // hips position follows the torso pivot, rotated by the torso's delta
    const t = get('torso'), dT = t.a - R.a0.get('torso')!;
    _v.set(R.hips0.x - R.piv0.x, R.hips0.y - R.piv0.y, 0).applyAxisAngle(WORLD_Z, dT).add(new THREE.Vector3(t.x, t.y, R.hips0.z));
    const hips = this.b('DEF-hips'); hips.parent!.worldToLocal(_v); hips.position.copy(_v);
    for (const [p, n] of map) {
      const bone = this.b(n), d = get(p).a - R.a0.get(p)!;
      _q.setFromAxisAngle(WORLD_Z, d).multiply(R.w0.get(bone)!);              // desired world rotation
      bone.parent!.getWorldQuaternion(_q2); bone.quaternion.copy(_q2.invert().multiply(_q));
      bone.updateMatrixWorld(true);
    }
    this.shadow.scale.set(2.2, 1, 0.5);
  }

  flash(v: number): void { this.mat.emissive.setRGB(v * 0.55, v * 0.06, v * 0.04); }
  setOpacity(o: number): void { this.mat.transparent = o < 1; this.mat.opacity = o; }
  muzzle(): THREE.Vector3 | null {
    if (!this.weapon || this.weapon.parent !== this.weaponMount) return null;
    const tip = this.weapon.getObjectByName('muzzle');
    if (!tip) return null;
    const p = tip.getWorldPosition(new THREE.Vector3()); p.z = Math.max(p.z, 0.15); return p;
  }
  get muzzleReady(): boolean { return !!this.weapon; }
  dispose(): void { this.mixer.stopAllAction(); this.mat.dispose(); }
}
