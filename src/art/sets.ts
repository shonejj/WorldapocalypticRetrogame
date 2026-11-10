import * as THREE from 'three';
import { Rng } from '../core/math';
import { Batch, M, box, cyl, glowSprite, plane } from './kit';
import type { Backdrop } from './backdrop';

/**
 * Backdrops for the places beyond the city (art direction: fog-bound silhouettes).
 *  road     — the highway out of town: bare trees in ranks, pylons marching into the fog, low hills
 *  facility — Genova Labs: a perimeter of dead trees, the lab blocks and the broadcast mast behind
 * Every layer is an unlit dark silhouette at a fixed depth; fog and the haze sheets pale each rank,
 * which is the whole look. Merged per material, so a backdrop is 2–3 draw calls.
 */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);

/** A leafless tree: recursive tapered limbs. */
export function bareTree(B: Batch, mat: THREE.Material, R: Rng, x: number, z: number, h: number, depth = 4): void {
  const limb = (p: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, d: number) => {
    const g = new THREE.CylinderGeometry(r * 0.62, r, len, d > 2 ? 6 : 4, 1, true); g.translate(0, len / 2, 0);
    _q.setFromUnitVectors(UP, dir); g.applyMatrix4(_m.compose(p, _q, _s)); B.add(mat, g);
    if (d <= 0) return;
    const end = p.clone().addScaledVector(dir, len), n = d === depth ? R.int(2, 3) : R.int(2, 3);
    for (let k = 0; k < n; k++) {
      const nd = dir.clone().add(new THREE.Vector3(R.range(-0.9, 0.9), R.range(0.1, 0.7), R.range(-0.5, 0.5))).normalize();
      limb(k === 0 ? end : p.clone().addScaledVector(dir, len * R.range(0.55, 0.95)), nd, len * R.range(0.55, 0.78), r * 0.6, d - 1);
    }
  };
  limb(new THREE.Vector3(x, -0.1, z), new THREE.Vector3(R.range(-0.08, 0.08), 1, 0).normalize(), h * 0.38, h * 0.022, depth);
}

function pylon(B: Batch, mat: THREE.Material, x: number, z: number, h: number): void {
  for (const dx of [-1, 1]) B.add(mat, box(0.22, h, 0.22, x + dx * 1.1, h / 2, z, { rotZ: -dx * 0.06 }));
  for (let y = 2; y < h; y += 3) B.add(mat, box(2.6, 0.14, 0.14, x, y, z, { rotZ: (y / 3) % 2 < 1 ? 0.5 : -0.5 }));
  for (const y of [h - 0.5, h - 4]) B.add(mat, box(9, 0.2, 0.2, x, y, z));
}
function wires(B: Batch, mat: THREE.Material, xs: number[], z: number, y: number, sag: number, off: number[]): void {
  for (let i = 0; i + 1 < xs.length; i++) for (const o of off) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(new THREE.Vector3(xs[i] + (xs[i + 1] - xs[i]) * t + o, y - Math.sin(t * Math.PI) * sag, z)); }
    B.add(mat, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.05, 3));
  }
}
function land(x0: number, x1: number, color: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(x1 - x0 + 240, 110).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, -0.02, -60);
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 1 }));
}
function hills(B: Batch, mat: THREE.Material, R: Rng, x0: number, x1: number, z: number, h: number): void {
  for (let x = x0 - 80; x < x1 + 80; x += R.range(28, 50)) { const r = R.range(26, 46); const g = new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, (h * R.range(0.6, 1)) / r, 0.5); g.translate(x, -0.5, z); B.add(mat, g); }
}

