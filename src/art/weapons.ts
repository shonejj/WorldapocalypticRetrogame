import * as THREE from 'three';
import { M } from './kit';

export type WeaponKind = 'pistol' | 'shotgun' | 'rifle' | 'pipe';

/** Weapons are modelled along +x from the grip (origin). Child "muzzle" marks the barrel tip. */
export function weaponMesh(kind: WeaponKind): THREE.Group {
  const g = new THREE.Group(), steel = M.metal('#2b2f33'), poly = M.paint(0x2a2c2a, 0.7), wood = M.wood('#5a3a22');
  const b = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, rz = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, 0); m.rotation.z = rz; m.castShadow = true; g.add(m); };
  let tip = 0.4;
  if (kind === 'pistol') { b(0.2, 0.05, 0.035, steel, 0.06, 0.03); b(0.05, 0.11, 0.03, poly, -0.01, -0.03, 0.25); tip = 0.17; }
  else if (kind === 'rifle') { b(0.36, 0.065, 0.05, steel, 0.12, 0.02); b(0.42, 0.025, 0.025, steel, 0.5, 0.03); b(0.25, 0.06, 0.04, poly, 0.42, 0.0); b(0.2, 0.07, 0.04, poly, -0.18, -0.01, -0.12); b(0.05, 0.12, 0.035, poly, 0.03, -0.06, 0.2); b(0.05, 0.13, 0.03, steel, 0.18, -0.07, -0.25); b(0.14, 0.035, 0.035, steel, 0.12, 0.075); tip = 0.72; }
  else if (kind === 'shotgun') { b(0.3, 0.06, 0.045, steel, 0.1, 0.02); b(0.5, 0.03, 0.03, steel, 0.48, 0.04); b(0.28, 0.035, 0.035, wood, 0.45, 0.0); b(0.28, 0.07, 0.04, wood, -0.2, -0.02, -0.15); b(0.05, 0.1, 0.035, wood, 0.02, -0.05, 0.25); tip = 0.73; }
  else { const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.75, 8), M.metal('#7a7e7e')); pipe.rotation.z = Math.PI / 2; pipe.position.x = 0.3; pipe.castShadow = true; g.add(pipe); b(0.14, 0.05, 0.05, wood, -0.02, 0); tip = 0.68; }
  const muzzle = new THREE.Object3D(); muzzle.name = 'muzzle'; muzzle.position.set(tip, 0.03, 0); g.add(muzzle);
  return g;
}
