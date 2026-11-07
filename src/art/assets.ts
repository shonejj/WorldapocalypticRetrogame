import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Third-party CC0 models (public/models/LICENSES-CC0.csv): Poly Haven photo-scanned props and
 * Quaternius guns. Loaded once before a level is built; every consumer falls back to the
 * code-built version when a file is missing, so the game never depends on them to run.
 */
const PROPS = ['cardboard_box', 'plastic_crate', 'military_crate', 'wooden_crate', 'jerrycan', 'trashbag', 'tyre', 'road_barrier',
  'aircon_unit', 'power_box', 'generator', 'hanging_lamp', 'covered_car', 'barrel'] as const;
const GUNS = ['pistol', 'rifle', 'shotgun'] as const;
export type AssetName = (typeof PROPS)[number] | (typeof GUNS)[number];

const lib = new Map<AssetName, THREE.Object3D>();
let loading: Promise<void> | null = null;

export function loadAssets(base: string): Promise<void> {
  if (!loading) {
    const loader = new GLTFLoader();
    const one = async (n: AssetName, dir: string) => {
      try { const g = await loader.loadAsync(`${base}models/${dir}/${n}.glb`); g.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); lib.set(n, g.scene); }
      catch (e) { console.warn(`[assets] ${n} unavailable, using built-in`, e); }
    };
    loading = Promise.all([...PROPS.map((n) => one(n, 'props')), ...GUNS.map((n) => one(n, 'weapons'))]).then(() => undefined);
  }
  return loading;
}

/**
 * A clone standing on y = 0, centred on x/z. `fit` scales it uniformly so its height (or, with
 * `by: 'length'`, its longest horizontal side) matches; otherwise the model keeps its real size.
 */
export function asset(name: AssetName, fit?: number, by: 'height' | 'length' = 'height'): THREE.Object3D | null {
  const src = lib.get(name); if (!src) return null;
  const inner = src.clone(true), g = new THREE.Group(); g.add(inner);
  const b = new THREE.Box3().setFromObject(inner), size = b.getSize(new THREE.Vector3());
  const k = fit ? fit / (by === 'height' ? size.y : Math.max(size.x, size.z)) : 1;
  inner.scale.multiplyScalar(k);
  const c = b.getCenter(new THREE.Vector3()).multiplyScalar(k);
  inner.position.set(-c.x, -b.min.y * k, -c.z);
  return g;
}
export const hasAsset = (n: AssetName) => lib.has(n);
