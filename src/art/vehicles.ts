import * as THREE from 'three';
import { Rng } from '../core/math';
import { Batch, M, box, cyl, plane, worldUV } from './kit';

export type VehicleKind = 'sedan' | 'hatch' | 'van' | 'bus' | 'truck';

/** Side profiles (x along length, y up), extruded across the vehicle width. */
const PROFILES: Record<VehicleKind, { len: number; width: number; body: [number, number][]; glass: [number, number][][]; wheels: number[]; r: number }> = {
  sedan: { len: 4.5, width: 1.8, r: 0.33, wheels: [0.95, 3.6],
    body: [[0, 0.3], [0, 0.85], [0.3, 0.95], [1.2, 1.0], [1.7, 1.42], [3.2, 1.42], [3.75, 1.0], [4.4, 0.95], [4.5, 0.8], [4.5, 0.3]],
    glass: [[[1.3, 1.02], [1.75, 1.36], [2.45, 1.36], [2.45, 1.02]], [[2.55, 1.02], [2.55, 1.36], [3.15, 1.36], [3.6, 1.02]]] },
  hatch: { len: 3.9, width: 1.7, r: 0.31, wheels: [0.8, 3.15],
    body: [[0, 0.3], [0, 0.85], [0.3, 0.98], [1.0, 1.02], [1.5, 1.45], [3.5, 1.48], [3.85, 1.0], [3.9, 0.3]],
    glass: [[[1.1, 1.04], [1.55, 1.4], [2.35, 1.4], [2.35, 1.04]], [[2.45, 1.04], [2.45, 1.4], [3.4, 1.42], [3.6, 1.04]]] },
  van: { len: 4.9, width: 1.95, r: 0.34, wheels: [1.0, 3.9],
    body: [[0, 0.3], [0, 0.9], [0.5, 1.15], [0.95, 1.95], [4.9, 1.98], [4.9, 0.3]],
    glass: [[[0.65, 1.2], [1.0, 1.85], [1.75, 1.85], [1.75, 1.2]], [[1.85, 1.2], [1.85, 1.85], [2.9, 1.85], [2.9, 1.2]]] },
  bus: { len: 11, width: 2.5, r: 0.48, wheels: [2.2, 8.6],
    body: [[0, 0.35], [0, 2.9], [0.2, 3.05], [11, 3.05], [11, 0.35]],
    glass: Array.from({ length: 7 }, (_, i) => [[1.4 + i * 1.35, 1.6], [1.4 + i * 1.35, 2.7], [2.6 + i * 1.35, 2.7], [2.6 + i * 1.35, 1.6]] as [number, number][]) },
  truck: { len: 8, width: 2.4, r: 0.5, wheels: [1.3, 5.3, 6.6],
    body: [[0, 0.4], [0, 1.4], [0.35, 1.55], [0.6, 2.65], [2.2, 2.75], [2.2, 0.4]],
    glass: [[[0.7, 1.7], [0.95, 2.5], [1.85, 2.55], [1.85, 1.7]]] },
};

export function vehicle(kind: VehicleKind, seed = 1): { group: THREE.Group; length: number } {
  const p = PROFILES[kind], R = new Rng(seed), B = new Batch();
  const color = kind === 'bus' ? 0x8c7a4a : R.pick([0xa89a6a, 0x7e9298, 0xa8523e, 0xd8d0b8, 0x5a7088, 0x92a06e]);
  const paint = M.paint(color, 0.45), w = p.width;
  const shape = new THREE.Shape(p.body.map(([x, y]) => new THREE.Vector2(x, y)));
  const body = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 });
  body.translate(-p.len / 2, 0, -w / 2);
  B.add(paint, worldUV(body, 1.5));
  if (kind === 'truck') {                                     // cargo box
    B.add(M.metal('#a8a296'), box(5.6, 2.6, w + 0.1, 0.9 + 2.8 - p.len / 2 + 1.4, 1.75, 0, { tile: 1.5 }));
    for (let x = 2.4; x < 7.9; x += 0.4) B.add(M.metal('#857f74'), box(0.05, 2.5, w + 0.14, x - p.len / 2, 1.75, 0));
  }
  // windows on both sides (dark glass, some smashed)
  const glass = M.carGlass(), dark = M.dark();
  for (const poly of p.glass) {
    const gs = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const side of [1, -1]) {
      const g = new THREE.ShapeGeometry(gs); g.translate(-p.len / 2, 0, (side * (w / 2 + 0.07)));
      if (side < 0) g.rotateY(0);
      B.add(R.chance(0.25) ? dark : glass, g);
    }
  }
  // wheels: tyre + hub; one flat
  for (const wx of p.wheels) for (const side of [1, -1]) {
    const flat = R.chance(0.3) ? 0.8 : 1;
    B.add(M.rubber(), cyl(p.r, p.r, 0.28, wx - p.len / 2, p.r * flat, side * (w / 2 - 0.05), 16, { rotX: Math.PI / 2 }));
    B.add(M.metal('#55595c'), cyl(p.r * 0.5, p.r * 0.5, 0.3, wx - p.len / 2, p.r * flat, side * (w / 2 - 0.04), 10, { rotX: Math.PI / 2 }));
  }
  // lights, bumper, grime streaks, moss on the roof
  B.add(M.emissive(0x3a3020, 0.2), box(0.06, 0.18, 0.4, p.len / 2 - 0.0, 0.85, w / 2 - 0.35), box(0.06, 0.18, 0.4, p.len / 2, 0.85, -w / 2 + 0.35));
  B.add(M.emissive(0x401010, 0.3), box(0.06, 0.2, 0.3, -p.len / 2, 0.9, w / 2 - 0.3), box(0.06, 0.2, 0.3, -p.len / 2, 0.9, -w / 2 + 0.3));
  B.add(M.metal('#3c4044'), box(0.15, 0.22, w + 0.1, p.len / 2 + 0.05, 0.45, 0), box(0.15, 0.22, w + 0.1, -p.len / 2 - 0.05, 0.45, 0));
  const roofY = Math.max(...p.body.map((q) => q[1]));
  for (let i = 0; i < p.len / 4; i++) B.add(M.leaves(false, 10 + (i % 2)), plane(R.range(0.4, 0.8), R.range(0.25, 0.5), R.range(-p.len / 2, p.len / 2), R.range(0.3, roofY - 0.4), w / 2 + 0.09 + i * 0.002));
  const group = B.build();
  return { group, length: p.len };
}
