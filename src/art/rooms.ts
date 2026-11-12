import * as THREE from 'three';
import { Rng } from '../core/math';
import { Batch, M, box, cyl, plane, glowSprite, type LightSpot } from './kit';
import { asset, type AssetName } from './assets';
import type { RoomKind } from '../game/levels/types';

/**
 * Rooms (art): side-on cut-away interiors — the camera looks through the missing front wall, like a
 * doll's house. Each is a floor, a back wall and a ceiling dressed along the back (the lane in front
 * stays clear for walking and fighting), lit by a few warm practical lights, and framed by black
 * masks so nothing of the outside world shows. One Batch → a handful of draw calls per room.
 * Kinds differ in shell materials and dressing; 'safehouse' is the candle-lit refuge between chapters.
 */
export interface BuiltRoom { group: THREE.Group; lights: LightSpot[]; height: number }

const BACK = -2.6, FRONT = 3.0;
const GOODS = [0x9a3a2a, 0x3a6a8a, 0xc79a3a, 0x5a7a3a, 0xd8d0c0, 0x7a4a6a];

export function buildRoom(kind: RoomKind, X: number, w: number, seed: number, outside = 0x6f8a98): BuiltRoom {
  const R = new Rng(seed), B = new Batch(), g = new THREE.Group(), lights: LightSpot[] = [];
  const H = kind === 'bus' ? 2.5 : kind === 'lab' ? 3.8 : kind === 'garage' ? 4.0 : 3.3;
  const cx = X + w / 2, cozy = kind === 'safehouse';
  const floor = kind === 'bus' ? M.metal('#3a4044') : kind === 'garage' || kind === 'gas' || kind === 'booth' ? M.concrete('#4a4c48', 8) : kind === 'lab' ? M.concrete('#59626a', 5)
    : kind === 'apartment' || kind === 'motel' || cozy ? M.wood('#5a4434') : M.paving();
  const wall = kind === 'bus' ? M.paint(0x7f8f80, 0.6) : kind === 'garage' || kind === 'gas' ? M.concrete('#5c605c', 9) : kind === 'lab' ? M.concrete('#77848a', 4) : kind === 'booth' ? M.concrete('#5a6660', 7)
    : kind === 'apartment' ? M.plaster('#7a7462', 4) : kind === 'motel' ? M.plaster('#7d6a5a', 3) : cozy ? M.plaster('#6e6252', 5) : kind === 'diner' ? M.plaster('#8a6a58', 4) : M.plaster('#868272', 5);
  const dark = M.dark(), metal = M.metal('#5a6064'), wood = M.wood('#4a3424'), woodL = M.wood('#6a5236');

  // ---- shell
  B.add(floor, box(w + 0.8, 0.3, FRONT - BACK, cx, -0.15, (FRONT + BACK) / 2, { tile: 2 }));
  B.add(M.concrete('#2a2c2a', 6), box(w + 0.8, 1.6, 0.3, cx, -1.1, FRONT - 0.15, { tile: 2 }));           // the cut edge of the slab
  B.add(wall, box(w + 0.8, H, 0.3, cx, H / 2, BACK - 0.15, { tile: 2.2 }));
  B.add(wall, box(0.4, H, FRONT - BACK, X - 0.2, H / 2, (FRONT + BACK) / 2, { tile: 2.2 }), box(0.4, H, FRONT - BACK, X + w + 0.2, H / 2, (FRONT + BACK) / 2, { tile: 2.2 }));
  B.add(cozy || kind === 'apartment' || kind === 'motel' || kind === 'diner' ? M.wood('#4a3626') : M.concrete('#5a5c58', 3), box(w + 0.8, 0.35, FRONT - BACK, cx, H + 0.17, (FRONT + BACK) / 2, { tile: 2.5 }));
  for (let bx = 1.5; bx < w; bx += 3) B.add(cozy || kind === 'apartment' || kind === 'motel' ? M.wood('#3a2a1c') : M.metal('#4a5054'), box(0.18, 0.2, FRONT - BACK, X + bx, H - 0.1, (FRONT + BACK) / 2));   // ceiling beams: depth cue
  B.add(woodL, box(w, 0.14, 0.05, cx, 0.07, BACK + 0.03));                                                   // skirting
  // black masks: hide everything outside the cut-away (unlit, no fog)
  const mask = new THREE.MeshBasicMaterial({ color: 0x030405, fog: false });
  const mk = (mw: number, mh: number, mx: number, my: number) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), mask); m.position.set(mx, my, FRONT + 0.02); g.add(m); };
  mk(60, 40, X - 0.4 - 30, 8); mk(60, 40, X + w + 0.4 + 30, 8); mk(w + 2, 30, cx, H + 0.35 + 15); mk(w + 2, 20, cx, -1.9 - 10);

  // ---- dressing helpers (dx = metres from the left wall; everything hugs the back wall)
  const lamp = (dx: number, color = 0xffd6a0, intensity = 7, flicker = false, y = H - 0.55) => {
    B.add(dark, cyl(0.01, 0.01, H - y - 0.1, X + dx, (H + y) / 2 + 0.05, -1.0, 4), cyl(0.05, 0.16, 0.14, X + dx, y + 0.02, -1.0, 10));
    B.add(M.emissive(color, 4), cyl(0.07, 0.07, 0.06, X + dx, y - 0.07, -1.0, 8));
    const s = glowSprite(1.1, color, 0.32); s.position.set(X + dx, y - 0.1, -0.9); g.add(s);
    lights.push({ x: X + dx, y: y - 0.3, z: -0.3, color, intensity, distance: 8.5, flicker });
  };
  const tube = (dx: number, len: number, color = 0xd8f0ff, intensity = 6, flicker = false) => {
    B.add(M.emissive(color, 3.5), box(len, 0.05, 0.14, X + dx, H - 0.08, -1.2)); lights.push({ x: X + dx, y: H - 0.5, z: -0.6, color, intensity, distance: 9, flicker });
  };
  const candle = (dx: number, y: number, z = -1.9, light = true) => {
    const hgt = R.range(0.1, 0.24);
    B.add(M.paint(0xe8dcc0, 0.8), cyl(0.028, 0.032, hgt, X + dx, y + hgt / 2, z, 6)); B.add(M.emissive(0xffc060, 6), cyl(0.0, 0.016, 0.05, X + dx, y + hgt + 0.03, z, 5));
    const s = glowSprite(0.3, 0xffb050, 0.4); s.position.set(X + dx, y + hgt + 0.04, z + 0.05); g.add(s); s.name = 'flame';
    if (light) lights.push({ x: X + dx, y: y + hgt + 0.25, z: z + 0.6, color: 0xff9a48, intensity: 3.2, distance: 5, flicker: false });
  };
  const windowAt = (dx: number, ww: number, wh: number, y: number, broken = false) => {
    B.add(M.emissive(outside, 0.5), plane(ww, wh, X + dx, y, BACK + 0.02));
    B.add(woodL, box(ww + 0.16, 0.08, 0.1, X + dx, y + wh / 2, BACK + 0.05), box(ww + 0.16, 0.1, 0.16, X + dx, y - wh / 2, BACK + 0.07), box(0.08, wh, 0.1, X + dx - ww / 2, y, BACK + 0.05), box(0.08, wh, 0.1, X + dx + ww / 2, y, BACK + 0.05));
    if (!broken) B.add(woodL, box(0.05, wh, 0.05, X + dx, y, BACK + 0.05), box(ww, 0.05, 0.05, X + dx, y, BACK + 0.05));
    lights.push({ x: X + dx, y, z: -1.4, color: outside, intensity: 3.5, distance: 6 });
  };
  const curtain = (dx: number, wh: number, y: number, color = 0xd8d2c0) => B.add(M.cloth(color), box(0.5, wh + 0.3, 0.04, X + dx, y, BACK + 0.12, { rotZ: R.range(-0.05, 0.05) }));
  const shelf = (dx: number, len: number, h = 1.9, stock = 0.6, mat: THREE.Material = metal) => {
    B.add(mat, box(len, 0.06, 0.45, X + dx, h, -2.2), box(0.06, h, 0.45, X + dx - len / 2, h / 2, -2.2), box(0.06, h, 0.45, X + dx + len / 2, h / 2, -2.2));
    for (let y = 0.25; y < h - 0.2; y += 0.42) {
      B.add(mat, box(len, 0.04, 0.45, X + dx, y, -2.2));
      for (let k = -len / 2 + 0.14; k < len / 2 - 0.1; k += 0.2) if (R.chance(stock)) { const bh = R.range(0.14, 0.3); B.add(M.paint(R.pick(GOODS), 0.6), box(0.15, bh, 0.2, X + dx + k, y + 0.02 + bh / 2, -2.12)); }
    }
  };
  const books = (dx: number, len: number, h = 2.0) => {
    B.add(wood, box(len, h, 0.36, X + dx, h / 2, -2.38));
    for (let y = 0.12; y < h - 0.3; y += 0.38) for (let k = -len / 2 + 0.08; k < len / 2 - 0.08;) { const bw = R.range(0.04, 0.09), bh = R.range(0.2, 0.3); if (R.chance(0.85)) B.add(M.paint(R.pick([0x6a3a2a, 0x2a4a5a, 0x7a6a3a, 0x3a4a3a, 0x8a8070, 0x4a2a3a]), 0.8), box(bw, bh, 0.2, X + dx + k + bw / 2, y + bh / 2, -2.16)); k += bw + 0.008; }
  };
  const counter = (dx: number, len: number, mat: THREE.Material = wood, h = 1.0) => { B.add(mat, box(len, h, 0.7, X + dx, h / 2, -2.0)); B.add(woodL, box(len + 0.08, 0.06, 0.78, X + dx, h + 0.03, -2.0)); };
  const table = (dx: number, tw: number, h = 0.74, z = -1.9) => { B.add(woodL, box(tw, 0.06, 0.7, X + dx, h, z)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add(wood, box(0.06, h, 0.06, X + dx + sx * (tw / 2 - 0.06), h / 2, z + sz * 0.28)); };
  const bed = (dx: number, color: number, quilt = false) => {
    B.add(wood, box(2.1, 0.3, 1.0, X + dx, 0.2, -2.0), box(0.08, 0.9, 1.0, X + dx + 1.05, 0.45, -2.0)); B.add(M.cloth(0xcfc8b8), box(2.0, 0.16, 0.94, X + dx, 0.42, -2.0), box(0.5, 0.14, 0.6, X + dx + 0.7, 0.56, -2.0));
    B.add(M.cloth(color), box(1.35, 0.14, 0.98, X + dx - 0.3, 0.54, -2.0, { rotZ: 0.03 }));
    if (quilt) for (let k = 0; k < 6; k++) B.add(M.cloth(R.pick([0x8a4a32, 0x6a7a5a, 0xb08a5a, 0x5a4a6a, 0x9a6a4a])), box(0.42, 0.05, 0.46, X + dx - 0.75 + (k % 3) * 0.45, 0.63, -2.24 + Math.floor(k / 3) * 0.48));
  };
  const couch = (dx: number, color: number) => B.add(M.cloth(color), box(2.2, 0.45, 0.85, X + dx, 0.25, -2.05), box(2.2, 0.6, 0.22, X + dx, 0.7, -2.4), box(0.22, 0.6, 0.85, X + dx - 1.1, 0.5, -2.05), box(0.22, 0.6, 0.85, X + dx + 1.1, 0.5, -2.05));
  const fridge = (dx: number) => { B.add(M.paint(0xc8ccc8, 0.4), box(0.8, 1.85, 0.7, X + dx, 0.93, -2.1)); B.add(metal, box(0.04, 0.5, 0.04, X + dx - 0.3, 1.2, -1.74)); };
  const lockers = (dx: number, n: number, color = 0x4a5a62) => { for (let k = 0; k < n; k++) { B.add(M.paint(color, 0.5), box(0.5, 1.9, 0.45, X + dx + k * 0.52, 0.95, -2.25)); B.add(dark, box(0.3, 0.03, 0.02, X + dx + k * 0.52, 1.6, -2.02)); } };
  const rug = (dx: number, rw: number, color: number, z = -0.3, d = 2.2) => { B.add(M.cloth(color), box(rw, 0.02, d, X + dx, 0.012, z)); B.add(M.cloth(0x2a1c18), box(rw - 0.4, 0.022, d - 0.4, X + dx, 0.014, z)); B.add(M.cloth(color), box(rw - 0.7, 0.024, d - 0.7, X + dx, 0.016, z)); };
  const plant = (dx: number, size = 1, hang = 0) => {
    const y = hang || 0;
    if (!hang) B.add(M.paint(0x8a5a3a, 0.9), cyl(0.16 * size, 0.12 * size, 0.28 * size, X + dx, 0.14 * size, -2.1, 8));
    else B.add(dark, cyl(0.006, 0.006, H - hang, X + dx, (H + hang) / 2, -1.9, 3)), B.add(M.paint(0x8a5a3a, 0.9), cyl(0.13, 0.09, 0.18, X + dx, hang, -1.9, 8));
    for (let k = 0; k < 5; k++) B.add(M.leaves(k % 2 === 0, 9 + (k % 3)), plane(R.range(0.5, 0.9) * size, R.range(0.5, 1.0) * size, X + dx + R.range(-0.15, 0.15), y + (hang ? -0.15 : 0.55 * size) + R.range(-0.1, 0.2), (hang ? -1.9 : -2.1) + k * 0.03, R.range(-0.5, 0.5)));
  };
  const ivy = (dx: number, iw: number, ih: number, y: number) => B.add(M.ivy(1 + (Math.round(dx) % 3)), plane(iw, ih, X + dx, y, BACK + 0.04));
  const poster = (dx: number, y = 1.9) => B.add(M.poster(1 + R.int(0, 4)), plane(0.7, 0.95, X + dx, y, BACK + 0.03));
  const prop = (n: AssetName, dx: number, z = -1.9, ry = 0, fit?: number) => { const a = asset(n, fit); if (a) { a.position.set(X + dx, 0, z); a.rotation.y = ry; g.add(a); } };
  const stool = (dx: number, z = -1.3) => { B.add(M.paint(0x8a2a24, 0.5), cyl(0.2, 0.2, 0.06, X + dx, 0.62, z, 10)); B.add(metal, cyl(0.03, 0.03, 0.6, X + dx, 0.3, z, 6)); };
  const door = (dx: number, exit = true) => {
    B.add(wood, box(1.05, 2.15, 0.08, X + dx, 1.07, BACK + 0.05)); B.add(woodL, box(1.2, 0.1, 0.12, X + dx, 2.2, BACK + 0.06), box(0.08, 2.2, 0.12, X + dx - 0.57, 1.1, BACK + 0.06), box(0.08, 2.2, 0.12, X + dx + 0.57, 1.1, BACK + 0.06));
    B.add(metal, box(0.05, 0.14, 0.05, X + dx + 0.38, 1.05, BACK + 0.11));
    if (exit) B.add(M.sign('EXIT', '#0f2a1a', '#6fe08a', 1.4), plane(0.5, 0.2, X + dx, 2.42, BACK + 0.04));
  };
  const stain = (dx: number) => B.add(M.grime(1 + R.int(0, 2)), plane(R.range(1.2, 2.4), R.range(1, 2), X + dx, R.range(1, 2.4), BACK + 0.025));

  // ---- per kind
  const exit = kind !== 'safehouse';
  if (exit) door(1.0);
  for (let dx = 3; dx < w - 1; dx += R.range(3.5, 6)) if (!cozy && kind !== 'bus') stain(dx);
  if (kind === 'store' || kind === 'gas') {
    for (let dx = 3.2; dx < w - 4.5; dx += 3.2) shelf(dx, 2.6, 1.9, kind === 'gas' ? 0.35 : 0.55);
    counter(w - 2.6, 2.6); B.add(dark, box(0.45, 0.32, 0.4, X + w - 3.2, 1.22, -2.0));
    B.add(M.window('shop', 3), plane(1.6, 1.5, X + w - 5.2 + 0.0, 1.25, BACK + 0.03));
    tube(w * 0.3, 1.4, 0xffe2b8, 6, true); lamp(w - 2.6, 0xffc890, 6);
    poster(2.2); if (kind === 'gas') { prop('jerrycan', 2.4, -1.6, 0.4); prop('tyre', w - 0.9, -1.6); prop('barrel', w * 0.5, -2.0, 0, 0.9); }
  } else if (kind === 'pharmacy') {
    shelf(3.2, 2.4, 2.1, 0.5); shelf(6.0, 2.4, 2.1, 0.4); counter(w - 4.2, 3.2, M.paint(0xc8d0cc, 0.5));
    B.add(M.emissive(0x2fd36a, 2.2), box(0.5, 0.16, 0.04, X + w - 4.2, 2.6, BACK + 0.04), box(0.16, 0.5, 0.04, X + w - 4.2, 2.6, BACK + 0.04));
    lockers(w - 1.9, 2, 0xc8ccc8); tube(4.5, 1.4, 0xe0f4ff, 5, true); tube(w - 4, 1.4, 0xe0f4ff, 6); lights.push({ x: X + w - 4.2, y: 2.4, z: -1.6, color: 0x2fd36a, intensity: 3, distance: 5 });
  } else if (kind === 'apartment' || kind === 'motel') {
    windowAt(4.2, 1.5, 1.4, 1.75, R.chance(0.5)); curtain(3.3, 1.4, 1.75, 0x9a8a78); curtain(5.1, 1.4, 1.75, 0x9a8a78);
    couch(4.2, kind === 'motel' ? 0x6a3a3a : 0x5a5a48); table(6.6, 1.0, 0.45, -1.7); rug(5.2, 3.2, 0x6a3a32);
    bed(w - 3.4, kind === 'motel' ? 0x7a4a3a : 0x4a5a6a); books(w - 6.2, 1.3, 1.9); fridge(w - 0.9);
    lamp(5.5, 0xffc080, 5.5, R.chance(0.4)); lamp(w - 3.4, 0xffb070, 4); poster(7.6); plant(2.3, 0.9); B.add(M.window('tv', 2), plane(0.9, 0.6, X + 7.9, 1.2, BACK + 0.03));
  } else if (kind === 'garage') {
    B.add(M.paint(0x6a2a24, 0.5), box(4.2, 1.1, 1.7, X + 5.2, 1.5, -1.8)); B.add(M.carGlass(), box(2.2, 0.6, 1.5, X + 5.0, 2.3, -1.8));     // car on the lift
    B.add(metal, box(0.2, 2.2, 0.3, X + 3.0, 1.1, -1.8), box(0.2, 2.2, 0.3, X + 7.4, 1.1, -1.8), box(4.6, 0.12, 1.2, X + 5.2, 0.9, -1.8));
    for (const dx of [3.9, 6.5]) B.add(M.rubber(), cyl(0.34, 0.34, 0.24, X + dx, 1.05, -0.95, 14, { rotX: Math.PI / 2 }));
    counter(w - 3.2, 3.2); B.add(woodL, box(3.2, 1.1, 0.04, X + w - 3.2, 1.85, BACK + 0.04));
    for (let i = 0; i < 8; i++) B.add(M.metal('#3a3f42'), box(0.04, 0.25 + (i % 3) * 0.1, 0.03, X + w - 4.5 + i * 0.36, 1.9, BACK + 0.08, { rotZ: i % 2 ? 0.25 : -0.15 }));
    prop('generator', w - 0.9, -1.8, -0.5); prop('tyre', 2.2, -2.0); prop('barrel', 8.6, -2.0, 0, 0.9); prop('jerrycan', w - 5.4, -1.5, 0.6);
    lamp(5.2, 0xffd9a0, 8, false, 3.2); lamp(w - 3.2, 0xffe2b0, 6, true, 2.6);
  } else if (kind === 'bus') {
    for (let dx = 2.2; dx < w - 1; dx += 1.15) { B.add(M.cloth(0x3a4a6a), box(0.5, 0.45, 0.8, X + dx, 0.45, -1.9), box(0.1, 0.75, 0.8, X + dx - 0.22, 0.95, -1.9)); B.add(metal, box(0.06, 0.25, 0.06, X + dx, 0.12, -1.9)); }
    for (let dx = 1.6; dx < w - 0.6; dx += 1.9) B.add(M.emissive(outside, 0.8), plane(1.5, 0.75, X + dx, 1.65, BACK + 0.03));
    B.add(metal, box(w - 1, 0.04, 0.04, cx, 2.1, -1.2)); B.add(M.paint(0xc8b23a, 0.5), cyl(0.02, 0.02, 2.2, X + 3.5, 1.2, -1.1, 6), cyl(0.02, 0.02, 2.2, X + 7.5, 1.2, -1.1, 6));
    tube(3, 1, 0xdff0ff, 4, true); tube(w - 3, 1, 0xdff0ff, 3);
  } else if (kind === 'diner') {
    counter(5.5, 6, M.paint(0x8a2a24, 0.45), 1.05); for (let dx = 3; dx <= 8; dx += 1.0) stool(dx);
    B.add(M.window('shop', 5), plane(5.6, 1.1, X + 5.5, 2.0, BACK + 0.03)); B.add(M.sign('COFFEE  PIE  EGGS', '#1d1a16', '#e9c46a', 0.9), plane(3.4, 0.4, X + 5.5, 2.85, BACK + 0.04));
    for (const dx of [w - 5.5, w - 2.6]) { B.add(M.cloth(0x7a2a24), box(0.25, 1.1, 1.0, X + dx - 0.8, 0.55, -2.0), box(0.25, 1.1, 1.0, X + dx + 0.8, 0.55, -2.0)); table(dx, 1.0, 0.75, -2.0); }
    windowAt(w - 4.0, 2.4, 1.2, 1.9, true); lamp(4, 0xffc890, 6, true); lamp(w - 4, 0xffb070, 5); fridge(9.4);
  } else if (kind === 'booth') {
    lockers(2.6, 3, 0x4a5a48); table(6.2, 1.8); B.add(M.window('tv', 4), plane(0.7, 0.5, X + 6.2, 1.15, -2.1)); B.add(dark, box(0.5, 0.35, 0.3, X + 6.8, 0.95, -2.0));
    windowAt(w - 2.6, 1.8, 1.0, 1.85); prop('military_crate', w - 3.4, -1.9, 0.2); prop('military_crate', w - 2.2, -2.0, -0.3); poster(4.6);
    tube(w / 2, 1.4, 0xff4030, 5, true); lights.push({ x: X + 6.2, y: 1.4, z: -1.4, color: 0x7fd8ff, intensity: 2.5, distance: 4, flicker: true });
  } else if (kind === 'lab') {
    for (let dx = 4; dx < w - 3; dx += 9.5) {
      counter(dx + 1.5, 3.4, M.paint(0xcfd6d8, 0.35), 0.95);
      for (let k = 0; k < 5; k++) B.add(M.glass(), cyl(0.05, 0.07, R.range(0.15, 0.32), X + dx + 0.2 + k * 0.55, 1.12, -2.0, 8));
      B.add(M.window('tv', 1 + (Math.round(dx) % 4)), plane(0.8, 0.5, X + dx + 2.9, 1.3, -2.25));
      // specimen tank
      B.add(M.metal('#3c4448'), cyl(0.55, 0.6, 0.3, X + dx + 5.4, 0.15, -1.9, 16), cyl(0.6, 0.55, 0.25, X + dx + 5.4, 2.75, -1.9, 16));
      B.add(M.emissive(0x3fe0a0, 0.55), cyl(0.42, 0.42, 2.3, X + dx + 5.4, 1.45, -1.9, 16)); B.add(M.glass(), cyl(0.52, 0.52, 2.3, X + dx + 5.4, 1.45, -1.9, 16));
      lights.push({ x: X + dx + 5.4, y: 1.5, z: -0.9, color: 0x3fe0a0, intensity: 4, distance: 6 });
      lockers(dx + 7.0, 2, 0x8a9498); tube(dx + 2, 1.6, 0xd4f2ff, 6, R.chance(0.5));
      B.add(M.paint(0xc8b23a, 0.5), box(1.2, 0.08, 0.02, X + dx - 1, 0.012, 0.9));
    }
    for (let dx = 2; dx < w; dx += 6) B.add(metal, cyl(0.07, 0.07, 6, X + dx + 3, H - 0.35, -2.2, 8, { rotZ: Math.PI / 2 }));
    door(w - 1.2, false); B.add(M.sign('BROADCAST', '#102028', '#7fe0f0', 1.5), plane(1.0, 0.24, X + w - 1.2, 2.45, BACK + 0.04));
  } else {                                                                        // safehouse
    windowAt(w / 2, 3.2, 2.0, 1.75, true); curtain(w / 2 - 1.75, 2.1, 1.75, 0xe8e2d0); curtain(w / 2 + 1.75, 2.1, 1.75, 0xe8e2d0); curtain(w / 2 - 1.3, 2.0, 1.8, 0xd8d0bc);
    ivy(w / 2 - 1.6, 1.4, 2.6, 2.0); ivy(w / 2 + 1.9, 1.2, 2.2, 2.2); ivy(1.4, 1.6, 2.4, 2.1);
    books(2.2, 1.6, 2.2); books(w - 1.6, 1.8, 2.4); bed(w - 4.4, 0x8a5a3a, true); rug(w / 2, 5.2, 0x7a3a2a); rug(w - 4.4, 2.6, 0x4a4a3a, -0.6, 1.4);
    table(4.6, 1.6, 0.74); for (const d of [-0.5, -0.2, 0.15, 0.5]) candle(4.6 + d, 0.77, -1.9, d === -0.2);
    B.add(M.cloth(0x7a4a32), plane(1.1, 1.6, X + 3.6, 2.0, BACK + 0.03));                                    // tapestry
    for (const d of [0.7, 1.0, 1.3]) candle(w / 2 + 2.8 + d * 0.5, 0.0, -2.0, d === 1.0);
    for (const d of [-0.25, 0.1, 0.4]) candle(w - 6.4 + d, 0.52, -2.1, d === 0.1);
    B.add(woodL, box(0.9, 0.5, 0.5, X + w - 6.4, 0.25, -2.1));                                               // crate bedside
    lamp(2.4, 0xffb060, 4.5, false, 2.4); lamp(w - 2.2, 0xffb060, 4, false, 2.5);
    plant(6.4, 1.2); plant(w - 7.4, 0.9); plant(w / 2 - 2.6, 1, 2.5); plant(w / 2 + 2.9, 1, 2.6); plant(8.2, 1, 2.75);
    for (let k = 0; k < 5; k++) B.add(M.leaves(true, 10), plane(0.16, 0.5, X + w - 8.4 + k * 0.28, 2.35, BACK + 0.08));   // drying herbs
    B.add(dark, cyl(0.006, 0.006, 1.6, X + w - 7.85, 2.62, BACK + 0.08, 3, { rotZ: Math.PI / 2 }));
    B.add(M.cloth(0x8a7a5a), box(0.8, 0.14, 0.6, X + 7.4, 0.07, -0.9, { rotY: 0.3 }));                      // floor cushion
    for (let k = 0; k < 4; k++) B.add(M.paint(R.pick([0x6a3a2a, 0x2a4a5a, 0x7a6a3a]), 0.8), box(0.3, 0.05, 0.22, X + 9.3, 0.03 + k * 0.05, -1.6, { rotY: R.range(-0.3, 0.3) }));
  }
  g.add(B.build({ castShadow: true, receiveShadow: true }));
  return { group: g, lights, height: H };
}
