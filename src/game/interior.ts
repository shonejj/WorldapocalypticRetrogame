import * as THREE from 'three';
import { Rng } from '../core/math';
import { M, Batch, box, plane, glowSprite, type LightSpot } from '../art/kit';
import { asset, type AssetName } from '../art/assets';
import type { AnimIn } from './rig';
import type { ItemId } from './data';

/**
 * Interiors (production bible: big locations are places, not a timer). Entering a store, pharmacy,
 * apartment, garage or bus fades to an isometric view of a separate room map built here: walls with a
 * cut-away front, furniture with collision, its own lights, and 2–4 searchable spots (the street
 * cache's loot is split across them, plus a lore note). One survivor goes in; the squad keeps watch.
 * The room lives far from the street (x ≈ 6000) so the street's lights/fog/LOD never interfere.
 */
export type InteriorKind = 'store' | 'pharmacy' | 'apartment' | 'garage' | 'bus';
export interface Spot { id: string; x: number; z: number; label: string; time: number; loot: Partial<Record<ItemId, number>>; note?: string; anim: 'search' | 'pick' | 'open'; glint: THREE.Sprite }
interface Box2 { x0: number; x1: number; z0: number; z1: number }

export const ORIGIN = new THREE.Vector3(6000, 0, 0);
const NOTES: Record<InteriorKind, string> = {
  store: 'Shift log, 14 March: "Last delivery. The driver was coughing blood. Told him to go to the pharmacy."',
  pharmacy: 'Prescription pad: "GENOVA LABS — trial batch 7. Do NOT dispense. Return to sender."',
  apartment: 'Note on the fridge: "Gone to the radio station on the hill. They say it\'s safe there. — Mum"',
  garage: 'Work order #4471: "Ambulance 12 — brakes. Never collected. Owner in quarantine."',
  bus: 'Ticket stub: "Route 7 — Market St → Lighthouse Point." Someone circled the last stop.',
};

export class Interior {
  readonly group = new THREE.Group();
  readonly spots: Spot[] = [];
  readonly lights: LightSpot[] = [];
  readonly exit: { x: number; z: number };
  readonly size: { w: number; d: number };
  private walls: Box2[] = [];
  pos = new THREE.Vector3(); heading = 0; speed = 0;

