import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Rng } from '../core/math';
import type { AnimIn, Part, Pose } from '../game/rig';
import { M } from './kit';
import { weaponMesh, type WeaponKind } from './weapons';
import { rimify, type Look } from './characters';

/**
 * Skinned characters (art pass 4 — M1 "hero screen"): real CC0 people from the Quaternius
 * character family, all on one 65-bone skeleton (public/models/chars, licences alongside):
 *  - Modular Character Outfits (shirt, trousers, shoes, bare arms) — the clothed body
 *  - Universal Base Characters — only the face/neck is kept (triangles driven by head/neck bones),
 *    plus eyes and eyebrows, rebound to the outfit's skeleton by bone name
 *  - hairstyles (static meshes) attached to the Head bone in the bind pose
 *  - Universal Animation Library clips (anims.glb), layered lower/upper body as before
 * Per survivor: outfit/skin/hair tints and code-built gear (packs, caps, headphones, weapons).
 * Infected: same people with grey-pink skin, soiled/torn tints and a procedural hunch.
 */
type Sex = 'm' | 'f';
interface Kit { outfit: Record<Sex, GLTF>; body: Record<Sex, GLTF>; hair: Record<string, GLTF>; anims: GLTF }
let KIT: Kit | null = null;
export const characterAssetReady = () => !!KIT;
export async function loadCharacterAsset(base: string): Promise<void> {
  if (KIT) return;
  const L = new GLTFLoader(), ld = (n: string) => L.loadAsync(`${base}models/chars/${n}.glb`);
  const [om, of, bm, bf, anims, ...hairs] = await Promise.all(['outfit_m', 'outfit_f', 'body_m', 'body_f', 'anims', ...HAIRS.map((h) => `hair_${h}`)].map(ld));
  KIT = { outfit: { m: om, f: of }, body: { m: bm, f: bf }, anims, hair: Object.fromEntries(HAIRS.map((h, i) => [h, hairs[i]])) };
}
const HAIRS = ['beard', 'buzzed', 'long', 'simpleparted', 'buns'] as const;

/** Skeleton bone names (Quaternius / UE-style). */
const BN = { hips: 'pelvis', spine1: 'spine_01', spine3: 'spine_03', neck: 'neck_01', head: 'Head', handR: 'hand_r',
  upper: (s: 'l' | 'r') => `upperarm_${s}`, fore: (s: 'l' | 'r') => `lowerarm_${s}`, thigh: (s: 'l' | 'r') => `thigh_${s}`, calf: (s: 'l' | 'r') => `calf_${s}` };
const LOWER = /pelvis|thigh|calf|foot|ball|root/i;
const clipCache = new Map<string, THREE.AnimationClip>();
function clip(name: string, part: 'full' | 'upper' | 'lower' = 'full'): THREE.AnimationClip {
  const key = `${name}|${part}`; let c = clipCache.get(key);
  if (!c) {
    const src = KIT!.anims.animations.find((a) => a.name === name) ?? KIT!.anims.animations[0];
    c = part === 'full' ? src : new THREE.AnimationClip(`${name}_${part}`, src.duration,
      src.tracks.filter((t) => { const bone = t.name.split('.')[0]; return part === 'lower' ? LOWER.test(bone) : !LOWER.test(bone); }));
    clipCache.set(key, c);
  }
  return c;
}

/** Face-only index buffer of the base body (triangles driven by head/neck), cached per sex. */
const faceIndex = new Map<Sex, THREE.BufferAttribute>();
function faceOnly(m: THREE.SkinnedMesh, sex: Sex): void {
  let idx = faceIndex.get(sex);
  if (!idx) {
    const g = m.geometry, si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight'), src = g.index!.array, names = m.skeleton.bones.map((b) => b.name), keep: number[] = [];
    const isHead = (v: number) => { let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(v, k); if (w > bw) { bw = w; best = si.getComponent(v, k); } } return /Head|neck/.test(names[best]); };
    for (let i = 0; i < src.length; i += 3) if (isHead(src[i]) && isHead(src[i + 1]) && isHead(src[i + 2])) keep.push(src[i], src[i + 1], src[i + 2]);
    idx = new THREE.BufferAttribute(new Uint32Array(keep), 1); faceIndex.set(sex, idx);
  }
  m.geometry = m.geometry.clone(); m.geometry.setIndex(idx);
}

const INFECTED_SKIN = new THREE.Color(0xb39a92);
/**
 * Recolour a textured material to a palette colour while keeping the fabric's shading:
 * colour = mix(texture, luminance(texture) × lift, amount) × tint. Dark source fabrics (the outfit
 * atlas is mostly browns) are lifted so the survivor palette reads at night.
 */
