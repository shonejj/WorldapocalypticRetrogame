import * as THREE from 'three';
import type { CharAssets } from './assets';
import { litMaterial } from './lighting';
import { HUMAN_HEIGHT, sheetToWorld, type SpriteRagdoll } from '../physics/spriteRagdoll';

export type AnimName = 'idle' | 'walk' | 'run' | 'draw' | 'aim' | 'aimWalk';

/** Distance (m) covered by one loop of each locomotion animation. */
const STRIDE: Partial<Record<AnimName, number>> = { walk: 2.2, aimWalk: 2.2, run: 4.0 };
const FPS: Partial<Record<AnimName, number>> = { idle: 6, aim: 8, draw: 26 };

/**
 * Painted sprite character: frame playback from the atlas, wet-street
 * reflection, contact shadow, recoil/lunge offsets, and a ragdoll mode where the
 * cut-out limbs follow physics bodies.
 */
export class CharacterSprite {
  readonly group = new THREE.Group();
  private geo: THREE.PlaneGeometry;
  private body: THREE.Mesh;
  private reflection: THREE.Mesh;
  private shadow: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private reflMat: THREE.MeshBasicMaterial;
  private partMeshes: { name: string; mesh: THREE.Mesh }[] = [];
  readonly k: number;
  anim: AnimName = 'idle';
  frame = 0;
  private t = 0;
  private flash = 0;
  recoil = 0;
  lunge = 0;
  lying = 0;            // 0 standing … 1 lying on the ground (dormant infected)
  squash = 1;
  opacity = 1;
  private baseTint: THREE.Color;

  constructor(readonly c: CharAssets, readonly scale: number, z: number, tint = 0xffffff) {
    const m = c.meta;
    this.k = (HUMAN_HEIGHT * scale) / m.figureH;
    const w = m.cellW * this.k, h = m.cellH * this.k;
    this.geo = new THREE.PlaneGeometry(w, h);
    // origin at the feet
    this.geo.translate(w / 2 - m.footX * this.k, h / 2 - 3 * this.k, 0);
    this.baseTint = new THREE.Color(tint);
    this.mat = litMaterial(c.tex, { tint, lit: 0.72 });          // characters stay readable in dark areas
    this.body = new THREE.Mesh(this.geo, this.mat);
    this.reflMat = litMaterial(c.tex, { reflect: true, tint, lit: 0.8 });
    this.reflection = new THREE.Mesh(this.geo, this.reflMat);
    this.reflection.scale.y = -1;
    this.reflection.position.z = -1.0 - z;        // just above the ground layer
    const sg = new THREE.CircleGeometry(0.5 * scale, 20); sg.scale(1, 0.1, 1);
    this.shadow = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
    this.shadow.position.z = -0.05;
    this.group.add(this.reflection, this.shadow, this.body);
    this.group.position.z = z;
    this.setFrame('idle', 0);
  }

  private setUV(row: number, col: number, flip: boolean): void {
    const m = this.c.meta, uv = this.geo.getAttribute('uv') as THREE.BufferAttribute;
    const W = m.cols * m.cellW, H = m.rows * m.cellH;
    const u0 = (col * m.cellW) / W, u1 = ((col + 1) * m.cellW) / W;
    const v1 = 1 - (row * m.cellH) / H, v0 = 1 - ((row + 1) * m.cellH) / H;
    // PlaneGeometry uv order: (0,1) (1,1) (0,0) (1,0)
    uv.setXY(0, flip ? u1 : u0, v1); uv.setXY(1, flip ? u0 : u1, v1); uv.setXY(2, flip ? u1 : u0, v0); uv.setXY(3, flip ? u0 : u1, v0);
    uv.needsUpdate = true;
  }

  setFrame(anim: AnimName, frame: number): void {
    const a = this.c.meta.anims[anim] ?? this.c.meta.anims.idle;
    this.anim = anim; this.frame = frame % a.count;
    this.setUV(a.row, this.frame, false);
  }

