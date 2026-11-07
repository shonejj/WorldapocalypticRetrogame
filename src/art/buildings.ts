import * as THREE from 'three';
import { Rng } from '../core/math';
import { Batch, M, box, cyl, plane, type LightSpot } from './kit';
import * as TX from './textures';

/** Street layout constants (metres). Gameplay plane is z = 0; facades stand behind it. */
export const FACADE_Z = -4.2;

export interface BuildingSpec {
  x: number; w: number; floors: number;
  kind: 'apartment' | 'store' | 'pharmacy' | 'garage' | 'ruin';
  wall: 'brick' | 'plaster' | 'concrete'; tint: string; seed: number;
  sign?: string; signBg?: string; signFg?: string; awning?: [string, string]; lit?: number;
}
export interface Built { group: THREE.Group; lights: LightSpot[]; doorX?: number }

const awningMats = new Map<string, THREE.Material>();
function awningMat(a: string, b: string): THREE.Material {
  const k = a + b; let m = awningMats.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial({ map: TX.stripes(a, b), roughness: 0.95, side: THREE.DoubleSide }); awningMats.set(k, m); }
  return m;
}

export function building(s: BuildingSpec): Built {
  const R = new Rng(s.seed), B = new Batch(), lights: LightSpot[] = [], extras: THREE.Object3D[] = [];
  const zf = FACADE_Z, depth = 9, ground = s.kind === 'store' || s.kind === 'pharmacy' ? 5.2 : s.kind === 'garage' ? 4.4 : 3.4;
  const H = ground + s.floors * 3.1, x0 = s.x, x1 = s.x + s.w, cx = (x0 + x1) / 2;
  const wall = s.wall === 'brick' ? M.brick(s.tint, s.seed % 3 + 1) : s.wall === 'plaster' ? M.plaster(s.tint, s.seed % 3 + 3) : M.concrete(s.tint, s.seed % 3 + 2);
  const trim = M.concrete('#7a7c78', 2), metal = M.metal(), dark = M.dark();
  const ruin = s.kind === 'ruin';

  // ---- body (ruins get a jagged broken top)
  if (!ruin) B.add(wall, box(s.w, H, depth, cx, H / 2, zf - depth / 2, { tile: 2.5 }));
  else {
    let x = x0;
    while (x < x1 - 0.01) {
      const seg = Math.min(x1 - x, R.range(0.6, 1.8)), h = H * R.range(0.55, 1);
      B.add(wall, box(seg, h, depth, x + seg / 2, h / 2, zf - depth / 2, { tile: 2.5 }));
      for (let k = 0; k < 3; k++) B.add(metal, cyl(0.02, 0.02, R.range(0.4, 1.2), x + R.range(0, seg), h + 0.3, zf - R.range(0.2, 1.5), 4, { rotZ: R.range(-0.4, 0.4) }));
      x += seg;
    }
  }
  // plinth + floor ledges + cornice
  B.add(trim, box(s.w + 0.1, 0.5, 0.25, cx, 0.25, zf + 0.12, { tile: 2 }));
  for (let f = 0; f < s.floors; f++) B.add(trim, box(s.w + 0.06, 0.16, 0.22, cx, ground + f * 3.1 - 0.08, zf + 0.1, { tile: 2 }));
  if (!ruin) {
    B.add(trim, box(s.w + 0.3, 0.45, 0.45, cx, H + 0.1, zf + 0.12, { tile: 2 }));
    // roof clutter: water tank / AC units
    if (R.chance(0.6)) {
      const tx = R.range(x0 + 1.5, x1 - 1.5);
      B.add(metal, cyl(1.0, 1.0, 1.8, tx, H + 2.4, zf - 4, 14, { tile: 2 }), box(2.2, 0.15, 2.2, tx, H + 1.45, zf - 4));
      for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) B.add(metal, box(0.1, 1.4, 0.1, tx + dx, H + 0.7, zf - 4 + dz));
    }
  }

  // ---- upper floor windows
  const cols = Math.max(1, Math.floor((s.w - 0.8) / 2.3));
  const step = (s.w - 0.8) / cols;
  for (let f = 0; f < s.floors; f++) for (let c = 0; c < cols; c++) {
    const wx = x0 + 0.4 + step * (c + 0.5), wy = ground + f * 3.1 + 1.55;
    if (ruin && wy > H * 0.6 && R.chance(0.5)) continue;
    const lit = R.chance(s.lit ?? 0.12) && !ruin;
    const ww = 1.15, wh = 1.6;
    B.add(trim, box(ww + 0.24, 0.12, 0.3, wx, wy - wh / 2 - 0.06, zf + 0.12));           // sill
    B.add(trim, box(ww + 0.18, 0.14, 0.16, wx, wy + wh / 2 + 0.07, zf + 0.06));          // lintel
    B.add(dark, box(0.08, wh, 0.12, wx - ww / 2, wy, zf + 0.04), box(0.08, wh, 0.12, wx + ww / 2, wy, zf + 0.04));
    B.add(ruin ? dark : M.window(lit ? (R.chance(0.2) ? 'tv' : 'lit') : 'dark', R.int(1, 6)), plane(ww, wh, wx, wy, zf + 0.012));
    B.add(dark, box(0.04, wh, 0.03, wx, wy, zf + 0.03), box(ww, 0.04, 0.03, wx, wy + 0.1, zf + 0.03));   // mullions
    if (R.chance(0.2) && !ruin) B.add(M.paint(0x9a9a90, 0.7), box(0.7, 0.5, 0.5, wx + 0.9, wy - 0.4, zf + 0.25));   // AC unit
    if (lit && R.chance(0.35)) lights.push({ x: wx, y: wy, z: zf + 1.2, color: 0xffc27a, intensity: 2, distance: 5 });
  }
  // drainpipe
  if (R.chance(0.7)) B.add(metal, cyl(0.06, 0.06, H, x1 - 0.25, H / 2, zf + 0.1, 8));
  // fire escape
  if (s.kind === 'apartment' && R.chance(0.6) && s.floors >= 2) {
    const fx = x0 + s.w * R.range(0.25, 0.6);
    for (let f = 1; f < s.floors; f++) {
      const fy = ground + f * 3.1 - 0.1;
      B.add(metal, box(2.6, 0.06, 1.0, fx, fy, zf + 0.5), box(2.6, 0.04, 0.04, fx, fy + 0.9, zf + 1.0));
      for (let k = -1.2; k <= 1.2; k += 0.3) B.add(metal, box(0.025, 0.9, 0.025, fx + k, fy + 0.45, zf + 1.0));
      B.add(metal, box(0.08, 3.4, 0.4, fx + 0.6, fy - 1.5, zf + 0.6, { rotZ: 0.75 }));
    }
  }

  // ---- ground floor
  const gy = ground;
  let doorX: number | undefined;
  if (s.kind === 'store' || s.kind === 'pharmacy') {
    const dispW = s.w * 0.45, dispX = x0 + 0.5 + dispW / 2;
    B.add(dark, box(dispW + 0.3, 2.9, 0.1, dispX, 1.75, zf + 0.05));
    B.add(M.window('shop', s.seed), plane(dispW, 2.6, dispX, 1.8, zf + 0.2));
    B.add(M.glass(), box(dispW, 2.6, 0.02, dispX, 1.8, zf + 0.26));
    B.add(metal, box(dispW + 0.3, 0.12, 0.35, dispX, 0.42, zf + 0.25));
    doorX = dispX + dispW / 2 + 1.0;
    B.add(dark, box(1.3, 2.5, 0.2, doorX, 1.25, zf + 0.02));
    B.add(M.window('shop', s.seed + 1), plane(1.0, 1.1, doorX, 1.7, zf + 0.13));
    // half-closed roller shutter over the rest
    const shX0 = doorX + 0.9, shW = x1 - 0.4 - shX0;
    if (shW > 0.8) {
      B.add(M.metal('#6b7378'), box(shW, 2.0, 0.12, shX0 + shW / 2, 2.9, zf + 0.12, { tile: 1.5 }));
      B.add(dark, box(shW, 1.9, 0.05, shX0 + shW / 2, 0.95, zf + 0.04));
      for (let y = 2.0; y < 3.9; y += 0.12) B.add(dark, box(shW, 0.015, 0.02, shX0 + shW / 2, y, zf + 0.19));
    }
    // awning (sloped, tattered front edge)
    const [a1, a2] = s.awning ?? (s.kind === 'store' ? ['#3d6a3a', '#cfc7a8'] : ['#2c5a78', '#cfc7a8']);
    const aw = awningMat(a1, a2);
    const ag = new THREE.PlaneGeometry(s.w - 0.6, 1.4, 24, 1); ag.rotateX(-Math.PI / 2 + 0.42); ag.translate(cx, 3.55, zf + 0.62);
    const pos = ag.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) if (pos.getZ(i) > zf + 0.8) pos.setY(i, pos.getY(i) - Math.max(0, Math.sin(i * 1.7) * 0.06) - (R.chance(0.2) ? 0.12 : 0));
    ag.computeVertexNormals();
    B.add(aw, ag);
    for (let i = 0; i < 12; i++) { const fx = x0 + 0.5 + (i / 11) * (s.w - 1); B.add(aw, plane(s.w / 13, R.range(0.12, 0.35), fx, 3.18, zf + 1.24)); }
    // sign board + lamps
    const signW = Math.min(s.w - 0.8, 6.4), signH = Math.min(1.15, signW / 4.6), signY = gy - 0.62;
    const sign = s.sign ?? (s.kind === 'store' ? 'STORE' : 'PHARMACY');
    B.add(M.sign(sign, s.signBg ?? (s.kind === 'store' ? '#7a2420' : '#1d3f52'), s.signFg ?? '#e9dcb4'), plane(signW, signH, cx, signY, zf + 0.2));
    B.add(dark, box(signW + 0.2, signH + 0.15, 0.15, cx, signY, zf + 0.1));
    for (const lx of [cx - signW * 0.33, cx + signW * 0.33]) {
      B.add(metal, box(0.06, 0.06, 0.7, lx, signY + 0.85, zf + 0.5), cyl(0.05, 0.18, 0.16, lx, signY + 0.8, zf + 0.85, 10));
      B.add(M.emissive(0xffd59a, 4), cyl(0.12, 0.12, 0.02, lx, signY + 0.71, zf + 0.85, 10));
      lights.push({ x: lx, y: signY + 0.5, z: zf + 1.2, color: 0xffcf8a, intensity: 5, distance: 6, flicker: s.seed % 2 === 0 && lx < cx });
    }
    lights.push({ x: dispX, y: 1.6, z: zf + 1.6, color: 0xffa04e, intensity: 9, distance: 9 });     // spill from the lit shop
    if (s.kind === 'pharmacy') {
      const crossM = M.emissive(0x2fd36a, 2.2), crossX = x1 - 0.9, crossY = gy + 2.2;
      B.add(crossM, box(0.7, 0.22, 0.08, crossX, crossY, zf + 0.6), box(0.22, 0.7, 0.08, crossX, crossY, zf + 0.6));
      B.add(metal, box(0.05, 0.05, 0.55, crossX, crossY, zf + 0.3));
      lights.push({ x: crossX, y: crossY, z: zf + 1, color: 0x2fd36a, intensity: 3, distance: 4, flicker: true });
    }
  } else if (s.kind === 'garage') {
    const dw = s.w - 1.6;
    B.add(M.metal('#5f676c'), box(dw, 3.4, 0.12, cx, 1.75, zf + 0.08, { tile: 1.5 }));
    for (let y = 0.15; y < 3.4; y += 0.16) B.add(dark, box(dw, 0.02, 0.02, cx, y, zf + 0.15));
    B.add(M.sign(s.sign ?? 'AUTO REPAIR', '#2a2a26', '#d8b25a', 0.25), plane(Math.min(6, s.w - 1), 0.9, cx, gy - 0.1, zf + 0.06));
    lights.push({ x: x0 + 0.6, y: 3.2, z: zf + 1, color: 0xbfe4ff, intensity: 3, distance: 6, flicker: true });
    B.add(M.emissive(0xd8f0ff, 3), box(0.4, 0.08, 0.15, x0 + 0.6, 3.6, zf + 0.25));
  } else if (!ruin) {
    doorX = cx;
    B.add(dark, box(1.4, 2.6, 0.2, cx, 1.3, zf + 0.02));
    B.add(M.wood('#4a3324'), box(1.2, 2.4, 0.06, cx, 1.2, zf + 0.12));
    B.add(trim, box(2.2, 0.15, 1.0, cx, 2.85, zf + 0.5));                                   // canopy
    if (R.chance(0.5)) { B.add(M.emissive(0xffe0b0, 3), box(0.25, 0.12, 0.1, cx, 2.68, zf + 0.9)); lights.push({ x: cx, y: 2.5, z: zf + 1.4, color: 0xffd8a8, intensity: 3, distance: 5 }); }
  } else {
    B.add(dark, box(1.4, 2.4, 0.2, cx, 1.2, zf + 0.02));
  }

  // ---- weathering: rain-water stains under the cornice and every floor ledge
  for (let x = x0; x < x1 - 0.5; x += 2.2) {
    B.add(M.grime(1 + (Math.floor(x) & 3)), plane(2.2, Math.min(H, 4.5), x + 1.1, H - Math.min(H, 4.5) / 2 - 0.1, zf + 0.015));
    if (s.floors > 1 && R.chance(0.6)) B.add(M.grime(2 + (Math.floor(x) & 1)), plane(2.2, 2.2, x + 1.1, ground + 3.1 - 1.2, zf + 0.016));
  }
  // ---- street-level clutter: torn posters / flyers on the ground floor, an electrical box
  for (let i = 0; i < Math.ceil(s.w / 4); i++) {
    const px = R.range(x0 + 0.5, x1 - 0.5), pw = R.range(0.5, 0.85);
    if (doorX !== undefined && Math.abs(px - doorX) < 1.1) continue;
    B.add(M.poster(R.int(0, 8)), plane(pw, pw * 1.3, px, R.range(1.2, 2.2), zf + 0.03 + i * 0.002));
  }
  if (R.chance(0.5)) B.add(M.metal('#56605a'), box(0.55, 0.75, 0.22, x1 - 0.8, 1.5, zf + 0.12));
  // ---- overgrowth: thick ivy curtains draping from the roof line (reference silhouette), weeds at the base
  const ivyN = Math.ceil(s.w / 2.6);
  for (let i = 0; i < ivyN; i++) {
    const ix = R.range(x0 + 0.3, x1 - 0.3), len = R.range(2.5, H * 0.75), iw = R.range(1.0, 2.2);
    B.add(M.ivy(1 + (i % 4)), plane(iw, len, ix, H - len / 2 + 0.25, zf + 0.07 + i * 0.002));
  }
  for (let i = 0; i < ivyN; i++) {
    const ix = R.range(x0 + 0.3, x1 - 0.3), len = R.range(0.8, 2.6);
    B.add(M.leaves(false, 11 + (i % 2)), plane(R.range(0.8, 1.8), len, ix, len / 2, zf + 0.09 + i * 0.002));
  }

  const group = B.build();
  for (const e of extras) group.add(e);
  return { group, lights, doorX };
}