  constructor(readonly kind: InteriorKind, readonly cacheId: string, loot: Partial<Record<ItemId, number>>, looted: Set<string>, seed: number) {
    const R = new Rng(seed), B = new Batch();
    const w = kind === 'bus' ? 11 : kind === 'garage' ? 13 : kind === 'apartment' ? 11 : 12, d = kind === 'bus' ? 3 : 8;
    this.size = { w, d };
    const floor = kind === 'bus' ? M.metal('#3a4044') : kind === 'garage' ? M.concrete('#4a4c48', 8) : kind === 'apartment' ? M.wood('#5a4434') : M.paving();
    const wall = kind === 'bus' ? M.paint(0x8a9a8a, 0.6) : kind === 'garage' ? M.concrete('#5c605c', 9) : kind === 'apartment' ? M.plaster('#7a7462', 4) : M.plaster('#8a8676', 5);
    // floor, back wall, side walls; the front wall is low (iso cut-away) with a doorway
    B.add(floor, box(w, 0.1, d, 0, -0.05, 0, { tile: 2 }));
    const H = kind === 'bus' ? 2.2 : 3.2;
    B.add(wall, box(w, H, 0.15, 0, H / 2, -d / 2), box(0.15, H, d, -w / 2, H / 2, 0), box(0.15, H, d, w / 2, H / 2, 0));
    const doorX = kind === 'bus' ? -w / 2 + 1.2 : 0;
    B.add(wall, box(doorX + w / 2 - 0.7, 0.5, 0.12, (-w / 2 + doorX - 0.7) / 2, 0.25, d / 2), box(w / 2 - doorX - 0.7, 0.5, 0.12, (doorX + 0.7 + w / 2) / 2, 0.25, d / 2));
    this.walls.push({ x0: -w / 2 - 1, x1: w / 2 + 1, z0: -d / 2 - 1, z1: -d / 2 + 0.3 }, { x0: -w / 2 - 1, x1: -w / 2 + 0.3, z0: -d, z1: d }, { x0: w / 2 - 0.3, x1: w / 2 + 1, z0: -d, z1: d },
      { x0: -w / 2, x1: doorX - 0.7, z0: d / 2 - 0.2, z1: d }, { x0: doorX + 0.7, x1: w / 2, z0: d / 2 - 0.2, z1: d });
    this.exit = { x: doorX, z: d / 2 - 0.5 };
    B.add(M.emissive(0x3fd06a, 1.5), box(0.5, 0.18, 0.04, doorX, 2.4 > H ? H - 0.2 : 2.4, d / 2 - 0.1));   // exit sign glow
    const solid = (x: number, z: number, sx: number, sz: number) => this.walls.push({ x0: x - sx / 2 - 0.25, x1: x + sx / 2 + 0.25, z0: z - sz / 2 - 0.25, z1: z + sz / 2 + 0.25 });
    const shelf = (x: number, z: number, len: number, rot = false) => {
      const sx = rot ? 0.5 : len, sz = rot ? len : 0.5;
      B.add(M.metal('#5a6064'), box(sx, 1.25, sz, x, 0.625, z));
      for (let y = 0.35; y < 1.2; y += 0.4) for (let k = -len / 2 + 0.15; k < len / 2; k += 0.22) if (R.chance(0.6))
        B.add(M.paint(R.pick([0x9a3a2a, 0x3a6a8a, 0xc79a3a, 0x5a7a3a, 0xd8d0c0]), 0.6), box(rot ? 0.3 : 0.16, 0.22, rot ? 0.16 : 0.3, rot ? x : x + k, y + 0.12, rot ? z + k : z));
      solid(x, z, sx, sz);
    };
    const counter = (x: number, z: number, len: number) => { B.add(M.wood('#4a3424'), box(len, 1.0, 0.7, x, 0.5, z)); solid(x, z, len, 0.7); };
    const prop = (n: AssetName, x: number, z: number, ry = 0, fit?: number) => { const a = asset(n, fit); if (a) { a.position.set(x, 0, z); a.rotation.y = ry; this.group.add(a); solid(x, z, 0.8, 0.8); } };
    const lamp = (x: number, z: number, c = 0xffd6a0, i = 7) => { B.add(M.emissive(c, 3), box(0.7, 0.05, 0.25, x, H - 0.1, z)); this.lights.push({ x: ORIGIN.x + x, y: H - 0.3, z: z, color: c, intensity: i, distance: 9, flicker: R.chance(0.3) }); };
    const spots: [number, number, string, Spot['anim']][] = [];

    if (kind === 'store') {
      for (const z of [-1.6, 0.6]) shelf(-1.5, z, 6);
      B.add(M.window('shop', 3), plane(4, 1.6, 2.5, 1.4, -d / 2 + 0.09));                // fridges along the back wall
      B.add(M.metal('#6a7074'), box(4.2, 2.0, 0.6, 2.5, 1.0, -d / 2 + 0.4)); solid(2.5, -d / 2 + 0.4, 4.2, 0.6);
      counter(3.6, 2.2, 2.6); B.add(M.dark(), box(0.5, 0.3, 0.4, 3.2, 1.15, 2.2));
      lamp(-2, -0.5); lamp(2.5, 1.5, 0xe8f4ff, 5);
      spots.push([-1.5, -0.95, 'Search the shelves', 'pick'], [2.5, -d / 2 + 1.0, 'Check the fridges', 'open'], [3.6, 1.6, 'Search behind the counter', 'search']);
    } else if (kind === 'pharmacy') {
      shelf(-3.5, -1.0, 4); shelf(-3.5, 1.2, 4);
      counter(1.0, 0.8, 4); B.add(M.emissive(0x2fd36a, 2), box(0.5, 0.16, 0.05, 1.0, 2.6, -d / 2 + 0.1), box(0.16, 0.5, 0.05, 1.0, 2.6, -d / 2 + 0.1));
      B.add(wall, box(0.15, H, d * 0.55, 3.6, H / 2, -d / 2 + d * 0.275)); this.walls.push({ x0: 3.4, x1: 3.8, z0: -d / 2, z1: -d / 2 + d * 0.55 });
      shelf(5.0, -2.6, 2.0); prop('military_crate', 4.8, -0.6, 0.3);
      lamp(-2, 0); lamp(4.6, -2, 0xe8f4ff, 4);
      spots.push([1.0, 0.15, 'Search the counter drawers', 'search'], [-3.5, -0.45, 'Search the shelves', 'pick'], [5.0, -1.9, 'Search the back storage', 'open']);
    } else if (kind === 'apartment') {
      B.add(M.cloth(0x5a4a3a), box(2.4, 0.5, 0.9, -3, 0.25, -2.6), box(2.4, 0.7, 0.25, -3, 0.6, -3.0)); solid(-3, -2.7, 2.4, 1.0);   // couch
      B.add(M.wood('#5a3e28'), box(1.4, 0.08, 0.9, -3, 0.45, -1.2)); solid(-3, -1.2, 1.4, 0.9);
      counter(3.5, -3.3, 3.2); B.add(M.metal('#8a9094'), box(0.8, 1.8, 0.7, 5.0, 0.9, -3.3)); solid(5.0, -3.3, 0.8, 0.7);   // kitchen + fridge
      B.add(wall, box(0.15, H, 3.5, 1.0, H / 2, 2.2)); this.walls.push({ x0: 0.8, x1: 1.2, z0: 0.45, z1: 4 });       // bedroom partition
      B.add(M.cloth(0x6a6a7a), box(1.8, 0.45, 2.2, 3.4, 0.22, 2.0)); solid(3.4, 2.0, 1.8, 2.2);
      lamp(-3, -1.5, 0xffc890, 5); lamp(3.5, 1.5, 0xffc890, 4);
      spots.push([3.5, -2.6, 'Search the kitchen', 'open'], [3.4, 0.6, 'Search the bedroom', 'search'], [-3, -0.55, 'Check the coffee table', 'pick']);
    } else if (kind === 'garage') {
      B.add(M.paint(0x6a2a24, 0.5), box(4.2, 1.2, 1.9, -2.5, 1.3, -1.2)); B.add(M.metal('#4a5052'), box(0.2, 1.4, 2.4, -4.4, 0.7, -1.2), box(0.2, 1.4, 2.4, -0.6, 0.7, -1.2)); solid(-2.5, -1.2, 4.6, 2.4);   // car on the lift
      counter(3.5, -3.2, 3.6); B.add(M.wood('#6a5236'), box(3.6, 1.2, 0.05, 3.5, 1.8, -d / 2 + 0.1));
      prop('generator', 5.2, 0.5, -0.5); prop('jerrycan', 4.2, 1.2, 0.6); prop('tyre', -5.5, 2.5, 0); prop('barrel', 0.8, 2.6, 0, 0.9);
      lamp(-2.5, -1); lamp(3.5, -2, 0xe8f4ff, 5);
      spots.push([3.5, -2.5, 'Search the tool chest', 'search'], [-2.5, 0.25, 'Search the car', 'open'], [5.2, 1.5, 'Check the lockers', 'open']);
    } else {
      for (let x = -3; x < w / 2 - 0.8; x += 1.1) for (const z of [-0.9, 0.9]) { B.add(M.cloth(0x3a4a6a), box(0.5, 0.5, 0.8, x, 0.25, z), box(0.12, 0.7, 0.8, x - 0.25, 0.7, z)); solid(x, z, 0.5, 0.8); }
      B.add(M.dark(), box(0.8, 1.0, 0.8, -w / 2 + 0.6, 0.5, -0.9)); solid(-w / 2 + 0.6, -0.9, 0.8, 0.8);   // driver
      lamp(-2, 0, 0xe8f4ff, 4); lamp(2.5, 0, 0xe8f4ff, 3);
      spots.push([-w / 2 + 1.3, -0.5, 'Search the driver\'s seat', 'search'], [1.0, 0, 'Search the luggage rack', 'pick'], [w / 2 - 1.2, 0, 'Check the back seats', 'search']);
    }
    // split the street cache's loot across the spots; one extra spot holds the lore note
    const items = Object.entries(loot) as [ItemId, number][];
    spots.forEach(([x, z, label, anim], i) => {
      const part: Partial<Record<ItemId, number>> = {};
      items.forEach(([k, n], j) => { if (j % spots.length === i) part[k] = n; });
      this.addSpot(`${cacheId}:${i}`, x, z, label, anim, part, undefined, looted);
    });
    const [nx, nz] = kind === 'bus' ? [3, -1.1] : [-w / 2 + 1.2, d / 2 - 1.6];
    this.addSpot(`${cacheId}:note`, nx, nz, 'Read the note', 'pick', {}, NOTES[kind], looted);

    const built = B.build({ castShadow: true, receiveShadow: true });
    this.group.add(built); this.group.position.copy(ORIGIN);
    this.pos.set(this.exit.x, 0, this.exit.z - 0.3); this.heading = Math.PI;
  }