  /** Advance animation by time and distance travelled. */
  play(anim: AnimName, dt: number, speed: number, rate = 1): void {
    const a = this.c.meta.anims[anim] ?? this.c.meta.anims.idle;
    if (anim !== this.anim) { this.t = 0; this.anim = anim; if (anim === 'draw') this.frame = 0; }
    const stride = STRIDE[anim];
    const fps = stride ? (Math.max(0.3, speed) / (stride * this.scale)) * a.count : FPS[anim] ?? 8;
    this.t += dt * fps * rate;
    while (this.t >= 1) { this.t -= 1; this.frame = anim === 'draw' ? Math.min(a.count - 1, this.frame + 1) : (this.frame + 1) % a.count; }
    this.setUV(a.row, this.frame % a.count, false);
  }
  get drawDone(): boolean { return this.anim === 'draw' && this.frame >= (this.c.meta.anims.draw?.count ?? 1) - 1; }

  hurtFlash(v: number): void { this.flash = Math.max(this.flash, v); }

  /** Place the living character. */
  pose(x: number, y: number, facing: 1 | -1, dt: number): void {
    this.recoil *= Math.exp(-dt * 18); this.lunge *= Math.exp(-dt * 10); this.flash = Math.max(0, this.flash - dt * 4);
    this.group.position.x = x - facing * this.recoil + facing * this.lunge;
    this.group.position.y = y;
    const sx = facing * 1;
    this.body.scale.set(sx, this.squash, 1);
    this.reflection.scale.set(sx, -this.squash, 1);
    // lying (dormant): rotate around the feet and drop to the ground
    this.body.rotation.z = facing * this.lying * 1.42;
    this.body.position.set(-facing * this.lying * 0.75 * this.scale, this.lying * 0.18, 0);
    this.reflection.visible = this.lying < 0.5;
    this.shadow.scale.x = 1 + this.lying * 1.2;
    const f = this.flash;
    this.mat.color.copy(this.baseTint).multiplyScalar(1).add(new THREE.Color(f * 1.4, f * 0.1, f * 0.05));
    this.mat.opacity = this.opacity; this.reflMat.opacity = this.opacity;
  }

  /** World-space muzzle position for the current aim frame (or null if not aiming). */
  muzzle(facing: 1 | -1): { x: number; y: number } | null {
    const a = this.c.meta.anims[this.anim];
    const m = a?.muzzle?.[this.frame];
    if (!m) return null;
    const [dx, dy] = sheetToWorld(this.c.meta, m[0], m[1], this.scale, facing);
    return { x: this.group.position.x + dx + facing * 0.05, y: this.group.position.y + dy };
  }

  // ---------------------------------------------------------------- ragdoll mode
  enterRagdoll(): void {
    this.body.visible = false; this.reflection.visible = false;
    const sheet = this.c.meta.parts;
    for (const p of sheet.list) {
      const g = new THREE.PlaneGeometry(p.aw * this.k, p.ah * this.k);
      const uv = g.getAttribute('uv') as THREE.BufferAttribute;
      const u0 = p.ax / sheet.w, u1 = (p.ax + p.aw) / sheet.w, v1 = 1, v0 = 1 - p.ah / sheet.h;
      uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0);
      const mesh = new THREE.Mesh(g, litMaterial(this.c.parts, { tint: this.baseTint.getHex(), lit: 0.72 }));
      mesh.position.z = p.name === 'torso' ? 0.01 : p.name.endsWith('B') ? -0.01 : 0.02;
      this.group.add(mesh); this.partMeshes.push({ name: p.name, mesh });
    }
  }

  poseRagdoll(r: SpriteRagdoll): void {
    const t = r.bodies.get('torso')!.getPosition();
    this.group.position.set(t.x, 0, this.group.position.z);
    for (const { name, mesh } of this.partMeshes) {
      const b = r.bodies.get(name); if (!b) continue;
      const p = b.getPosition();
      mesh.position.x = p.x - t.x; mesh.position.y = p.y;
      mesh.rotation.z = b.getAngle(); mesh.scale.x = r.facing;
      (mesh.material as THREE.MeshBasicMaterial).opacity = this.opacity;
    }
    this.shadow.visible = t.y < 0.6; this.shadow.scale.x = 2;
  }

  dispose(): void {
    this.geo.dispose(); this.mat.dispose(); this.reflMat.dispose();
    for (const { mesh } of this.partMeshes) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }
    (this.shadow.material as THREE.Material).dispose(); this.shadow.geometry.dispose();
  }
}
