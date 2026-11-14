import * as THREE from 'three';
import { Batch, box, cyl, M } from '../art/kit';
import { Rng } from '../core/math';

/**
 * Set dressing for the 3D houses (Long Gone's interiors: somebody lived here, then left in a hurry).
 * Wallpaper with stains and peeling, wainscot and skirting, rugs, fallen chairs, papers, bottles,
 * frames, plants and vines pushing in at the windows, light shafts through the glass, dust in the air.
 * Everything is merged into the house batch except the additive shafts and the dust points.
 */
const cache = new Map<string, THREE.MeshStandardMaterial>();
export function wallpaper(tint: string, seed: number): THREE.MeshStandardMaterial {
  const key = tint + seed; let m = cache.get(key); if (m) return m;
  const W = 128, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!, R = new Rng(seed);
  g.fillStyle = tint; g.fillRect(0, 0, W, H);
  const style = seed % 3;
  g.globalAlpha = 0.22; g.fillStyle = '#000';
  if (style === 0) for (let x = 0; x < W; x += 16) g.fillRect(x, 0, 5, H);                                  // stripes
  else for (let y = 8; y < H; y += 24) for (let x = (y / 24) % 2 ? 8 : 20; x < W; x += 24) { g.beginPath(); g.ellipse(x, y, 4, 6, 0, 0, 7); g.fill(); }   // small damask
  if (style === 2) { g.globalAlpha = 0.12; for (let x = 0; x < W; x += 32) g.fillRect(x + 14, 0, 2, H); }
  // water stains running down from the ceiling, grime toward the floor
  for (let k = 0; k < 3; k++) { const x = R.range(0, W), w = R.range(10, 34), grd = g.createLinearGradient(0, 0, 0, R.range(80, 220));
    grd.addColorStop(0, 'rgba(60,40,20,0.45)'); grd.addColorStop(1, 'rgba(60,40,20,0)'); g.globalAlpha = 1; g.fillStyle = grd; g.fillRect(x, 0, w, H); }
  const gr = g.createLinearGradient(0, H * 0.7, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(20,14,8,0.5)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // peeling: torn patches showing pale plaster with a dark rim
  for (let k = 0; k < 2; k++) { const x = R.range(0, W - 20), y = R.range(40, H - 60), w = R.range(6, 16), h = R.range(10, 24);
    g.globalAlpha = 0.7; g.fillStyle = '#1a140e'; g.fillRect(x - 1, y - 1, w + 2, h + 2); g.fillStyle = '#7a7060'; g.fillRect(x, y, w, h); }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.userData.keep = true;
  m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 }); cache.set(key, m);
  return m;
}

export interface Dressing { shafts: THREE.Object3D[]; dust: THREE.Points }

/**
 * Add clutter to the batch. `floor(i,j)` says whether a cell is open floor; `cell(i,j)` gives its centre.
 * Only cells that are plain floor with nothing else on them get clutter, and never the 4 cells around the door.
 */
