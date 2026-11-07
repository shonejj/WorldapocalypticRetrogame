import * as THREE from 'three';
import { glowTexture } from './textures';

const MAX = 1400;
interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; r: number; g: number; b: number; grav: number; stick: boolean; z: number }

/**
 * Pooled particle + flash system. One InstancedMesh for all particles (1 draw
 * call), small pools for muzzle flashes, tracers and blood decals.
 */
export class Fx {
  private ps: P[] = [];
  private mesh: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private c = new THREE.Color();
  private flashes: { mesh: THREE.Mesh; t: number; max: number }[] = [];
  private tracers: THREE.LineSegments;
  private tracerData: { x0: number; y0: number; x1: number; y1: number; t: number }[] = [];
  private decals: THREE.Mesh[] = [];
  private decalIdx = 0;
  private flashTex: THREE.Texture;

  private root = new THREE.Group();
  constructor(scene: THREE.Object3D) {
    scene.add(this.root);
    const parent = this.root;
    const geo = new THREE.PlaneGeometry(1, 1);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ fog: true }), MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.position.z = 0.6;
    parent.add(this.mesh);
    this.flashTex = glowTexture('#ffd890', 1.6);
    for (let i = 0; i < 10; i++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.flashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      f.visible = false; f.position.z = 0.7; parent.add(f); this.flashes.push({ mesh: f, t: 0, max: 1 });
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(32 * 6), 3));
    tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(32 * 6), 3));
    this.tracers = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.tracers.frustumCulled = false; this.tracers.position.z = 0.65; parent.add(this.tracers);
    const dg = new THREE.CircleGeometry(1, 10); dg.scale(1, 0.14, 1);
    for (let i = 0; i < 40; i++) {
      const d = new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ color: 0x3a0806, transparent: true, opacity: 0.8, depthWrite: false }));
      d.visible = false; d.position.z = 0.05; parent.add(d); this.decals.push(d);
    }
  }

  private spawn(p: Partial<P> & { x: number; y: number }): void {
    if (this.ps.length >= MAX) this.ps.shift();
    this.ps.push({ vx: 0, vy: 0, life: 0, max: 1, size: 0.04, r: 1, g: 1, b: 1, grav: -14, stick: false, z: 0, ...p });
  }

  blood(x: number, y: number, dir: number, amount = 1): void {
    const n = Math.round(14 * amount);
    for (let i = 0; i < n; i++) {
      const s = 0.4 + Math.random() * 0.9;
      this.spawn({ x, y, vx: dir * (1 + Math.random() * 4) + (Math.random() - 0.5) * 2, vy: Math.random() * 3 - 0.5, max: 0.6 + Math.random() * 0.8,
        size: 0.025 + Math.random() * 0.05, r: 0.35 * s, g: 0.03 * s, b: 0.02 * s, stick: true });
    }
    if (Math.random() < 0.8) this.decal(x + dir * (0.3 + Math.random() * 1.2), 0.18 + Math.random() * 0.35 * amount);
  }
  decal(x: number, size: number): void {
    const d = this.decals[this.decalIdx++ % this.decals.length];
    d.visible = true; d.position.x = x; d.position.y = 0.012; d.scale.set(size, size, 1);
  }
  sparks(x: number, y: number, nx: number, ny: number, n = 8): void {
    for (let i = 0; i < n; i++) this.spawn({ x, y, vx: nx * (2 + Math.random() * 4) + (Math.random() - 0.5) * 3, vy: ny * 2 + Math.random() * 3, max: 0.15 + Math.random() * 0.25, size: 0.025, r: 1, g: 0.8, b: 0.4, grav: -10 });
  }
  splinters(x: number, y: number, dir: number): void {
    for (let i = 0; i < 7; i++) this.spawn({ x, y, vx: dir * (1 + Math.random() * 3), vy: Math.random() * 3, max: 0.6, size: 0.03, r: 0.45, g: 0.32, b: 0.2 });
  }
  dust(x: number, y: number, n = 6): void {
    for (let i = 0; i < n; i++) this.spawn({ x: x + (Math.random() - 0.5) * 0.3, y, vx: (Math.random() - 0.5) * 1.2, vy: Math.random() * 0.8, max: 0.5 + Math.random() * 0.4, size: 0.05, r: 0.35, g: 0.38, b: 0.4, grav: -1 });
  }
  splash(x: number): void {
    for (let i = 0; i < 4; i++) this.spawn({ x, y: 0.02, vx: (Math.random() - 0.5) * 1.5, vy: 1 + Math.random() * 1.5, max: 0.25, size: 0.025, r: 0.6, g: 0.72, b: 0.8, grav: -16 });
  }
  casing(x: number, y: number, dir: number, shell = false): void {
    this.spawn({ x, y, vx: -dir * (1 + Math.random()), vy: 2.5 + Math.random(), max: 1.4, size: shell ? 0.05 : 0.03, r: shell ? 0.7 : 0.75, g: shell ? 0.15 : 0.6, b: shell ? 0.1 : 0.25, stick: true });
  }

  muzzle(x: number, y: number, size = 0.9): void {
    const f = this.flashes.find((q) => q.t <= 0) ?? this.flashes[0];
    f.t = f.max = 0.06; f.mesh.visible = true; f.mesh.position.x = x; f.mesh.position.y = y; f.mesh.scale.setScalar(size);
  }
  tracer(x0: number, y0: number, x1: number, y1: number): void {
    if (this.tracerData.length >= 32) this.tracerData.shift();
    this.tracerData.push({ x0, y0, x1, y1, t: 0.07 });
  }

  dispose(): void { this.root.removeFromParent(); }

  update(dt: number): void {
    let n = 0;
    const alive: P[] = [];
    for (const p of this.ps) {
      p.life += dt;
      if (p.life >= p.max) continue;
      if (!(p.stick && p.y <= 0.01)) { p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
      if (p.y < 0.01) { p.y = 0.01; if (p.stick) { p.vx = 0; p.vy = 0; p.max = Math.max(p.max, p.life + 4); } else { p.vy *= -0.3; p.vx *= 0.6; } }
      alive.push(p);
      const fade = p.stick && p.y <= 0.011 ? 1 : 1 - p.life / p.max;
      this.m.makeScale(p.size, p.size, 1).setPosition(p.x, p.y, p.z);
      this.mesh.setMatrixAt(n, this.m);
      this.mesh.setColorAt(n, this.c.setRGB(p.r * (0.4 + 0.6 * fade), p.g * (0.4 + 0.6 * fade), p.b * (0.4 + 0.6 * fade)));
      n++;
    }
    this.ps = alive;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    for (const f of this.flashes) if (f.t > 0) { f.t -= dt; (f.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, f.t / f.max); if (f.t <= 0) f.mesh.visible = false; }
    const pos = this.tracers.geometry.getAttribute('position') as THREE.BufferAttribute, col = this.tracers.geometry.getAttribute('color') as THREE.BufferAttribute;
    let k = 0;
    this.tracerData = this.tracerData.filter((t) => (t.t -= dt) > 0);
    for (const t of this.tracerData) {
      const a = t.t / 0.07;
      pos.setXYZ(k, t.x0, t.y0, 0); pos.setXYZ(k + 1, t.x1, t.y1, 0);
      col.setXYZ(k, a * 0.4, a * 0.35, a * 0.2); col.setXYZ(k + 1, a, a * 0.85, a * 0.5); k += 2;
    }
    this.tracers.geometry.setDrawRange(0, k);
    pos.needsUpdate = true; col.needsUpdate = true;
  }
}
