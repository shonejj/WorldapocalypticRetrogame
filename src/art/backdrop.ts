import * as THREE from 'three';
import { Rng } from '../core/math';
import { Batch, M, box, cyl, glowSprite, plane } from './kit';
import * as TX from './textures';

/**
 * Far depth layers (art pass 2, from the reference composition): the street is seen through
 * gaps between buildings into a hazy night city. Each layer sits at a fixed depth so the
 * perspective camera produces real parallax; FogExp2 supplies atmospheric perspective.
 *   z ≈ −9…−20  lots behind the fences (containers, sheds, overgrowth)
 *   z ≈ −32     elevated rail viaduct with a stalled, lit commuter train
 *   z ≈ −58     industrial belt: tanks, chimneys, gantries, the radio mast with red beacons
 *   z ≈ −220    cloud bank lit from below by the dead city
 * Everything is merged per material (Batch); beacons are sprites, not pool lights.
 */
export interface Backdrop { group: THREE.Group; blinkers: THREE.Sprite[] }

export function backdrop(x0: number, x1: number, seed = 21): Backdrop {
  const R = new Rng(seed), g = new THREE.Group(), blinkers: THREE.Sprite[] = [];
  g.add(backGround(x0, x1));
  g.add(lots(x0, x1, R));
  const v = viaduct(x0, x1, -32, R); g.add(v);
  const ind = industry(x0, x1, -58, R); g.add(ind.group); blinkers.push(...ind.blinkers);
  g.add(cloudBank(x0, x1));
  return { group: g, blinkers };
}

/** Rough ground running back to the horizon (fog swallows the far edge). */
function backGround(x0: number, x1: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(x1 - x0 + 200, 90).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, -0.02, -52);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1a1f1e, roughness: 0.95 }));
  m.receiveShadow = true; return m;
}

/** Vacant lots: shipping containers, a shed, rubble, scrub — mid-depth parallax. */
function lots(x0: number, x1: number, R: Rng): THREE.Group {
  const B = new Batch();
  const cont = [M.paint(0x6a3a2a, 0.7), M.paint(0x3a5a5e, 0.7), M.paint(0x8a7a4a, 0.7)];
  for (let x = x0; x < x1; x += R.range(9, 16)) {
    const z = R.range(-11, -18), c = R.pick(cont), l = R.range(5, 6.1);
    B.add(c, box(l, 2.6, 2.4, x, 1.3, z, { tile: 2 }));
    if (R.chance(0.35)) B.add(R.pick(cont), box(l, 2.6, 2.4, x + R.range(-0.8, 0.8), 3.9, z + R.range(-0.2, 0.2), { tile: 2 }));
    for (let r = -l / 2 + 0.2; r < l / 2; r += 0.3) B.add(M.dark(), box(0.05, 2.4, 0.04, x + r, 1.3, z + 1.22));
  }
  for (let x = x0; x < x1; x += R.range(4, 9)) B.add(M.leaves(true, 10 + R.int(0, 2)), plane(R.range(2, 4.5), R.range(1.2, 2.6), x, 0.7, R.range(-8, -20)));
  return B.build({ castShadow: false });
}

/** Elevated rail line: deck on piers with a stalled train whose windows still glow. */
function viaduct(x0: number, x1: number, z: number, R: Rng): THREE.Group {
  const B = new Batch(), conc = M.concrete('#4e5556', 7), metal = M.metal('#3c4448');
  const a = x0 - 60, b = x1 + 60, w = b - a, cx = (a + b) / 2, deckY = 10;
  B.add(conc, box(w, 1.4, 7, cx, deckY, z, { tile: 4 }), box(w, 1.1, 0.3, cx, deckY + 1.2, z + 3.4, { tile: 4 }));
  for (let x = a; x < b; x += 16) {
    B.add(conc, box(1.8, deckY - 0.7, 2.6, x, (deckY - 0.7) / 2, z, { tile: 4 }), box(4.5, 1, 6, x, deckY - 1.1, z, { tile: 4 }));
  }
  for (let x = a; x < b; x += 24) B.add(metal, cyl(0.08, 0.1, 6, x, deckY + 3.6, z + 2.6, 6), box(0.08, 0.08, 3, x, deckY + 6.4, z + 1.5));
  B.add(M.dark(), box(w, 0.04, 0.04, cx, deckY + 6.1, z + 1.2));
  // train: two consists with lit windows
  const body = M.paint(0x5a6468, 0.5), winLit = M.emissive(0xffc979, 2.2), winDark = M.dark();
  for (const start of [x0 + R.range(10, 30), x0 + (x1 - x0) * 0.55 + R.range(0, 20)]) {
    for (let c = 0; c < 6; c++) {
      const cxx = start + c * 13.4, ty = deckY + 2.6;
      B.add(body, box(13, 3.1, 3, cxx, ty, z + 0.6, { tile: 3 }), box(13, 0.25, 3.1, cxx, ty + 1.65, z + 0.6));
      for (let k = -5.5; k <= 5.5; k += 1.4) B.add(R.chance(0.6) ? winLit : winDark, plane(0.9, 0.85, cxx + k, ty + 0.4, z + 2.12));
      B.add(M.dark(), box(0.3, 2.6, 3.05, cxx + 6.6, ty, z + 0.6));
    }
  }
  return B.build({ castShadow: false });
}

