import * as THREE from 'three';
import { Rng } from '../core/math';
import { Batch, M, box, cyl, glowSprite, plane } from './kit';

/** Prop family. Each returns a mesh group with its origin at the base centre, plus a
 *  collision proxy (half extents) for the physics world. */
export type PropKind = 'barrel' | 'crate' | 'barrier' | 'dumpster' | 'cone' | 'tires' | 'trashbag' | 'bottle';
export interface Prop { group: THREE.Group; half: [number, number]; dynamic: boolean; material: 'metal' | 'wood' | 'concrete' | 'plastic' | 'glass' }

export function prop(kind: PropKind, seed = 1): Prop {
  const B = new Batch(), R = new Rng(seed);
  switch (kind) {
    case 'barrel': {
      const paint = R.pick([0x7a3d22, 0x3f5a6a, 0x5a5f3c, 0x8a6a22]);
      B.add(M.paint(paint, 0.6), cyl(0.29, 0.29, 0.88, 0, 0.44, 0, 16, { tile: 1 }));
      for (const y of [0.06, 0.3, 0.58, 0.84]) B.add(M.metal('#4a4f52'), cyl(0.3, 0.3, 0.04, 0, y, 0, 16));
      if (R.chance(0.5)) B.add(M.emissive(0xd4a017, 0.1), box(0.25, 0.18, 0.02, 0, 0.45, 0.29));
      return { group: B.build(), half: [0.29, 0.44], dynamic: true, material: 'metal' };
    }
    case 'crate': {
      const wd = M.wood('#6e4c30'), s = R.range(0.75, 0.9);
      B.add(wd, box(s, s * 0.85, s, 0, s * 0.425, 0, { tile: 1 }));
      const dk = M.wood('#4a321f');
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add(dk, box(0.07, s * 0.85, 0.07, (sx * s) / 2, s * 0.425, (sz * s) / 2));
      B.add(dk, box(s * 1.2, 0.07, 0.04, 0, s * 0.425, s / 2 + 0.02, { rotZ: 0.75 }));
      return { group: B.build(), half: [s / 2, s * 0.425], dynamic: true, material: 'wood' };
    }
    case 'barrier': {
      const shape = new THREE.Shape([new THREE.Vector2(-0.3, 0), new THREE.Vector2(0.3, 0), new THREE.Vector2(0.1, 0.3), new THREE.Vector2(0.08, 0.8), new THREE.Vector2(-0.08, 0.8), new THREE.Vector2(-0.1, 0.3)]);
      const g = new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false }); g.rotateY(Math.PI / 2); g.translate(-1, 0, 0);
      B.add(M.concrete('#a8a59a', 6), g);
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32; const c = cv.getContext('2d')!;
      for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#d8d4c4' : '#b2342a'; c.beginPath(); c.moveTo(i * 20 - 20, 32); c.lineTo(i * 20, 32); c.lineTo(i * 20 + 20, 0); c.lineTo(i * 20, 0); c.fill(); }
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 0.22).translate(0, 0.56, 0.11), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }));
      const grp = B.build(); grp.add(stripe);
      return { group: grp, half: [1, 0.4], dynamic: false, material: 'concrete' };
    }
    case 'dumpster': {
      const g = M.paint(0x2d5a3a, 0.7);
      B.add(g, box(2, 1.2, 1.2, 0, 0.75, 0, { tile: 1.5 }), box(2.1, 0.08, 1.3, 0, 1.4, -0.05, { rotX: -0.12 }));
      for (const dx of [-0.8, 0.8]) B.add(M.rubber(), cyl(0.1, 0.1, 0.08, dx, 0.1, 0.5, 10, { rotX: Math.PI / 2 }));
      B.add(M.cloth(0x141618), new THREE.SphereGeometry(0.35, 8, 6).scale(1, 0.6, 1).translate(0.4, 1.4, 0.1));
      return { group: B.build(), half: [1, 0.7], dynamic: false, material: 'metal' };
    }
    case 'cone': {
      B.add(M.paint(0xd4602a, 0.6), cyl(0.03, 0.17, 0.6, 0, 0.36, 0, 12), box(0.42, 0.05, 0.42, 0, 0.03, 0));
      B.add(M.paint(0xdddddd, 0.6), cyl(0.09, 0.11, 0.08, 0, 0.45, 0, 12));
      return { group: B.build(), half: [0.18, 0.32], dynamic: true, material: 'plastic' };
    }
    case 'tires': {
      for (let i = 0; i < 3; i++) B.add(M.rubber(), new THREE.TorusGeometry(0.3, 0.12, 8, 16).rotateX(Math.PI / 2).translate(R.range(-0.05, 0.05), 0.12 + i * 0.24, 0));
      return { group: B.build(), half: [0.42, 0.36], dynamic: false, material: 'plastic' };
    }
    case 'trashbag': {
      for (let i = 0; i < 3; i++) B.add(M.cloth(0x121416), new THREE.SphereGeometry(0.32, 9, 7).scale(1, 0.75, 0.9).translate(i * 0.45 - 0.45, 0.22, R.range(-0.1, 0.1)));
      return { group: B.build(), half: [0.7, 0.25], dynamic: false, material: 'plastic' };
    }
    case 'bottle': {
      const glass = new THREE.MeshPhysicalMaterial({ color: 0x3f6a3a, roughness: 0.1, transmission: 0.4, thickness: 0.02 });
      B.add(glass, cyl(0.04, 0.04, 0.2, 0, 0.1, 0, 10), cyl(0.015, 0.035, 0.08, 0, 0.24, 0, 10));
      return { group: B.build(), half: [0.05, 0.14], dynamic: true, material: 'glass' };
    }
  }
}

