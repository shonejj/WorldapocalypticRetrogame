import * as THREE from 'three';
import { glowTexture } from '../art/textures';

/**
 * Pooled VFX (performance-optimization: no per-shot allocation). One InstancedMesh for all
 * particles (1 draw call), a small pool of muzzle-flash sprites, tracer line segments and
 * blood decals on the ground.
 */
interface P { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; r: number; g: number; b: number; grav: number; stick: boolean }
const MAX = 1500;

export class Fx {
  readonly root = new THREE.Group();
  private ps: P[] = [];
  private inst: THREE.InstancedMesh;
  private m = new THREE.Matrix4(); private c = new THREE.Color(); private q = new THREE.Quaternion(); private v = new THREE.Vector3(); private s = new THREE.Vector3();
  private flashes: { s: THREE.Sprite; t: number }[] = [];
  private tracers: THREE.LineSegments; private tr: { a: THREE.Vector3; b: THREE.Vector3; t: number }[] = [];
  private decals: THREE.Mesh[] = []; private decalI = 0;
  /** soft puffs (gun smoke, manhole steam): pooled sprites that rise, grow and fade */
  private puffs: { s: THREE.Sprite; t: number; max: number; vx: number; vy: number; grow: number; a: number }[] = []; private puffI = 0;

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
    this.inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.4 }), MAX);
    this.inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.inst.count = 0; this.inst.frustumCulled = false;
    this.root.add(this.inst);
    for (let i = 0; i < 8; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd28a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
      sp.visible = false; this.root.add(sp); this.flashes.push({ s: sp, t: 0 });
    }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 6), 3));
    tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(64 * 6), 3));
    this.tracers = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.tracers.frustumCulled = false; this.root.add(this.tracers);
    for (let i = 0; i < 48; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x9aa6ae, transparent: true, depthWrite: false, opacity: 0 }));
      sp.visible = false; this.root.add(sp); this.puffs.push({ s: sp, t: 0, max: 1, vx: 0, vy: 0, grow: 1, a: 0.3 });
    }
    const dg = new THREE.CircleGeometry(1, 12); dg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 48; i++) {
      const d = new THREE.Mesh(dg, new THREE.MeshStandardMaterial({ color: 0x3a0806, roughness: 0.15, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      d.visible = false; this.root.add(d); this.decals.push(d);
    }
  }

  private add(p: Partial<P> & { x: number; y: number }): void {
    if (this.ps.length >= MAX) this.ps.shift();
    this.ps.push({ z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0.04, r: 1, g: 1, b: 1, grav: -14, stick: false, ...p });
  }
  blood(x: number, y: number, dir: number, amount = 1): void {
    for (let i = 0; i < 16 * amount; i++) { const k = 0.4 + Math.random() * 0.8; this.add({ x, y, z: (Math.random() - 0.5) * 0.3, vx: dir * (1 + Math.random() * 4) + (Math.random() - 0.5) * 2, vy: Math.random() * 3 - 0.5, vz: (Math.random() - 0.5) * 2, max: 0.6 + Math.random() * 0.8, size: 0.025 + Math.random() * 0.05, r: 0.32 * k, g: 0.02 * k, b: 0.02 * k, stick: true }); }
    if (Math.random() < 0.9) this.decal(x + dir * (0.3 + Math.random()), 0.18 + Math.random() * 0.35 * amount);
  }
  decal(x: number, r: number, z = (Math.random() - 0.5) * 0.8): void {
    const d = this.decals[this.decalI++ % this.decals.length]; d.visible = true; d.position.set(x, 0.008, z); d.scale.set(r, 1, r * 0.7);
  }
  sparks(x: number, y: number, nx: number, ny: number, n = 10): void { for (let i = 0; i < n; i++) this.add({ x, y, vx: nx * (2 + Math.random() * 4) + (Math.random() - 0.5) * 3, vy: ny * 2 + Math.random() * 3, vz: (Math.random() - 0.5) * 2, max: 0.15 + Math.random() * 0.25, size: 0.02, r: 3, g: 2, b: 0.8, grav: -10 }); }
  splinters(x: number, y: number, dir: number): void { for (let i = 0; i < 8; i++) this.add({ x, y, vx: dir * (1 + Math.random() * 3), vy: Math.random() * 3, vz: (Math.random() - 0.5) * 2, max: 0.7, size: 0.035, r: 0.4, g: 0.28, b: 0.17, stick: true }); }
  dust(x: number, y: number, n = 6): void { for (let i = 0; i < n; i++) this.add({ x: x + (Math.random() - 0.5) * 0.3, y, vx: (Math.random() - 0.5) * 1.2, vy: Math.random() * 0.8, vz: (Math.random() - 0.5), max: 0.6 + Math.random() * 0.4, size: 0.06, r: 0.35, g: 0.38, b: 0.4, grav: -1 }); }
  splash(x: number, z = 0): void { for (let i = 0; i < 4; i++) this.add({ x, y: 0.02, z, vx: (Math.random() - 0.5) * 1.5, vy: 1 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 1.5, max: 0.25, size: 0.022, r: 0.6, g: 0.72, b: 0.82, grav: -16 }); }
  casing(x: number, y: number, dir: number, shell = false): void { this.add({ x, y, z: 0.1, vx: -dir * (1 + Math.random()), vy: 2.5 + Math.random(), vz: Math.random(), max: 2, size: shell ? 0.05 : 0.03, r: shell ? 0.8 : 0.9, g: shell ? 0.2 : 0.7, b: 0.15, stick: true }); }
  glass(x: number, y: number): void { for (let i = 0; i < 18; i++) this.add({ x, y, vx: (Math.random() - 0.5) * 4, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 3, max: 1.2, size: 0.03, r: 0.5, g: 0.7, b: 0.55, stick: true }); }
  puff(x: number, y: number, z: number, o: { size?: number; vx?: number; vy?: number; life?: number; grow?: number; alpha?: number; color?: number } = {}): void {
    const p = this.puffs[this.puffI++ % this.puffs.length];
    p.s.position.set(x, y, z); p.s.scale.setScalar(o.size ?? 0.3); p.s.visible = true; (p.s.material as THREE.SpriteMaterial).color.setHex(o.color ?? 0x9aa6ae);
    Object.assign(p, { t: 0, max: o.life ?? 1.2, vx: o.vx ?? 0, vy: o.vy ?? 0.5, grow: o.grow ?? 1.2, a: o.alpha ?? 0.3 });
  }
  /** water dripping from an awning / ledge edge */
  drip(x: number, y: number, z: number): void { this.add({ x, y, z, vy: -1, max: 1.4, size: 0.018, r: 0.55, g: 0.68, b: 0.78, grav: -12 }); }
  muzzle(p: THREE.Vector3, size = 0.9): void {
    const f = this.flashes.find((q) => q.t <= 0) ?? this.flashes[0];
    f.t = 0.06; f.s.visible = true; f.s.position.copy(p); f.s.scale.setScalar(size * (0.8 + Math.random() * 0.4));
  }
  tracer(a: THREE.Vector3, b: THREE.Vector3): void { if (this.tr.length >= 64) this.tr.shift(); this.tr.push({ a: a.clone(), b: b.clone(), t: 0.07 }); }

  update(dt: number): void {
    let n = 0;
    const keep: P[] = [];
    for (const p of this.ps) {
      p.life += dt; if (p.life >= p.max) continue;
      const grounded = p.stick && p.y <= 0.012;
      if (!grounded) { p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; }
      if (p.y < 0.012) { p.y = 0.012; if (p.stick) { p.vx = p.vy = p.vz = 0; p.max = Math.max(p.max, p.life + 5); } else { p.vy *= -0.3; p.vx *= 0.6; } }
      keep.push(p);
      const fade = grounded ? 1 : 1 - p.life / p.max;
      this.m.compose(this.v.set(p.x, p.y, p.z), this.q, this.s.setScalar(p.size));
      this.inst.setMatrixAt(n, this.m); this.inst.setColorAt(n, this.c.setRGB(p.r * (0.3 + 0.7 * fade), p.g * (0.3 + 0.7 * fade), p.b * (0.3 + 0.7 * fade))); n++;
    }
    this.ps = keep; this.inst.count = n; this.inst.instanceMatrix.needsUpdate = true; if (this.inst.instanceColor) this.inst.instanceColor.needsUpdate = true;
    for (const p of this.puffs) if (p.s.visible) {
      p.t += dt; if (p.t >= p.max) { p.s.visible = false; continue; }
      const k = p.t / p.max; p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.scale.multiplyScalar(1 + p.grow * dt);
      (p.s.material as THREE.SpriteMaterial).opacity = p.a * Math.sin(Math.min(1, k * 4) * Math.PI / 2) * (1 - k);
    }
    for (const f of this.flashes) if (f.t > 0) { f.t -= dt; (f.s.material as THREE.SpriteMaterial).opacity = Math.max(0, f.t / 0.06); if (f.t <= 0) f.s.visible = false; }
    const pos = this.tracers.geometry.getAttribute('position') as THREE.BufferAttribute, col = this.tracers.geometry.getAttribute('color') as THREE.BufferAttribute;
    this.tr = this.tr.filter((t) => (t.t -= dt) > 0);
    let k = 0;
    for (const t of this.tr) { const a = t.t / 0.07; pos.setXYZ(k, t.a.x, t.a.y, t.a.z); pos.setXYZ(k + 1, t.b.x, t.b.y, t.b.z); col.setXYZ(k, a * 0.4, a * 0.3, a * 0.15); col.setXYZ(k + 1, a * 2, a * 1.6, a); k += 2; }
    this.tracers.geometry.setDrawRange(0, k); pos.needsUpdate = true; col.needsUpdate = true;
  }
  dispose(): void { this.root.removeFromParent(); }
}