function tinted(src: THREE.Material, color: number | THREE.Color, amount = 0.85, lift = 2.1): THREE.MeshStandardMaterial {
  const m = (src as THREE.MeshStandardMaterial).clone();
  m.color = new THREE.Color(color);
  m.metalness = 0; m.metalnessMap = null;                 // cloth and skin: the ORM's metal channel turns them black at night
  m.roughness = Math.max(m.roughness, 0.75);
  if (m.map && amount > 0) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uRecolor = { value: amount }; sh.uniforms.uLift = { value: lift };
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uRecolor; uniform float uLift;')
        .replace('#include <map_fragment>', `#ifdef USE_MAP
          vec4 texel = texture2D( map, vMapUv );
          float lum = dot( texel.rgb, vec3( 0.299, 0.587, 0.114 ) );
          diffuseColor *= vec4( mix( texel.rgb, vec3( min( 1.0, lum * uLift ) ), uRecolor ), texel.a );
          #endif`);
    };
    m.customProgramCacheKey = () => `recolor${amount}${lift}`;
  } else if (amount === 0) m.color.set(0xffffff);
  rimify(m); return m;
}

// ------------------------------------------------------------------ the view
const ARM_UP = new THREE.Vector3(1, 0, 0), WORLD_Z = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _v = new THREE.Vector3();

/**
 * Rotate a bone about an axis given in the MODEL's own frame (its forward is +Z, side is +X),
 * applied after the mixer (hunch, reaching arms, sprint lean). The parent's rotation is accumulated
 * from local quaternions up to the model root — never from world matrices, which carry the root's
 * facing turn (±90°) and would twist the body sideways and flip every time the actor turns.
 */
export function rotateModelSpace(b: THREE.Object3D, model: THREE.Object3D, axis: THREE.Vector3, ang: number, undo: Map<THREE.Object3D, THREE.Quaternion>): void {
  if (!undo.has(b)) undo.set(b, b.quaternion.clone());   // pose before any offset this frame
  _q2.identity();
  for (let o = b.parent; o && o !== model; o = o.parent) _q2.premultiply(o.quaternion);   // parent rotation in model space
  _q.setFromAxisAngle(axis, ang);
  // local' = P⁻¹ · Q · P · local
  _q3.copy(_q2).invert().multiply(_q).multiply(_q2);
  b.quaternion.premultiply(_q3);
}

export class SkinnedView {
  readonly root = new THREE.Group();
  private model: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private meshes: THREE.SkinnedMesh[] = [];
  private mats: THREE.MeshStandardMaterial[] = [];
  private bone: Record<string, THREE.Bone> = {};
  private lowerA: THREE.AnimationAction | null = null; private upperA: THREE.AnimationAction | null = null;
  private lowerName = ''; private upperName = '';
  private weaponMount = new THREE.Group(); private weapon: THREE.Object3D | null = null; private weaponKind: WeaponKind | null = null;
  private slung = new THREE.Group();
  private shadow: THREE.Mesh;
  private shotT = 0; private lastRecoil = 0;
  private rag: { w0: Map<THREE.Bone, THREE.Quaternion>; a0: Map<Part, number>; hips0: THREE.Vector3; piv0: THREE.Vector2 } | null = null;
  ragdolled = false;
  private phase: number;
  private undo = new Map<THREE.Object3D, THREE.Quaternion>();