export function dress(root: THREE.Group, B: Batch, plan: string[][], cell: (i: number, j: number) => [number, number], C: number, H: number, seed: number, door: [number, number], windows: [number, number][]): Dressing {
  const R = new Rng(seed);
  const wood = M.wood('#4a3424'), dark = M.wood('#2a1d14'), paper = M.cloth(0xd8d0bc), rug = M.cloth(0x6a2e2a), rug2 = M.cloth(0x2e4a5a), glass = M.emissive(0x3a5a3a, 0.2), leaf = M.leaves(true, 9), frame = M.wood('#5a4028'), skirt = M.wood('#1e1610');
  const open = (i: number, j: number) => plan[j]?.[i] === '.';
  const wallAt = (i: number, j: number) => { const c = plan[j]?.[i]; return c === '#' || c === 'w'; };
  for (let j = 0; j < plan.length; j++) for (let i = 0; i < plan[j].length; i++) {
    if (!open(i, j)) continue;
    const [x, z] = cell(i, j), nearDoor = Math.abs(i - door[0]) + Math.abs(j - door[1]) <= 1;
    // skirting + wainscot along every wall this floor cell touches
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!wallAt(i + di, j + dj)) continue;
      const wx = x + di * (C / 2 - 0.03), wz = z + dj * (C / 2 - 0.03), along = dj !== 0;
      B.add(skirt, box(along ? C : 0.05, 0.14, along ? 0.05 : C, wx, 0.07, wz));
      B.add(dark, box(along ? C : 0.035, 0.9, along ? 0.035 : C, wx - di * 0.01, 0.45, wz - dj * 0.01));
      B.add(frame, box(along ? C : 0.06, 0.05, along ? 0.06 : C, wx - di * 0.02, 0.92, wz - dj * 0.02));
      // a picture frame now and then, sometimes hanging crooked
      if (R.chance(0.14)) { const fw = R.range(0.3, 0.6), fh = R.range(0.3, 0.5), y = R.range(1.4, 1.8);
        B.add(frame, box(along ? fw : 0.03, fh, along ? 0.03 : fw, wx - di * 0.03, y, wz - dj * 0.03, { rotZ: along ? R.range(-0.15, 0.15) : 0, rotX: along ? 0 : R.range(-0.15, 0.15) }));
        B.add(R.chance(0.5) ? rug2 : paper, box(along ? fw * 0.8 : 0.035, fh * 0.75, along ? 0.035 : fw * 0.8, wx - di * 0.045, y, wz - dj * 0.045)); }
    }
    if (nearDoor) continue;
    const r = R.next();
    if (r < 0.12) {                                     // a rug
      B.add(R.chance(0.5) ? rug : rug2, box(C * 0.8, 0.012, C * 0.6, x, 0.008, z, { rotY: R.range(-0.3, 0.3) }));
    } else if (r < 0.22) {                              // a chair on its side
      const a = R.range(0, 6.28), cx = x + R.range(-0.4, 0.4), cz = z + R.range(-0.4, 0.4);
      B.add(wood, box(0.45, 0.05, 0.45, cx, 0.25, cz, { rotY: a, rotZ: 1.4 }), box(0.45, 0.5, 0.05, cx + Math.cos(a) * 0.2, 0.22, cz - Math.sin(a) * 0.2, { rotY: a, rotX: 1.2 }));
    } else if (r < 0.4) {                               // papers, a bottle, a box
      for (let k = 0; k < 4; k++) B.add(paper, box(0.21, 0.004, 0.29, x + R.range(-0.6, 0.6), 0.004 + k * 0.001, z + R.range(-0.6, 0.6), { rotY: R.range(0, 6.28) }));
      if (R.chance(0.6)) B.add(glass, cyl(0.035, 0.035, 0.24, x + R.range(-0.5, 0.5), 0.035, z + R.range(-0.5, 0.5), 8, { rotZ: Math.PI / 2 }));
      if (R.chance(0.4)) B.add(M.cloth(0x6a5a40), box(0.4, 0.3, 0.32, x + R.range(-0.5, 0.5), 0.15, z + R.range(-0.5, 0.5), { rotY: R.range(0, 1) }));
    } else if (r < 0.46) {                              // a potted plant gone wild
      const px = x + R.range(-0.5, 0.5), pz = z + R.range(-0.5, 0.5);
      B.add(M.cloth(0x7a4a32), cyl(0.16, 0.12, 0.3, px, 0.15, pz, 10));
      for (let k = 0; k < 5; k++) B.add(leaf, box(0.5, 0.6, 0.01, px, 0.6, pz, { rotY: k * 0.63 }));
    }
  }
  // vines and plants at the windows: the outside getting in
  const shafts: THREE.Object3D[] = [];
  const shaftMat = new THREE.MeshBasicMaterial({ color: 0x9ab8d0, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  for (const [i, j] of windows) {
    const [x, z] = cell(i, j), side = plan[j + 1]?.[i] === '.' ? 1 : -1, wz = z + side * (C / 2 + 0.02);
    for (let k = 0; k < 4; k++) B.add(leaf, box(0.4, R.range(0.6, 1.1), 0.01, x + R.range(-0.5, 0.5), R.range(1.2, 2.2), wz + side * 0.02, { rotZ: R.range(-0.4, 0.4) }));
    // a slanted shaft of window light falling into the room
    const g = new THREE.PlaneGeometry(C * 0.5, 2.6); g.translate(0, -1.3, 0);
    const s = new THREE.Mesh(g, shaftMat); s.position.set(x, 2.0, wz); s.rotation.x = side * 0.75; root.add(s); shafts.push(s);
    const s2 = s.clone(); s2.rotation.y = Math.PI / 2; s2.scale.x = 0.35; root.add(s2); shafts.push(s2);
  }
  // dust hanging in the air
  const n = 260, pos = new Float32Array(n * 3);
  const cols = plan[0].length, rows = plan.length, [x0, z0] = cell(0, 0);
  for (let k = 0; k < n; k++) { pos[k * 3] = x0 + R.range(0, cols * C); pos[k * 3 + 1] = R.range(0.2, H - 0.2); pos[k * 3 + 2] = z0 + R.range(0, rows * C); }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xd8d0c0, size: 0.025, transparent: true, opacity: 0.55, depthWrite: false }));
  root.add(dust);
  return { shafts, dust };
}
