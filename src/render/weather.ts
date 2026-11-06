import * as THREE from 'three';
import { VIEW_HEIGHT } from './renderer';

/** Slanted rain streaks in two depth sheets + ground splashes. Lives in camera-rig space. */
export class Rain {
  readonly group = new THREE.Group();
  private sheets: { lines: THREE.LineSegments; drops: Float32Array; speed: number; len: number; w: number }[] = [];
  enabled = true;
  splashX: number[] = [];

  constructor(rig: THREE.Object3D) {
    rig.add(this.group);
    this.addSheet(650, 0.42, 16, 0.55, 4, 0x9fc4d8);      // near, in front of gameplay
    this.addSheet(900, 0.2, 12, 0.3, -40, 0x6f8fa3);      // far, behind street
  }

  private addSheet(n: number, opacity: number, speed: number, len: number, z: number, color: number): void {
    const w = VIEW_HEIGHT * 3.2;
    const drops = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { drops[i * 2] = (Math.random() - 0.5) * w; drops[i * 2 + 1] = Math.random() * VIEW_HEIGHT * 1.2; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, fog: false }));
    lines.frustumCulled = false; lines.position.z = z;
    this.group.add(lines);
    this.sheets.push({ lines, drops, speed, len, w });
  }

  /** camY = camera centre y; groundY in world. */
  update(dt: number, camY: number): void {
    this.group.visible = this.enabled;
    this.splashX.length = 0;
    if (!this.enabled) return;
    const slant = -0.22;
    for (const s of this.sheets) {
      const pos = s.lines.geometry.getAttribute('position') as THREE.BufferAttribute;
      const n = s.drops.length / 2, bottom = -VIEW_HEIGHT / 2 - 0.5 + (0 - camY + VIEW_HEIGHT / 2) * 0, top = VIEW_HEIGHT / 2 + 1;
      for (let i = 0; i < n; i++) {
        let x = s.drops[i * 2], y = s.drops[i * 2 + 1];
        y -= s.speed * dt; x += slant * s.speed * dt;
        const groundRel = -camY;                               // world y=0 in rig space
        if (y < Math.max(bottom, groundRel) ) {
          if (s.speed > 14 && y < groundRel + 0.1 && Math.random() < 0.25) this.splashX.push(x);
          y = top + Math.random() * 2; x = (Math.random() - 0.5) * s.w;
        }
        if (x < -s.w / 2) x += s.w;
        s.drops[i * 2] = x; s.drops[i * 2 + 1] = y;
        pos.setXYZ(i * 2, x, y, 0); pos.setXYZ(i * 2 + 1, x - slant * s.len, y + s.len, 0);
      }
      pos.needsUpdate = true;
    }
  }
}
