import * as THREE from 'three';
import { NO_REFLECT } from '../art/kit';
import { fbm } from '../core/math';

/**
 * Fog you can see into (art direction): soft, drifting fog sheets at fixed depths between the
 * layers of the world. FogExp2 alone tints distance evenly; these sheets put *shape* in the air —
 * each depth layer sits behind one more veil, so buildings, trees and pylons step back as
 * progressively paler silhouettes. Four textured quads that follow the camera: negligible cost.
 */
const DEPTHS: [z: number, height: number, alpha: number, drift: number][] = [[3.4, 1.3, 0.12, 0.05], [-6.8, 9, 0.3, 0.025], [-15, 16, 0.5, 0.015], [-30, 26, 0.65, 0.008], [-52, 40, 0.8, 0.004]];
const SPAN = 120, TILE = 40;

function texture(): THREE.CanvasTexture {
  const w = 256, h = 128, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!, img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // tileable in x: blend two noise fields across the seam
    const u = x / w, n = fbm(u * 6, y / 22, 4, 3) * (1 - u) + fbm((u - 1) * 6, y / 22, 4, 3) * u;
    const v = y / h, body = Math.min(1, v * 1.6) * (0.55 + 0.45 * Math.min(1, v * 3)), top = Math.max(0, Math.min(1, (v - 0.02) * 4));
    const a = Math.max(0, Math.min(1, (n * 1.5 - 0.25) * body + v * v * 0.55)) * top;
    const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; t.repeat.set(SPAN / TILE, 1); return t;
}

export class Haze {
  private sheets: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; alpha: number; drift: number; z: number }[] = [];
  private t = 0; private amount = 0;
  constructor(scene: THREE.Scene) {
    const tex = texture();
    for (const [z, h, alpha, drift] of DEPTHS) {
      const map = tex.clone(); map.needsUpdate = true;
      const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, fog: false, opacity: 0 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(SPAN, h).translate(0, h / 2 - 0.15, 0), mat);
      m.position.z = z; m.renderOrder = z > 0 ? 6 : 1; m.frustumCulled = false;
      scene.add(m); NO_REFLECT.add(m); this.sheets.push({ m, mat, alpha, drift, z });
    }
  }
  set(color: number, amount: number): void { this.amount = amount; for (const s of this.sheets) { s.mat.color.setHex(color); s.mat.opacity = s.alpha * amount; s.m.visible = amount > 0.01; } }
  update(dt: number, camX: number): void {
    if (this.amount <= 0.01) return;
    this.t += dt;
    for (const s of this.sheets) { s.m.position.x = camX; s.mat.map!.offset.x = camX / TILE + this.t * s.drift; }
  }
  dispose(): void { for (const s of this.sheets) { NO_REFLECT.delete(s.m); s.m.removeFromParent(); s.m.geometry.dispose(); s.mat.map?.dispose(); s.mat.dispose(); } }
}
