import * as THREE from 'three';
import { Rng } from '../core/math';
import { Batch, M, cyl } from './kit';
import * as TX from './textures';

/** Crossed leaf cards around a centre (cheap volumetric foliage). */
function leafCluster(B: Batch, mat: THREE.Material, x: number, y: number, z: number, s: number, R: Rng): void {
  for (let k = 0; k < 3; k++) {
    const g = new THREE.PlaneGeometry(s * R.range(0.8, 1.2), s * R.range(0.7, 1));
    g.rotateY((k * Math.PI) / 3 + R.range(-0.2, 0.2)); g.rotateZ(R.range(-0.3, 0.3)); g.translate(x, y, z);
    B.add(mat, g);
  }
}

export function tree(seed = 1, scale = 1): THREE.Group {
  const R = new Rng(seed), B = new Batch(), bark = M.wood('#3a2c20'), leaf = M.leaves(R.chance(0.5), 9 + (seed % 3));
  const H = 6 * scale;
  B.add(bark, cyl(0.12 * scale, 0.25 * scale, H * 0.65, 0, H * 0.32, 0, 8, { tile: 1 }));
  for (let i = 0; i < 6; i++) {
    const a = R.range(0, Math.PI * 2), y = H * R.range(0.45, 0.65), len = R.range(1.2, 2.2) * scale;
    const g = new THREE.CylinderGeometry(0.03 * scale, 0.08 * scale, len, 6); g.translate(0, len / 2, 0); g.rotateZ(R.range(0.5, 1.1)); g.rotateY(a); g.translate(0, y, 0);
    B.add(bark, g);
  }
  for (let i = 0; i < 16; i++) leafCluster(B, leaf, R.range(-1.8, 1.8) * scale, H * R.range(0.55, 1.0), R.range(-1.4, 1.4) * scale, R.range(1.4, 2.4) * scale, R);
  return B.build();
}

export function bush(seed = 1, size = 1, dark = false): THREE.Group {
  const R = new Rng(seed), B = new Batch(), leaf = M.leaves(dark, 9 + (seed % 3));
  for (let i = 0; i < 7; i++) leafCluster(B, leaf, R.range(-0.7, 0.7) * size, R.range(0.25, 0.6) * size, R.range(-0.4, 0.4) * size, R.range(0.6, 1.1) * size, R);
  return B.build({ castShadow: false });
}

/** Instanced grass/weed tufts scattered over strips: [x0, x1, z0, z1, y]. */
export function grass(strips: [number, number, number, number, number][], density: number, seed = 1): THREE.InstancedMesh {
  const R = new Rng(seed);
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const c = cv.getContext('2d')!;
  for (let i = 0; i < 26; i++) {
    const x = 6 + R.next() * 52, h = 24 + R.next() * 38, lean = (R.next() - 0.5) * 18;
    const grd = c.createLinearGradient(0, 64, 0, 64 - h); grd.addColorStop(0, '#34481e'); grd.addColorStop(1, R.chance(0.3) ? '#a3a65a' : '#78953a');
    c.strokeStyle = grd; c.lineWidth = 1.5 + R.next() * 1.5; c.beginPath(); c.moveTo(x, 64); c.quadraticCurveTo(x + lean * 0.3, 64 - h * 0.6, x + lean, 64 - h); c.stroke();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.PlaneGeometry(0.7, 0.55); g.translate(0, 0.27, 0);
  const g2 = g.clone().rotateY(Math.PI / 2); const merged = new THREE.BufferGeometry();
  const pos = [...(g.getAttribute('position').array as Float32Array), ...(g2.getAttribute('position').array as Float32Array)];
  const uv = [...(g.getAttribute('uv').array as Float32Array), ...(g2.getAttribute('uv').array as Float32Array)];
  const nrm = new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0));     // up-facing normals: soft, even lighting
  const idx = [...(g.index!.array as Uint16Array), ...Array.from(g2.index!.array as Uint16Array, (v) => v + 4)];
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); merged.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); merged.setIndex(idx);
  let count = 0; for (const [x0, x1, z0, z1] of strips) count += Math.floor((x1 - x0) * (z1 - z0) * density);
  const inst = new THREE.InstancedMesh(merged, new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }), count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  let i = 0;
  for (const [x0, x1, z0, z1, y] of strips) {
    const n = Math.floor((x1 - x0) * (z1 - z0) * density);
    for (let k = 0; k < n; k++) {
      const s = R.range(0.45, 1.0); q.setFromEuler(e.set(0, R.range(0, Math.PI), 0));
      m4.compose(new THREE.Vector3(R.range(x0, x1), y, R.range(z0, z1)), q, new THREE.Vector3(s, s * R.range(0.8, 1.4), s));
      inst.setMatrixAt(i++, m4);
    }
  }
  inst.receiveShadow = true;
  return inst;
}

export { TX };
