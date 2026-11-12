import * as THREE from 'three';
import type { LightSpot } from '../art/kit';
import { noise2 } from '../core/math';

/**
 * Light pool (threejs-materials-lighting + performance-optimization):
 * the level declares dozens of LightSpots; only POOL_POINT point lights and POOL_SPOT spot
 * lights exist. Every frame they are reassigned to the most relevant spots near the camera.
 * The number of lights never changes, so materials never recompile. Flicker is per-spot noise.
 */
export const POOL_POINT = 8, POOL_SPOT = 2;

export class LightPool {
  readonly group = new THREE.Group();
  private points: THREE.PointLight[] = [];
  private spots: THREE.SpotLight[] = [];
  spots_: LightSpot[] = [];
  readonly moon: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly key: THREE.DirectionalLight;
  private flash = 0;
  /** mood-driven base intensities (lightning adds on top) */
  readonly base = { hemi: 1.1, moon: 1.1 };
  /** Dynamic one-frame lights (muzzle flashes, fires) — added on top of the pool. */
  readonly transient: { x: number; y: number; z: number; color: number; intensity: number; distance: number; t: number }[] = [];
  private flashLight: THREE.PointLight;

  constructor(scene: THREE.Scene, shadows: boolean) {
    this.hemi = new THREE.HemisphereLight(0x4d6d86, 0x1d1913, 1.1);
    this.moon = new THREE.DirectionalLight(0xa9c4dc, 1.1);
    this.moon.position.set(-12, 30, 18);
    this.moon.castShadow = shadows;
    this.moon.shadow.mapSize.set(1024, 1024);
    const c = this.moon.shadow.camera; c.left = -22; c.right = 22; c.top = 16; c.bottom = -10; c.near = 1; c.far = 80;
    this.moon.shadow.bias = -0.0005; this.moon.shadow.normalBias = 0.03;
    // soft frontal key from the camera side: keeps characters readable against bright backgrounds (art brief: rim/readability)
    this.key = new THREE.DirectionalLight(0xc8d8e8, 0.9); this.key.position.set(-4, 6, 20);
    this.group.add(this.hemi, this.moon, this.moon.target, this.key, this.key.target);
    for (let i = 0; i < POOL_POINT; i++) { const p = new THREE.PointLight(0xffffff, 0, 10, 2); this.points.push(p); this.group.add(p); }
    for (let i = 0; i < POOL_SPOT; i++) {
      const s = new THREE.SpotLight(0xffc887, 0, 16, 0.75, 0.6, 1.6);
      s.castShadow = false;   // one shadow map (the moon) is the budget: every shadowed light re-renders the scene s.shadow.bias = -0.0008;
      this.spots.push(s); this.group.add(s, s.target);
    }
    this.flashLight = new THREE.PointLight(0xffd8a0, 0, 9, 2); this.group.add(this.flashLight);
    scene.add(this.group);
  }

  set(spots: LightSpot[]): void { this.spots_ = spots; }
  lightning(v: number): void { this.flash = v; }

  update(camX: number, time: number): void {
    // moon shadow frustum follows the camera
    this.moon.position.set(camX + 10, 26, -22); this.moon.target.position.set(camX, 0, 0);    // back light: rims silhouettes, shadows fall toward camera
    this.key.position.set(camX - 4, 6, 20); this.key.target.position.set(camX, 1, 0);
    this.moon.intensity = this.base.moon + this.flash * 4; this.hemi.intensity = this.base.hemi + this.flash * 1.5;
    const near = this.spots_.filter((s) => s.on !== false && Math.abs(s.x - camX) < 22)
      .sort((a, b) => Math.abs(a.x - camX) / a.intensity - Math.abs(b.x - camX) / b.intensity);
    const cones = near.filter((s) => s.cone), rest = near.filter((s) => !s.cone);
    this.spots.forEach((L, i) => {
      const s = cones[i];
      if (!s) { L.intensity = 0; return; }
      L.position.set(s.x, s.y, s.z); if (s.aim) L.target.position.set(s.aim.x, s.aim.y, s.aim.z); else L.target.position.set(s.x + 0.3, 0, s.z + 1.2); L.angle = s.angle ?? 0.75;
      L.color.setHex(s.color); L.intensity = s.intensity * 2.2 * this.flick(s, time); L.distance = s.distance * 1.3;
    });
    const pointsList = [...cones.slice(POOL_SPOT), ...rest];
    this.points.forEach((L, i) => {
      const s = pointsList[i];
      if (!s) { L.intensity = 0; return; }
      L.position.set(s.x, s.y, s.z); L.color.setHex(s.color); L.intensity = s.intensity * this.flick(s, time); L.distance = s.distance;
    });
    // strongest transient (muzzle flash) drives a dedicated light
    let best = null as (typeof this.transient)[number] | null;
    for (let i = this.transient.length - 1; i >= 0; i--) { const t = this.transient[i]; t.t -= 1 / 60; if (t.t <= 0) this.transient.splice(i, 1); else if (!best || t.intensity > best.intensity) best = t; }
    if (best) { this.flashLight.position.set(best.x, best.y, best.z); this.flashLight.color.setHex(best.color); this.flashLight.intensity = best.intensity; this.flashLight.distance = best.distance; }
    else this.flashLight.intensity = 0;
  }

  private flick(s: LightSpot, t: number): number {
    if (!s.flicker) return 1;
    const n = noise2(t * 7, s.x * 3.1);
    return n > 0.82 ? 0.15 : n > 0.75 ? 0.6 : 1;
  }

  /** 0..1 how lit a point is (used by infected perception). */
  lightAt(x: number, y = 1, z = 0): number {
    let l = 0.08 + this.flash;
    for (const s of this.spots_) {
      if (s.on === false) continue;
      const d = Math.hypot(s.x - x, (s.y - y) * 0.6, (s.z - z) * 0.8);
      if (d < s.distance) l = Math.max(l, (1 - d / s.distance) * Math.min(1, s.intensity / 8));
    }
    return Math.min(1, l);
  }
}