  constructor(readonly look: Look, readonly scale = 1) {
    this.phase = new Rng(look.seed * 7 + 3).next();
    const sex: Sex = look.sex ?? (look.hairStyle === 'ponytail' || look.hairStyle === 'long' ? 'f' : look.infected ? (look.seed % 3 === 0 ? 'f' : 'm') : 'm');
    this.model = cloneSkinned(KIT!.outfit[sex].scene);
    this.model.traverse((o) => { if ((o as THREE.Bone).isBone) this.bone[o.name] = o as THREE.Bone; });
    const inf = !!look.infected, skin = inf ? INFECTED_SKIN.clone().lerp(new THREE.Color(look.skin), 0.35) : new THREE.Color(look.skin);
    const dirt = (c: number) => (inf ? new THREE.Color(c).lerp(new THREE.Color(0x3a3530), 0.45) : new THREE.Color(c));
    // clothes: tint each outfit part
    this.model.traverse((o) => {
      const m = o as THREE.SkinnedMesh; if (!m.isSkinnedMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial, n = m.name.toLowerCase();
      const isSkin = /regular/i.test(mat.name);
      m.material = isSkin ? tinted(mat, skin, 0.35, 1.4) : n.includes('legs') ? tinted(mat, dirt(look.pants)) : n.includes('feet') ? tinted(mat, dirt(look.boots))
        : n.includes('arms') ? tinted(mat, dirt(look.topStyle === 'tshirt' || look.topStyle === 'vest' ? look.shirt : look.top)) : tinted(mat, dirt(look.top));
      this.meshes.push(m); m.castShadow = true; m.frustumCulled = false;
    });
    // face, eyes, eyebrows from the base body, rebound to this skeleton
    const body = cloneSkinned(KIT!.body[sex].scene), parts: THREE.SkinnedMesh[] = [];
    body.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) parts.push(o as THREE.SkinnedMesh); });
    for (const m of parts) {
      const mat = m.material as THREE.MeshStandardMaterial;
      if (/superhero/i.test(mat.name)) { faceOnly(m, sex); m.material = tinted(mat, skin, 0.35, 1.4); }
      else if (/eye/i.test(mat.name) && !/brow/i.test(m.name)) m.material = inf ? tinted(mat, 0xd8d0b0, 1, 1) : tinted(mat, 0xffffff, 0);
      else m.material = tinted(mat, look.hair, 1, 1.6);
      const skel = new THREE.Skeleton(m.skeleton.bones.map((b) => this.bone[b.name]), m.skeleton.boneInverses);
      this.model.add(m); m.bind(skel, m.bindMatrix); m.frustumCulled = false; m.castShadow = true; this.meshes.push(m);
    }
    // hair (static meshes modelled on the bind-pose head)
    const style = look.hairStyle === 'long' ? 'long' : look.hairStyle === 'ponytail' ? 'buns' : look.hairStyle === 'buzz' ? 'buzzed' : look.hairStyle === 'bald' ? null : 'simpleparted';
    this.model.updateMatrixWorld(true);
    for (const h of [style, look.beard ? 'beard' : null]) {
      if (!h || (look.headwear === 'hood' && h !== 'beard')) continue;
      const hs = KIT!.hair[h].scene.clone(true);
      hs.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.material = tinted(m.material as THREE.Material, inf ? 0x3a3530 : look.hair, 1, 1.6); m.castShadow = true; } });
      this.model.add(hs); hs.updateMatrixWorld(true); this.bone[BN.head].attach(hs);
    }
    this.mats = this.meshes.map((m) => m.material as THREE.MeshStandardMaterial);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.root.add(this.model);
    this.root.scale.setScalar(scale * (look.build && look.build > 1.3 ? 1.08 : 1));
    // build is uniform only: a non-uniform scale on a skeleton's parent skews bone matrices and corrupts
    // any rotation read back from them (the 'exploding' Miller/infected while sprinting)
    if (look.build && look.build <= 1.3) this.model.scale.setScalar(0.94 + look.build * 0.06);

    // pose once (idle) and attach gear in that pose with Object3D.attach (keeps world placement)
    this.play('Idle_Loop', 'lower'); this.play('Idle_Loop', 'upper'); this.mixer.update(0); this.model.updateMatrixWorld(true);
    this.gear();
    const sg = new THREE.CircleGeometry(0.45, 20); sg.rotateX(-Math.PI / 2);
    this.shadow = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.4, depthWrite: false }));
    this.shadow.position.y = 0.012; this.shadow.scale.z = 0.45; this.root.add(this.shadow);
  }

  private b(n: string): THREE.Bone { return this.bone[n] ?? this.bone[BN.hips]; }

  private gear(): void {
    const L = this.look, head = this.b(BN.head), chest = this.b(BN.spine3);
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
    const hand = this.b(BN.handR);
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
    if (!once) a.time = this.phase * a.getClip().duration;          // nobody moves in lock-step
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
    const L = this.look, tempo = L.tempo ?? 1, task = i.task === 'search' ? 'Fixing_Kneeling' : i.task === 'interact' ? 'Interact' : null;
    if (i.dormant) this.play('Death01', 'lower', 0.3, 1, true);
    else if (task) this.play(task, 'lower', 0.25);
    else if (i.heal > 0) this.play('Fixing_Kneeling', 'lower');
    else if (i.crouch) this.play(moving ? 'Crouch_Fwd_Loop' : 'Crouch_Idle_Loop', 'lower', 0.2, moving ? Math.max(0.5, i.speed / 1.0) : 1);
    else if (!moving) this.play(i.drawn || inf ? 'Idle_Loop' : L.idle ?? 'Idle_Loop', 'lower', 0.35, inf ? 0.8 + this.phase * 0.4 : 1);
    else if (i.speed > 3.2) this.play('Sprint_Loop', 'lower', 0.2, i.speed / 5.6);
    else if (i.speed > 2.1) this.play('Jog_Fwd_Loop', 'lower', 0.2, i.speed / 3.4);
    else this.play(!inf && L.walk && !i.drawn ? L.walk : 'Walk_Loop', 'lower', 0.25, walkRate(i.speed) * tempo * (inf && i.gait !== 'sprint' ? 0.8 + this.phase * 0.25 : 1));
    // ---- upper body: actions over locomotion
    const lowerName = this.lowerName;
    if (i.recoil > this.lastRecoil + 0.2) this.shotT = 0.18;
    this.lastRecoil = i.recoil; this.shotT -= dt;
    if (i.dormant) this.play('Death01', 'upper', 0.3, 1, true);
    else if (task) this.play(task, 'upper', 0.25);
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
    // undo last frame's procedural offsets first: three's PropertyMixer skips writing a bone whose sampled
    // value did not change (e.g. Sprint_Loop's constant spine), so an offset added after the mixer would
    // otherwise pile up every frame — the 'somersault' while running
    for (const [b, q] of this.undo) b.quaternion.copy(q);
    this.undo.clear();
    this.mixer.update(dt);

    // ---- procedural layer: infected hunch + reaching arms; survivors lean when sprinting
    const spine = this.b(BN.spine1), neck = this.b(BN.neck);
    if (inf && !i.dormant) {
      const hunch = i.gait === 'sprint' ? 0.35 : i.gait === 'brute' ? 0.25 : 0.42;
      rotateModelSpace(spine, this.model, ARM_UP, hunch, this.undo); rotateModelSpace(neck, this.model, ARM_UP, -0.25 + Math.sin(i.t * 2.3) * 0.08, this.undo);
      if (i.attack <= 0) {
        const reach = i.run ? -1.25 : -0.35 + Math.sin(i.t * 1.7) * 0.08;
        for (const s of ['L', 'R'] as const) rotateModelSpace(this.b(BN.upper(s === 'L' ? 'l' : 'r')), this.model, ARM_UP, reach + (s === 'L' ? Math.sin(i.t * 2) * 0.1 : 0), this.undo);
      }
    }

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
    const near = facing > 0 ? 'r' : 'l', far = facing > 0 ? 'l' : 'r';
    const map: [Part, string][] = [['torso', BN.hips], ['head', BN.head],
      ['upperArmF', BN.upper(near)], ['foreArmF', BN.fore(near)], ['upperArmB', BN.upper(far)], ['foreArmB', BN.fore(far)],
      ['thighF', BN.thigh(near)], ['shinF', BN.calf(near)], ['thighB', BN.thigh(far)], ['shinB', BN.calf(far)]];
    this.model.updateMatrixWorld(true);
    if (!this.rag) {
      const w0 = new Map<THREE.Bone, THREE.Quaternion>(), a0 = new Map<Part, number>();
      for (const [p, n] of map) { w0.set(this.b(n), this.b(n).getWorldQuaternion(new THREE.Quaternion())); a0.set(p, get(p).a); }
      const t = get('torso');
      this.rag = { w0, a0, hips0: this.b(BN.hips).getWorldPosition(new THREE.Vector3()), piv0: new THREE.Vector2(t.x, t.y) };
      this.weapon?.parent?.remove(this.weapon);
    }
    const R = this.rag;
    // hips position follows the torso pivot, rotated by the torso's delta
    const t = get('torso'), dT = t.a - R.a0.get('torso')!;
    _v.set(R.hips0.x - R.piv0.x, R.hips0.y - R.piv0.y, 0).applyAxisAngle(WORLD_Z, dT).add(new THREE.Vector3(t.x, t.y, R.hips0.z));
    const hips = this.b(BN.hips); hips.parent!.worldToLocal(_v); hips.position.copy(_v);
    for (const [p, n] of map) {
      const bone = this.b(n), d = get(p).a - R.a0.get(p)!;
      _q.setFromAxisAngle(WORLD_Z, d).multiply(R.w0.get(bone)!);              // desired world rotation
      bone.parent!.getWorldQuaternion(_q2); bone.quaternion.copy(_q2.invert().multiply(_q));
      bone.updateMatrixWorld(true);
    }
    this.shadow.scale.set(2.2, 1, 0.5);
  }

  flash(v: number): void { for (const m of this.mats) m.emissive.setRGB(v * 0.55, v * 0.06, v * 0.04); }
  setOpacity(o: number): void { for (const m of this.mats) { m.transparent = o < 1; m.opacity = o; } }
  muzzle(): THREE.Vector3 | null {
    if (!this.weapon || this.weapon.parent !== this.weaponMount) return null;
    const tip = this.weapon.getObjectByName('muzzle');
    if (!tip) return null;
    const p = tip.getWorldPosition(new THREE.Vector3()); p.z = Math.max(p.z, 0.15); return p;
  }
  get muzzleReady(): boolean { return !!this.weapon; }
  dispose(): void { this.mixer.stopAllAction(); for (const m of this.mats) m.dispose(); }
}