/** Pickups lying on the ground: small labelled boxes / cans / kits. */
export function pickupMesh(kind: string): THREE.Group {
  const B = new Batch();
  const col: Record<string, number> = { ammo_9mm: 0x4a5a3a, ammo_shells: 0x7a2a22, ammo_rifle: 0x3a4a5a, medkit: 0xd8d4c8, bandage: 0xd8ccb0, food: 0x9aa0a0, water: 0x5f8faa, scrap: 0x6a6e66, cloth: 0x8a7a5a, battery: 0x2a2a2a, bottle: 0x3f6a3a };
  if (kind === 'water') B.add(new THREE.MeshPhysicalMaterial({ color: 0x9fd0ea, roughness: 0.1, transmission: 0.5, thickness: 0.05 }), cyl(0.06, 0.06, 0.28, 0, 0.14, 0, 12));
  else if (kind === 'food') B.add(M.paint(0x9aa0a0, 0.35), cyl(0.07, 0.07, 0.12, 0, 0.06, 0, 14));
  else B.add(M.paint(col[kind] ?? 0x777777, 0.6), box(0.3, 0.16, 0.2, 0, 0.08, 0));
  if (kind === 'medkit') B.add(M.emissive(0xb0302a, 0.4), box(0.12, 0.04, 0.02, 0, 0.1, 0.105), box(0.04, 0.12, 0.02, 0, 0.1, 0.105));
  return B.build();
}

export { plane };

/** A searchable spot (scavenging): an opened box / duffel bag with a slow glint so players read
 *  "there is something here" without UI. The glint is a sprite named 'glint' (animated by Game). */
export function lootSpot(seed: number): THREE.Group {
  const R = new Rng(seed), B = new Batch(), g = new THREE.Group();
  if (R.chance(0.5)) {               // opened cardboard box with loose items
    const card = M.paint(0x8a6a44, 0.9);
    B.add(card, box(0.5, 0.32, 0.38, 0, 0.16, 0), box(0.5, 0.02, 0.2, 0, 0.36, 0.26, { rotX: 0.9 }), box(0.5, 0.02, 0.2, 0, 0.36, -0.26, { rotX: -0.9 }));
    B.add(M.paint(0x9aa0a0, 0.35), cyl(0.05, 0.05, 0.1, -0.12, 0.37, 0.02, 10));
    B.add(M.paint(0x3a6a8a, 0.4), cyl(0.04, 0.04, 0.2, 0.1, 0.4, -0.05, 10));
  } else {                           // dropped duffel bag, unzipped
    B.add(M.cloth(0x3a4a3a), cyl(0.16, 0.16, 0.62, 0, 0.16, 0, 12, { rotZ: Math.PI / 2 }));
    B.add(M.cloth(0x1d221d), box(0.5, 0.02, 0.06, 0, 0.32, 0.03));
    B.add(M.paint(0xb03028, 0.5), box(0.14, 0.08, 0.1, 0.12, 0.34, 0.02));
  }
  g.add(B.build());
  const glint = glowSprite(0.45, 0xfff0c8, 0.0); glint.name = 'glint'; glint.position.set(0, 0.55, 0.15); g.add(glint);
  return g;
}
