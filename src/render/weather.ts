import { NO_REFLECT } from '../art/kit';
import * as THREE from 'three';

/** Rain: a box of streaks that follows the camera, plus ground splash positions for FX. */
export class Rain {
  readonly lines: THREE.LineSegments;
  private drops: Float32Array; private n: number;
  enabled = true;
  splashes: { x: number; z: number }[] = [];
  private center = new THREE.Vector3();

  constructor(scene: THREE.Scene, count = 1700) {
    this.n = count; this.drops = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) this.respawn(i, true);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9fb8c8, transparent: true, opacity: 0.17, depthWrite: false }));
    this.lines.frustumCulled = false; scene.add(this.lines); NO_REFLECT.add(this.lines);
  }
  private respawn(i: number, anywhere: boolean): void {
    const d = this.drops;
    d[i * 3] = this.center.x + (Math.random() - 0.5) * 34;
    d[i * 3 + 1] = anywhere ? Math.random() * 14 : 12 + Math.random() * 3;
    d[i * 3 + 2] = -14 + Math.random() * 16;          // keep streaks off the lens (art: rain is texture, not noise)
  }
  update(dt: number, camX: number): void {
    this.lines.visible = this.enabled; this.splashes.length = 0;
    if (!this.enabled) return;
    this.center.x = camX;
    const d = this.drops, pos = this.lines.geometry.getAttribute('position') as THREE.BufferAttribute, vy = -16, vx = -2.4;
    for (let i = 0; i < this.n; i++) {
      d[i * 3] += vx * dt; d[i * 3 + 1] += vy * dt;
      if (d[i * 3 + 1] < 0 || Math.abs(d[i * 3] - camX) > 18) { if (d[i * 3 + 1] < 0 && i % 6 === 0) this.splashes.push({ x: d[i * 3], z: d[i * 3 + 2] }); this.respawn(i, false); }
      pos.setXYZ(i * 2, d[i * 3], d[i * 3 + 1], d[i * 3 + 2]);
      pos.setXYZ(i * 2 + 1, d[i * 3] - vx * 0.022, d[i * 3 + 1] - vy * 0.022, d[i * 3 + 2]);
    }
    pos.needsUpdate = true;
  }
}