/** Relay 7: radio shack with a lattice mast, dish and blinking beacon. */
export function relay(x: number, seed = 7): Built {
  const B = new Batch(), lights: LightSpot[] = [], R = new Rng(seed);
  const zf = FACADE_Z + 0.6, conc = M.concrete('#6a6858', 5), metal = M.metal('#7a8488'), dark = M.dark();
  B.add(conc, box(5.5, 3.2, 4, x + 2.75, 1.6, zf - 2, { tile: 2 }));
  B.add(M.metal('#4d5a5c'), box(6, 0.15, 4.6, x + 2.75, 3.3, zf - 2, { rotZ: 0.04 }));
  B.add(dark, box(1.1, 2.3, 0.1, x + 1.2, 1.15, zf + 0.02));
  B.add(M.metal('#3d4a3a'), box(0.95, 2.15, 0.05, x + 1.2, 1.1, zf + 0.07));
  B.add(M.window('tv', 3), plane(1.2, 0.8, x + 3.6, 1.9, zf + 0.02));
  B.add(M.sign('RELAY 7', '#2a2f2a', '#d8b25a', 0.2), plane(1.8, 0.45, x + 3.6, 2.7, zf + 0.03));
  B.add(M.emissive(0xffd08a, 3), box(0.25, 0.1, 0.12, x + 1.2, 2.55, zf + 0.12));
  lights.push({ x: x + 1.2, y: 2.4, z: zf + 1.2, color: 0xffc77a, intensity: 4, distance: 6 });
  // lattice mast
  const mx = x + 4.6, mz = zf - 3, mh = 16;
  for (const [dx, dz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) B.add(metal, box(0.06, mh, 0.06, mx + dx, mh / 2, mz + dz));
  for (let y = 0.5; y < mh; y += 0.9) {
    B.add(metal, box(0.9, 0.04, 0.04, mx, y, mz + 0.45, { rotZ: 0.75 }), box(0.9, 0.04, 0.04, mx, y + 0.45, mz + 0.45, { rotZ: -0.75 }));
    B.add(metal, box(0.04, 0.04, 0.9, mx + 0.45, y, mz, { rotX: 0.75 }));
  }
  B.add(metal, cyl(0.02, 0.02, 3, mx, mh + 1.5, mz, 6));
  const dish = new THREE.SphereGeometry(0.8, 18, 8, 0, Math.PI * 2, 0, 0.9); dish.rotateZ(-1.2); dish.translate(mx - 0.6, mh * 0.7, mz + 0.6);
  B.add(M.paint(0xb8bcb8, 0.5), dish);
  for (let i = 0; i < 4; i++) B.add(M.leaves(false, 10 + i), plane(R.range(0.8, 1.4), R.range(1, 2.5), x + R.range(0.3, 5), 1, zf + 0.05));
  const group = B.build();
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), M.emissive(0xff2a1a, 6).clone());
  beacon.position.set(mx, mh + 3.05, mz); beacon.name = 'beacon'; group.add(beacon);
  lights.push({ x: mx, y: mh + 3, z: mz, color: 0xff3a2a, intensity: 6, distance: 8, flicker: true });
  return { group, lights, doorX: x + 1.2 };
}
