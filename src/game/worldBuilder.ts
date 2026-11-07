import * as THREE from 'three';
import * as planck from 'planck';
import type { LevelDef } from './levels/types';
import type { LightSpot } from '../art/kit';
import { building, relay } from '../art/buildings';
import { ground, streetLamp, powerLine, chainFence, billboard, overpass, skyline, sky, Z } from '../art/street';
import { backdrop } from '../art/backdrop';
import { FACADE_Z } from '../art/buildings';
import { prop, type Prop } from '../art/props';
import { vehicle } from '../art/vehicles';
import { tree, bush, grass } from '../art/nature';
import { CAT, type Tag } from '../physics/world';
import { Rng, hashString } from '../core/math';
import { M, box, cyl, Batch } from '../art/kit';

export interface PropEnt { body: planck.Body; mesh: THREE.Object3D; z: number; material: Prop['material']; half: [number, number] }
export interface BuiltWorld { group: THREE.Group; lights: LightSpot[]; props: PropEnt[]; beacon: THREE.Object3D | null; workbench: THREE.Object3D; blinkers: THREE.Sprite[] }

/** Build the static level from data. Lane z = 0 is where actors and physics props live. */
export function buildWorld(L: LevelDef, scene: THREE.Scene, world: planck.World): BuiltWorld {
  const g = new THREE.Group(), lights: LightSpot[] = [], R = new Rng(L.seed);
  const add = (o: { group: THREE.Object3D; lights?: LightSpot[]; light?: LightSpot }) => { g.add(o.group); if (o.lights) lights.push(...o.lights); if (o.light) lights.push(o.light); };
  g.add(sky()); g.add(skyline(L.x0 - 60, L.x1 + 60)); g.add(ground(L.x0 - 60, L.x1 + 60));
  const far = backdrop(L.x0, L.x1, L.seed); g.add(far.group);
  for (const b of L.buildings) add(building({ ...b, seed: hashString(`${L.id}${b.x}`) }));
  const rl = relay(L.relayX); add(rl);
  add(overpass(L.overpass[0], L.overpass[1]));
  if (L.billboard) add(billboard(L.billboard.x, -9.5, L.billboard.text));
  g.add(powerLine(L.poles));
  // chain-link fences close every gap between buildings on the facade line (the view goes through them)
  for (const [a, b] of L.fences) g.add(chainFence(a, b, FACADE_Z + 0.05));
  for (const l of L.lamps) add(streetLamp(l.x, Z.lamps, l.lit, l.flicker));
  for (const x of L.trees) { const t = tree(Math.round(x * 7), R.range(1.0, 1.3)); t.position.set(x, 0, FACADE_Z - R.range(1.5, 4)); g.add(t); }
  for (const v of L.vehicles) { const m = vehicle(v.kind, hashString(`v${v.x}`)); m.group.position.set(v.x, -0.0, v.z ?? -2.75); m.group.rotation.y = (v.flip ? Math.PI : 0) + R.range(-0.04, 0.04); g.add(m.group); }
  // dark foreground overgrowth along the near road edge: frames the bottom of the screen (reference composition)
  for (let x = L.x0 - 10; x < L.x1 + 10; x += R.range(4, 9)) { const b = bush(Math.round(x * 3), R.range(0.55, 0.95), true); b.position.set(x, -0.35, R.range(6.5, 8.2)); g.add(b); }
  g.add(grass([[L.x0 - 20, L.x1 + 20, FACADE_Z, FACADE_Z + 0.6, 0], [L.x0 - 20, L.x1 + 20, 1.0, 1.9, -0.12], [L.x0 - 20, L.x1 + 20, 6, 8.5, -0.16], [L.x0 - 20, L.x1 + 20, -11, FACADE_Z - 0.2, 0]], 0.9, L.seed));

  // workbench in front of the garage
  const wb = new Batch(); const wx = L.workbench.x;
  wb.add(M.wood('#5a3e28'), box(1.8, 0.08, 0.8, wx, 0.92, -1.6), ...[[-0.8, -0.3], [0.8, -0.3], [-0.8, 0.3], [0.8, 0.3]].map(([dx, dz]) => box(0.08, 0.9, 0.08, wx + dx, 0.45, -1.6 + dz)));
  wb.add(M.metal('#4a5052'), box(0.5, 0.2, 0.3, wx - 0.5, 1.06, -1.7), cyl(0.06, 0.06, 0.4, wx + 0.4, 1.1, -1.5, 8));
  wb.add(M.emissive(0xffc27a, 2.5), box(0.12, 0.25, 0.12, wx + 0.6, 1.08, -1.75));
  const workbench = wb.build(); g.add(workbench);
  lights.push({ x: wx + 0.6, y: 1.4, z: -1.2, color: 0xffb066, intensity: 4, distance: 4, flicker: true });

  // physics props on the lane (dynamic bodies; z kept for visuals)
  const props: PropEnt[] = [];
  for (const p of L.props) {
    const pr = prop(p.kind, hashString(`p${p.x}`));
    const z = p.z ?? -0.45;
    pr.group.position.set(p.x, 0, z); g.add(pr.group);
    if (Math.abs(z) > 1.2) continue;                                        // background dressing only
    const body = pr.dynamic ? world.createDynamicBody({ position: { x: p.x, y: pr.half[1] }, angularDamping: 0.5 }) : world.createBody({ position: { x: p.x, y: pr.half[1] } });
    const dens = pr.material === 'metal' ? 55 : pr.material === 'wood' ? 35 : 15;
    const tag: Tag = { kind: 'prop', material: pr.material === 'plastic' ? 'plastic' : pr.material };
    body.createFixture(new planck.Box(pr.half[0], pr.half[1]), { density: dens, friction: 0.6, restitution: 0.12, filterCategoryBits: CAT.PROP, filterMaskBits: CAT.GROUND | CAT.PROP | CAT.RAGDOLL | CAT.LURE, userData: tag });
    props.push({ body, mesh: pr.group, z, material: pr.material, half: pr.half });
  }
  scene.add(g);
  return { group: g, lights, props, beacon: rl.group.getObjectByName('beacon') ?? null, workbench, blinkers: far.blinkers };
}
