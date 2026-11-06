import * as THREE from 'three';
import { DIMS, PART_ORDER, type PartName, type Skeleton } from '../game/rig';
import { paintWeapon, type Skin, type WeaponArt } from './art/characters';
import { anchoredPlane } from './renderer';
import type { Ragdoll } from '../physics/ragdoll';
import type { Painter } from './painter';

const weaponTex = new Map<WeaponArt, { tex: THREE.Texture; w: number; h: number; ax: number; ay: number }>();
function weaponMesh(kind: WeaponArt): THREE.Mesh {
  let e = weaponTex.get(kind);
  if (!e) {
    const art = paintWeapon(kind);
    e = { tex: art.painter.texture(), w: art.wM, h: art.hM, ax: art.pivot[0] / art.painter.w, ay: 1 - art.pivot[1] / art.painter.h };
    weaponTex.set(kind, e);
  }
  return new THREE.Mesh(anchoredPlane(e.w, e.h, e.ax, e.ay), new THREE.MeshBasicMaterial({ map: e.tex, transparent: true, alphaTest: 0.5, fog: true }));
}

/** Textures built once per skin and shared by all actors using that skin. */
export interface SkinTextures { parts: Record<PartName, { tex: THREE.Texture; geo: THREE.PlaneGeometry }> }
export function skinTextures(skin: Skin): SkinTextures {
  const parts = {} as SkinTextures['parts'];
  for (const n of PART_ORDER) {
    const a = skin[n];
    const p: Painter = a.painter;
    parts[n] = { tex: p.texture(), geo: anchoredPlane(a.wM, a.hM, a.pivot[0] / p.w, 1 - a.pivot[1] / p.h) };
  }
  return { parts };
}

const BACK: PartName[] = ['uArmB', 'lArmB', 'uLegB', 'lLegB'];

/**
 * Cut-out character: one quad per limb, posed from the simulation skeleton while
 * alive and from ragdoll bodies when dead. Back limbs are darkened for depth.
 */
export class CharacterView {
  readonly group = new THREE.Group();
  private meshes = {} as Record<PartName, THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>;
  private weapon: THREE.Mesh | null = null;
  private weaponKind: WeaponArt | null = null;
  private shadow: THREE.Mesh;
  private baseTint = new THREE.Color(1, 1, 1);
  opacity = 1;

  constructor(tex: SkinTextures, readonly scale: number, z: number, tint = 0xffffff) {
    this.baseTint.set(tint);
    PART_ORDER.forEach((n, i) => {
      const m = new THREE.Mesh(tex.parts[n].geo, new THREE.MeshBasicMaterial({ map: tex.parts[n].tex, transparent: true, alphaTest: 0.5, fog: true }));
      m.position.z = i * 0.002;
      m.scale.setScalar(scale);
      this.meshes[n] = m;
      this.group.add(m);
    });
    const sg = new THREE.CircleGeometry(0.42, 16); sg.scale(1, 0.12, 1);
    this.shadow = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false }));
    this.shadow.position.set(0, 0.02, -0.01);
    this.shadow.scale.setScalar(scale);
    this.group.add(this.shadow);
    this.group.position.z = z;
  }

  setWeapon(kind: WeaponArt | null): void {
    if (kind === this.weaponKind) return;
    if (this.weapon) { this.group.remove(this.weapon); this.weapon = null; }
    this.weaponKind = kind;
    if (kind) { this.weapon = weaponMesh(kind); this.weapon.scale.setScalar(this.scale); this.weapon.position.z = 0.03; this.group.add(this.weapon); }
  }

  /** light: 0..1 local lamp light; hurt flash 0..1. */
  setLighting(light: number, flash: number): void {
    const k = 0.55 + light * 0.6;
    for (const n of PART_ORDER) {
      const c = this.meshes[n].material.color;
      const back = BACK.includes(n) ? 0.68 : 1;
      c.copy(this.baseTint).multiplyScalar(k * back);
      c.r = Math.min(1, c.r * (1 + light * 0.15) + flash * 0.8); c.g = Math.min(1, c.g + flash * 0.1); c.b = Math.min(1, c.b * (1 - light * 0.12) + flash * 0.1);
      this.meshes[n].material.opacity = this.opacity;
    }
    if (this.weapon) (this.weapon.material as THREE.MeshBasicMaterial).color.setScalar(k);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.38 * this.opacity;
  }

  /** Pose from FK skeleton (root at actor feet). */
  pose(skel: Skeleton, x: number, y: number, facing: 1 | -1, weaponAngle: number | null): void {
    this.group.position.x = x; this.group.position.y = y;
    for (const n of PART_ORDER) {
      const m = this.meshes[n], t = skel[n];
      m.position.x = t.x; m.position.y = t.y; m.rotation.z = t.a; m.scale.x = this.scale * facing; m.scale.y = this.scale;
    }
    // draw order flips with facing so "front" limbs stay in front
    PART_ORDER.forEach((n, i) => { this.meshes[n].position.z = i * 0.002; });
    this.shadow.visible = true; this.shadow.position.x = 0;
    if (this.weapon) {
      const h = skel.hand;
      this.weapon.visible = true;
      this.weapon.position.set(h.x, h.y, 0.03);
      this.weapon.rotation.z = weaponAngle ?? (h.a - facing * Math.PI / 2);
      this.weapon.scale.set(this.scale * facing, this.scale, 1);
    }
  }

  /** Pose from ragdoll bodies (world coordinates). */
  poseRagdoll(r: Ragdoll): void {
    const torso = r.bodies.torso.getPosition();
    this.group.position.set(torso.x, 0, this.group.position.z);
    for (const n of PART_ORDER) {
      const b = r.bodies[n], m = this.meshes[n];
      // body is at part centre; mesh origin is the pivot → transform the pivot offset back
      const ang = b.getAngle(), p = b.getPosition();
      const off = pivotOffset(n, this.scale, r.facing);
      const c = Math.cos(ang), s = Math.sin(ang);
      m.position.x = p.x - torso.x + off[0] * c - off[1] * s;
      m.position.y = p.y + off[0] * s + off[1] * c;
      m.rotation.z = ang; m.scale.x = this.scale * r.facing;
    }
    this.shadow.position.x = 0; this.shadow.visible = torso.y < 0.8;
    if (this.weapon) this.weapon.visible = false;
  }

  dispose(): void {
    for (const n of PART_ORDER) this.meshes[n].material.dispose();
    (this.weapon?.material as THREE.Material | undefined)?.dispose();
    (this.shadow.material as THREE.Material).dispose(); this.shadow.geometry.dispose();
  }
}

/** Vector from part centre back to the pivot (local frame, mirrored by facing). */
function pivotOffset(n: PartName, s: number, facing: 1 | -1): [number, number] {
  const d = DIMS[n];
  if (n === 'torso') return [0, -(d.len / 2) * s];
  if (n === 'head') return [-0.02 * s * facing, -(d.len / 2) * s];
  return [0, (d.len / 2) * s];
}

