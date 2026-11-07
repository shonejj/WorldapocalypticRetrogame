import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as TX from './textures';

/**
 * Shared art-kit plumbing:
 * - `worldUV` projects UVs from world-space positions (per face normal) so every surface keeps
 *   the same texel density regardless of its size (art-direction invariant).
 * - `Batch` collects transformed geometries per material and merges them → few draw calls.
 * - `LightSpot` is a light *descriptor*; the LightPool turns the nearest ones into real lights.
 */
export interface LightSpot { x: number; y: number; z: number; color: number; intensity: number; distance: number; flicker?: boolean; cone?: boolean; on?: boolean }

export function worldUV(g: THREE.BufferGeometry, metersPerTile = 2): THREE.BufferGeometry {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u: number, v: number;
    if (az >= ax && az >= ay) { u = p.getX(i); v = p.getY(i); }
    else if (ax >= ay) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getZ(i); }
    uv[i * 2] = u / metersPerTile; uv[i * 2 + 1] = v / metersPerTile;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** Box placed by its min corner-free centre, size, with world UVs. */
export function box(w: number, h: number, d: number, x: number, y: number, z: number, opts: { tile?: number; rotY?: number; rotZ?: number; rotX?: number } = {}): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (opts.rotX) g.rotateX(opts.rotX); if (opts.rotZ) g.rotateZ(opts.rotZ); if (opts.rotY) g.rotateY(opts.rotY);
  g.translate(x, y, z);
  return worldUV(g, opts.tile ?? 2);
}
export function cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, seg = 12, opts: { rotX?: number; rotZ?: number; tile?: number } = {}): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  if (opts.rotX) g.rotateX(opts.rotX); if (opts.rotZ) g.rotateZ(opts.rotZ);
  g.translate(x, y, z);
  return opts.tile ? worldUV(g, opts.tile) : g;
}
export function plane(w: number, h: number, x: number, y: number, z: number, rotY = 0): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h); if (rotY) g.rotateY(rotY); g.translate(x, y, z); return g;
}

export class Batch {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(mat: THREE.Material, ...geos: THREE.BufferGeometry[]): void {
    let a = this.parts.get(mat); if (!a) this.parts.set(mat, (a = []));
    for (const g of geos) a.push(g.index ? g.toNonIndexed() : g);
  }
  /** Merge into one mesh per material. */
  build(opts: { castShadow?: boolean; receiveShadow?: boolean } = {}): THREE.Group {
    const grp = new THREE.Group();
    for (const [mat, geos] of this.parts) {
      for (const g of geos) { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); if (!g.getAttribute('uv')) worldUV(g); }
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = opts.castShadow ?? true; m.receiveShadow = opts.receiveShadow ?? true;
      if ((mat as THREE.MeshStandardMaterial).transparent || (mat as THREE.MeshStandardMaterial).alphaTest) m.castShadow = false;
      grp.add(m);
      for (const g of geos) g.dispose();
    }
    this.parts.clear();
    return grp;
  }
}

// ---------------------------------------------------------------- material library (shared instances)
const mats = new Map<string, THREE.Material>();
const std = (key: string, make: () => THREE.Material) => { let m = mats.get(key); if (!m) { m = make(); mats.set(key, m); } return m as THREE.MeshStandardMaterial; };
const pbr = (maps: TX.PbrMaps, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ map: maps.map, normalMap: maps.normalMap, roughnessMap: maps.roughnessMap, ...extra });