  private addSpot(id: string, x: number, z: number, label: string, anim: Spot['anim'], loot: Spot['loot'], note: string | undefined, looted: Set<string>): void {
    const glint = glowSprite(0.4, note ? 0xbfe8f2 : 0xfff0c8, 0); glint.position.set(x, 1.1, z); this.group.add(glint);
    if (!note) { const b = new Batch(); b.add(M.paint(0x8a6a44, 0.9), box(0.4, 0.25, 0.3, 0, 0.12, 0)); const m = b.build(); m.position.set(x, 0, z); this.group.add(m); if (looted.has(id)) m.visible = false; }
    if (note) { const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.9 })); paper.rotation.x = -Math.PI / 2; paper.position.set(x, 0.02, z); this.group.add(paper); }
    if (looted.has(id)) { glint.visible = false; return; }
    this.spots.push({ id, x, z, label, time: note ? 0.8 : 1.6, loot, note, anim, glint });
  }

  /** True once every searchable spot is empty (the street door then stops offering entry). */
  get emptied(): boolean { return this.spots.length === 0; }

  /** Move inside the room with collision; returns the nearest spot/exit in reach. */
  move(dt: number, mx: number, mz: number, run: boolean): { spot: Spot | null; atExit: boolean } {
    const len = Math.hypot(mx, mz), sp = len > 0.12 ? (run ? 3.4 : 1.7) * Math.min(1, len) : 0;
    this.speed += (sp - this.speed) * Math.min(1, dt * 10);
    if (len > 0.12) { const target = Math.atan2(mx, mz); let d = target - this.heading; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; this.heading += d * Math.min(1, dt * 12); }
    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt, nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    const hit = (x: number, z: number) => this.walls.some((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
    if (!hit(nx, this.pos.z)) this.pos.x = nx;
    if (!hit(this.pos.x, nz)) this.pos.z = nz;
    let best: Spot | null = null, bd = 1.1;
    for (const s of this.spots) { const d = Math.hypot(s.x - this.pos.x, s.z - this.pos.z); if (d < bd) { bd = d; best = s; } }
    return { spot: best, atExit: Math.hypot(this.exit.x - this.pos.x, this.exit.z - this.pos.z) < 1.0 };
  }

  take(s: Spot): void { this.spots.splice(this.spots.indexOf(s), 1); s.glint.visible = false; }

  /** Glints pulse; returns the animation input for the avatar. */
  tick(time: number, task: Spot['anim'] | null): Partial<AnimIn> {
    this.spots.forEach((s, i) => { const t = (time * 0.7 + i * 0.37) % 2.4; s.glint.material.opacity = t < 0.5 ? Math.sin((t / 0.5) * Math.PI) * 0.9 : 0; });
    return { speed: this.speed, run: this.speed > 2.6, task: task === 'pick' ? 'pick' : task === 'open' ? 'open' : task ? 'search' : null };
  }

  /** World position of the avatar's feet. */
  world(): THREE.Vector3 { return this.pos.clone().add(ORIGIN); }
  dispose(): void { this.group.removeFromParent(); this.group.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); }); }
}