/** Industrial silhouettes with sparse sodium lights and red aviation beacons. */
function industry(x0: number, x1: number, z: number, R: Rng): { group: THREE.Group; blinkers: THREE.Sprite[] } {
  const B = new Batch(), sil = M.silhouette(0x141c22), sil2 = M.silhouette(0x10171c), lamp = M.emissive(0xffb466, 3);
  const blinkers: THREE.Sprite[] = [];
  for (let x = x0 - 50; x < x1 + 50; x += R.range(9, 20)) {
    const kind = R.int(0, 4), zz = z - R.range(0, 14);
    if (kind === 0) { const r = R.range(3, 6), h = R.range(6, 12); B.add(sil, cyl(r, r, h, x, h / 2, zz, 16), cyl(r * 0.3, r, 1.2, x, h + 0.6, zz, 16)); }
    else if (kind === 1) { const h = R.range(22, 36); B.add(sil2, cyl(0.9, 1.4, h, x, h / 2, zz, 10)); }
    else if (kind === 2) { const h = R.range(14, 22), w = R.range(10, 18); B.add(sil, box(w, h, 8, x, h / 2, zz)); for (let i = 0; i < 3; i++) B.add(lamp, plane(0.5, 0.3, x + R.range(-w / 2, w / 2), R.range(3, h - 1), zz + 4.05)); }
    else if (kind === 3) {   // gantry / pipe rack
      const h = R.range(9, 14); for (const dx of [-5, 0, 5]) B.add(sil2, box(0.5, h, 0.5, x + dx, h / 2, zz)); B.add(sil2, box(11, 0.6, 1.4, x, h, zz), box(11, 0.4, 0.4, x, h - 2.5, zz + 0.4));
    } else {                 // lattice mast with beacons
      const h = R.range(30, 46);
      for (const dx of [-0.8, 0.8]) B.add(sil2, box(0.2, h, 0.2, x + dx * (1 - 0.0), h / 2, zz));
      for (let y = 1; y < h; y += 2.2) B.add(sil2, box(1.8, 0.12, 0.12, x, y, zz, { rotZ: (y % 4.4 < 2.2 ? 0.8 : -0.8) }));
      for (const fy of [h, h * 0.62]) { const s = glowSprite(fy === h ? 2.6 : 1.8, 0xff2a1a, 0.95); s.position.set(x, fy, zz + 0.3); blinkers.push(s); }
    }
  }
  const group = B.build({ castShadow: false });
  for (const s of blinkers) group.add(s);
  return { group, blinkers };
}

function cloudBank(x0: number, x1: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const t = TX.clouds(5 + i); t.wrapS = THREE.RepeatWrapping; t.repeat.set(Math.ceil((x1 - x0 + 600) / 500), 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 600, 150), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false, opacity: 0.9 - i * 0.3 }));
    m.position.set((x0 + x1) / 2, 70 + i * 40, -230 - i * 30); g.add(m);
  }
  return g;
}

/**
 * Near foreground (z ≈ 6.8–8.3, 2–3 m from the lens): dark silhouettes that sweep past fastest —
 * the strongest parallax cue. Sparse, at the screen edges (bottom plants, top cables, a few posts)
 * so they frame the action without hiding it.
 */
export function foreground(x0: number, x1: number, seed = 31): THREE.Group {
  const R = new Rng(seed), B = new Batch(), sil = M.silhouette(0x07090b), leaf = M.leaves(true, 10);
  for (let x = x0 - 10; x < x1 + 10; x += R.range(5, 12)) {         // plant clumps rising from the bottom edge
    const z = R.range(6.8, 7.8), n = R.int(3, 6);
    for (let k = 0; k < n; k++) {
      const g = new THREE.PlaneGeometry(R.range(0.7, 1.4), R.range(0.9, 1.6)); g.rotateY(R.range(-0.6, 0.6)); g.rotateZ(R.range(-0.25, 0.25));
      g.translate(x + R.range(-0.8, 0.8), R.range(0.0, 0.35), z + R.range(-0.2, 0.2)); B.add(leaf, g);
    }
  }
  for (let x = x0 + R.range(4, 10); x < x1 + 10; x += R.range(22, 34)) {   // posts / broken sign poles
    B.add(sil, box(0.12, 6, 0.12, x, 2.5, 8.2, { rotZ: R.range(-0.05, 0.05) }));
    if (R.chance(0.5)) B.add(sil, box(0.7, 0.45, 0.04, x + 0.2, R.range(1.9, 2.6), 8.15, { rotZ: R.range(-0.3, 0.3) }));
  }
  for (let x = x0 - 10; x < x1 + 10; x += 18) {                         // sagging cables across the top
    const pts: THREE.Vector3[] = []; const sag = R.range(0.25, 0.5);
    for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(new THREE.Vector3(x + t * 18, 2.75 - Math.sin(t * Math.PI) * sag, 8)); }
    B.add(sil, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.012, 4));
  }
  return B.build({ castShadow: false, receiveShadow: false });
}