export const M = {
  brick: (tint = '#6b3f33', seed = 1) => std(`brick${tint}${seed}`, () => pbr(TX.brick(tint, seed), { normalScale: new THREE.Vector2(0.9, 0.9) })),
  concrete: (tint = '#6a6e6c', seed = 2) => std(`concrete${tint}${seed}`, () => pbr(TX.concrete(tint, seed))),
  plaster: (tint = '#8a8170', seed = 3) => std(`plaster${tint}${seed}`, () => pbr(TX.plaster(tint, seed))),
  asphalt: () => std('asphalt', () => pbr(TX.asphalt(), { envMapIntensity: 1.4 })),
  paving: () => std('paving', () => pbr(TX.paving(), { envMapIntensity: 1.1 })),
  metal: (tint = '#5c6468') => std(`metal${tint}`, () => pbr(TX.rust(tint), { metalness: 0.55 })),
  paint: (color: number, rough = 0.55) => std(`paint${color}${rough}`, () => { const t = TX.concrete('#c8c8c8', 9); return new THREE.MeshStandardMaterial({ map: t.map, color, metalness: 0.25, roughness: rough, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.4, 0.4) }); }),   // weathered paint: soft grime, no rust camouflage
  wood: (tint = '#6e4c30') => std(`wood${tint}`, () => pbr(TX.wood(tint))),
  cloth: (color: number) => std(`cloth${color}`, () => pbr(TX.cloth(), { color, roughness: 0.95 })),
  rubber: () => std('rubber', () => new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 })),
  dark: () => std('dark', () => new THREE.MeshStandardMaterial({ color: 0x0a0d10, roughness: 0.9 })),
  glass: () => std('glass', () => new THREE.MeshPhysicalMaterial({ color: 0x9fb8c8, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.22, envMapIntensity: 2, depthWrite: false })),
  carGlass: () => std('carGlass', () => new THREE.MeshPhysicalMaterial({ color: 0x0c161d, roughness: 0.05, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.8 })),
  leaves: (dark = false, seed = 9) => std(`leaves${dark}${seed}`, () => { const t = TX.leaves(seed, dark); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 }); }),
  window: (kind: 'lit' | 'dark' | 'shop' | 'tv', seed = 1) => std(`win${kind}${seed}`, () => {
    const t = TX.windowTexture(kind, seed);
    return new THREE.MeshStandardMaterial({ map: t, emissive: kind === 'dark' ? 0x000000 : 0xffffff, emissiveMap: kind === 'dark' ? null : t, emissiveIntensity: kind === 'shop' ? 1.0 : 0.8, roughness: 0.08, metalness: 0.1 });
  }),
  sign: (text: string, bg: string, fg: string, glow = 0.35) => std(`sign${text}${bg}${fg}`, () => {
    const t = TX.signTexture(text, { bg, fg });
    return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: glow, roughness: 0.75 });
  }),
  ivy: (seed = 1) => std(`ivy${seed}`, () => new THREE.MeshStandardMaterial({ map: TX.ivy(seed), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.55 })),
  poster: (seed = 1) => std(`poster${seed}`, () => new THREE.MeshStandardMaterial({ map: TX.poster(seed), alphaTest: 0.3, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 })),
  grime: (seed = 1) => std(`grime${seed}`, () => new THREE.MeshBasicMaterial({ map: TX.grime(seed), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }) as unknown as THREE.MeshStandardMaterial),
  /** Unlit silhouette colour for far layers (fog does the atmospheric perspective). */
  silhouette: (color: number) => std(`sil${color}`, () => new THREE.MeshBasicMaterial({ color }) as unknown as THREE.MeshStandardMaterial),
  emissive: (color: number, intensity = 3) => std(`emis${color}${intensity}`, () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 })),
};

/** Screen-space-only effects (halos, fake light shafts, rain) that must NOT appear in puddle reflections. */
export const NO_REFLECT = new Set<THREE.Object3D>();

/** Additive light cone / glow sprite meshes (fake volumetrics; no lighting cost). */
export function lightCone(len: number, radius: number, color: number, opacity = 0.05): THREE.Mesh {
  const g = new THREE.ConeGeometry(radius, len, 24, 1, true); g.translate(0, -len / 2, 0);
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, alphaMap: TX.coneTexture(), fog: false });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 5; NO_REFLECT.add(mesh); return mesh;
}
export function glowSprite(size: number, color: number, opacity = 0.9): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.setScalar(size); NO_REFLECT.add(s); return s;
}