export function roadBackdrop(x0: number, x1: number, seed: number): Backdrop {
  const R = new Rng(seed), g = new THREE.Group(), B = new Batch();
  const near = M.silhouette(0x1b2226), mid = M.silhouette(0x222b30), far = M.silhouette(0x2a353a);
  g.add(land(x0, x1, 0x30383a));
  // ranks of bare trees: the nearest just behind the verge, then two more, each paler through the fog
  for (let x = x0 - 20; x < x1 + 20; x += R.range(5, 12)) bareTree(B, near, R, x, R.range(-6.2, -8.5), R.range(6, 10), 4);
  for (let x = x0 - 30; x < x1 + 30; x += R.range(4, 9)) bareTree(B, mid, R, x, R.range(-15, -20), R.range(8, 13), 3);
  for (let x = x0 - 40; x < x1 + 40; x += R.range(5, 9)) bareTree(B, far, R, x, R.range(-30, -38), R.range(10, 16), 2);
  const xs: number[] = []; for (let x = x0 - 60; x < x1 + 80; x += 46) { xs.push(x); pylon(B, mid, x, -26, 24); }
  wires(B, mid, xs, -26, 23.4, 3.2, [-4.3, 4.3]); wires(B, mid, xs, -26, 19.9, 3.2, [-4.3, 4.3]);
  hills(B, far, R, x0, x1, -70, 16);
  g.add(B.build({ castShadow: false, receiveShadow: false }));
  return { group: g, blinkers: [] };
}

export function facilityBackdrop(x0: number, x1: number, seed: number, labX: number): Backdrop {
  const R = new Rng(seed), g = new THREE.Group(), B = new Batch(), blinkers: THREE.Sprite[] = [];
  const near = M.silhouette(0x1c1a22), mid = M.silhouette(0x2a2430), far = M.silhouette(0x3a2e38), lamp = M.emissive(0xffc27a, 2.5), cold = M.emissive(0x8fe0f0, 2);
  g.add(land(x0, x1, 0x2c2a2e));
  for (let x = x0 - 20; x < x1 + 20; x += R.range(7, 15)) if (Math.abs(x - labX) > 14) bareTree(B, near, R, x, R.range(-6.5, -9), R.range(6, 9), 4);
  for (let x = x0 - 30; x < x1 + 30; x += R.range(6, 12)) bareTree(B, mid, R, x, R.range(-16, -22), R.range(8, 12), 3);
  // the complex: stepped blocks, a few windows still lit, pipe bridges, the broadcast mast
  for (let x = labX - 70; x < labX + 80; x += R.range(16, 26)) {
    const w = R.range(14, 24), h = R.range(12, 30), z = -34 - R.range(0, 10);
    B.add(mid, box(w, h, 10, x, h / 2, z)); B.add(far, box(w * 0.6, h * 0.5, 8, x + R.range(-4, 4), h + h * 0.25, z - 2));
    for (let k = 0; k < 5; k++) if (R.chance(0.5)) B.add(R.chance(0.7) ? lamp : cold, plane(R.range(0.8, 2.4), 0.5, x + R.range(-w / 2 + 1, w / 2 - 1), R.range(3, h - 1), z + 5.05));
  }
  const mh = 62, mx = labX + 8, mz = -44;
  for (const dx of [-1.4, 1.4]) B.add(mid, box(0.35, mh, 0.35, mx + dx * 0.6, mh / 2, mz, { rotZ: -dx * 0.012 }));
  for (let y = 1.5; y < mh; y += 3) B.add(mid, box(2.6, 0.16, 0.16, mx, y, mz, { rotZ: (y / 3) % 2 < 1 ? 0.75 : -0.75 }));
  for (const y of [mh - 6, mh - 14]) for (const dx of [-1, 1]) B.add(mid, cyl(1.4, 0.3, 0.8, mx + dx * 1.6, y, mz + 0.4, 10, { rotX: Math.PI / 2 }));
  for (const fy of [mh, mh * 0.66, mh * 0.33]) { const sp = glowSprite(fy === mh ? 3.2 : 2, 0xff2a1a, 0.95); sp.position.set(mx, fy, mz + 0.5); blinkers.push(sp); }
  hills(B, far, R, x0, x1, -90, 22);
  const group = B.build({ castShadow: false, receiveShadow: false }); g.add(group);
  for (const sp of blinkers) g.add(sp);
  return { group: g, blinkers };
}
