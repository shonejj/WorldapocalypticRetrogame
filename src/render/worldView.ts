import * as THREE from 'three';
import { animate, utils } from 'animejs';
import type { LevelDef, Placement } from '../game/levels/types';
import { KIT, PX_PER_M, TILED, type KitLight, type LayerFile } from '../game/levels/kit';
import { LIGHTS, litMaterial, type Light } from './lighting';
import { glowTexture, mistTexture, streakTexture } from './textures';
import { VIEW_HEIGHT, CAMERA_Y, type Renderer } from './renderer';
import type { Assets } from './assets';

const DEPTH = { street: { f: 0.9, z: -12 }, curb: { f: 1, z: -3 }, fg: { f: 1.22, z: 12 } } as const;

interface Layer { group: THREE.Group; factor: number }
interface MovingLight { light: Light; baseX: number; factor: number; glow?: THREE.Mesh; streak?: THREE.Mesh }

/**
 * Painted 2.5D world: the source layer art is kit-bashed into a long street and
 * spread across depth bands with parallax. Lights from the art (lamps, shop
 * windows) become real scene lights for characters, props and the wet street.
 */
export class WorldView {
  private layers: Layer[] = [];
  readonly lights: MovingLight[] = [];
  private animations: { revert(): unknown }[] = [];
  private mists: THREE.Mesh[] = [];
  private sky: THREE.Mesh[] = [];
  private nextLightning = 14;
  private geos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];
  onLightning: (() => void) | null = null;

  constructor(private r: Renderer, readonly level: LevelDef, private assets: Assets) {
    const viewW = VIEW_HEIGHT * 2.6;
    // ---- tiled bands (sky, city, mid, ground, vegetation, extreme foreground)
    for (const t of TILED) {
      const g = this.layer(t.factor, t.z);
      const size = assets.layerSize[t.layer], rect = t.rect ?? [0, 0, size.w, size.h], sc = t.scale ?? 1;
      const w = ((rect[2] - rect[0]) * sc) / PX_PER_M;
      const from = -viewW, to = level.width * t.factor + viewW * 1.2;
      let i = 0;
      for (let x = from; x < to; x += w, i++) {
        const m = this.quad(t.layer, rect, t.ground, sc, !!t.lit, i % 2 === 1, t.dim ?? 1);
        m.position.set(x, t.y ?? 0, 0); g.add(m);
        if (t.layer === '01_distant_skyline') this.sky.push(m);
      }
    }
    // ---- kit placements
    const place = (p: Placement, depth: keyof typeof DEPTH) => {
      const k = KIT[p.piece], d = DEPTH[depth];
      const g = this.layerFor(d.f, d.z);
      const s = k.scale ?? 1;
      const m = this.quad(k.layer, k.rect, k.ground, s, true, !!p.flip, depth === 'fg' ? 0.32 : 1);
      const w = ((k.rect[2] - k.rect[0]) * s) / PX_PER_M;
      m.position.set(p.x * d.f, p.y ?? 0, 0);
      g.add(m);
      for (const L of k.lights ?? []) this.addLight(L, p, k.rect, s, w, d.f, g);
    };
    for (const p of level.street) place(p, 'street');
    for (const p of level.curb) place(p, 'curb');
    for (const p of level.foreground) place(p, p.depth === 'fg' ? 'fg' : 'curb');
    // ---- drifting ground mist (behind and in front of the walk line)
    for (const [z, y, op, h] of [[-6, 0.55, 0.16, 1.6], [2.2, -0.15, 0.1, 1.1]] as const) {
      const mat = new THREE.MeshBasicMaterial({ map: mistTexture(), transparent: true, opacity: op, depthWrite: false, fog: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(VIEW_HEIGHT * 3.2, h), mat);
      mesh.position.set(0, y - CAMERA_Y, z); r.rig.add(mesh); this.mists.push(mesh); this.mats.push(mat);   // rig space → ground level
    }
    // wet street below the painted ground strip: dark water that catches reflections
    {
      const c = document.createElement('canvas'); c.width = 4; c.height = 64;
      const g2 = c.getContext('2d')!; const grd = g2.createLinearGradient(0, 0, 0, 64);
      grd.addColorStop(0, '#16222c'); grd.addColorStop(0.4, '#0d161d'); grd.addColorStop(1, '#05090c');
      g2.fillStyle = grd; g2.fillRect(0, 0, 4, 64);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const mat = litMaterial(tex, { lit: 0.6, alphaTest: 0 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(VIEW_HEIGHT * 3.4, 1.4), mat);
      mesh.position.set(0, -0.28 - 0.7 - CAMERA_Y, -1.5); r.rig.add(mesh); this.mists.push(mesh); this.mats.push(mat);
    }
  }

  private layer(factor: number, z: number): THREE.Group {
    const g = new THREE.Group(); g.position.z = z; this.r.scene.add(g);
    this.layers.push({ group: g, factor });
    return g;
  }
  private layerFor(factor: number, z: number): THREE.Group {
    return this.layers.find((l) => l.factor === factor && l.group.position.z === z)?.group ?? this.layer(factor, z);
  }

  /** Quad showing a rectangle of a layer image; origin = left edge on the walk line. */
  private quad(layer: LayerFile, rect: [number, number, number, number], ground: number, scale: number, lit: boolean, flip: boolean, dim: number): THREE.Mesh {
    const tex = this.assets.layers[layer], { w: W, h: H } = this.assets.layerSize[layer];
    const [x0, y0, x1, y1] = rect, k = scale / PX_PER_M;
    const w = (x1 - x0) * k, top = (ground - y0) * k, bottom = -(y1 - ground) * k;
    const g = new THREE.PlaneGeometry(w, top - bottom);
    g.translate(w / 2, (top + bottom) / 2, 0);
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    const u0 = x0 / W, u1 = x1 / W, v0 = 1 - y1 / H, v1 = 1 - y0 / H;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      uv.setXY(i, flip ? u1 - u * (u1 - u0) : u0 + u * (u1 - u0), v0 + v * (v1 - v0));
    }
    const mat = lit ? litMaterial(tex, { tint: new THREE.Color(dim, dim, dim).getHex(), alphaTest: 0.04 })
      : new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.04, color: new THREE.Color(dim, dim, dim) });
    this.geos.push(g); this.mats.push(mat);
    return new THREE.Mesh(g, mat);
  }

  private addLight(L: KitLight, p: Placement, rect: number[], s: number, w: number, factor: number, g: THREE.Group): void {
    const k = s / PX_PER_M;
    const k0 = KIT[p.piece];
    const lx = (p.flip ? w - L.x * k : L.x * k), ly = (k0.ground - (rect[1] + L.y)) * k;
    const light: Light = { x: 0, y: ly, radius: L.radius, intensity: L.intensity, color: new THREE.Color(L.color) };
    const ml: MovingLight = { light, baseX: p.x * factor + lx, factor };
    if (L.glow) {
      const mat = new THREE.MeshBasicMaterial({ map: glowTexture(L.color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.85 });
      ml.glow = new THREE.Mesh(new THREE.PlaneGeometry(L.glow, L.glow), mat);
      ml.glow.position.set(p.x * factor + lx, ly, 0.5); g.add(ml.glow); this.mats.push(mat);
    }
    if (L.intensity > 0.75 && ly > 0.5) {         // reflection of the light on the wet street
      const mat = new THREE.MeshBasicMaterial({ map: streakTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.55 });
      ml.streak = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.1), mat);
      ml.streak.geometry.translate(0, -0.55, 0);
      ml.streak.position.set(0, -0.02, -1.1); this.r.scene.add(ml.streak); this.mats.push(mat);
    }
    if (L.flicker) {
      const base = L.intensity, gm = ml.glow?.material as THREE.MeshBasicMaterial | undefined, state = { k: 1 };
      const run = () => this.animations.push(animate(state, {
        k: [{ to: 0.15, duration: 50 }, { to: 1, duration: 70 }, { to: 0.35, duration: 40 }, { to: 1, duration: 110 }],
        delay: utils.random(900, 5200),
        onUpdate: () => { light.intensity = base * state.k; if (gm) gm.opacity = 0.85 * state.k; },
        onComplete: run,
      }));
      run();
    }
    if (L.intensity > 0) this.lights.push(ml);
    else if (ml.glow) this.lights.push({ ...ml, light: { ...light, intensity: 0 } });
  }

  /** 0 (dark) … 1 (under a light) — used by infected perception. */
  lightAt(x: number, y = 1): number {
    let l = 0.12;
    for (const { light } of this.lights) {
      if (light.intensity <= 0) continue;
      const d = Math.hypot(light.x - x, (light.y - y) * 0.8) / light.radius;
      if (d < 1) l = Math.max(l, light.intensity * (1 - d));
    }
    return Math.min(1, l);
  }

  update(dt: number, camX: number, time: number): void {
    for (const l of this.layers) l.group.position.x = camX * (1 - l.factor);
    for (const ml of this.lights) {
      ml.light.x = ml.baseX + camX * (1 - ml.factor);
      if (ml.streak) { ml.streak.position.x = ml.light.x; (ml.streak.material as THREE.MeshBasicMaterial).opacity = 0.5 * Math.min(1, ml.light.intensity); }
    }
    this.mists.forEach((m, i) => { if (i > 1) return; const map = (m.material as THREE.MeshBasicMaterial).map!; map.offset.x = (camX * (i ? 0.05 : 0.02) + time * (i ? 0.012 : 0.006)) % 1; });
    LIGHTS.uTime.value = time;
    // lightning: brief blue-white ambient flashes, thunder follows
    this.nextLightning -= dt;
    if (this.nextLightning <= 0) {
      this.nextLightning = utils.random(18, 40);
      const amb = LIGHTS.uAmbient.value, base = { r: amb.r, g: amb.g, b: amb.b }, k = { v: 0 };
      this.animations.push(animate(k, {
        v: [{ to: 1, duration: 60 }, { to: 0.2, duration: 90 }, { to: 0.8, duration: 50 }, { to: 0, duration: 600, ease: 'outQuad' }],
        onUpdate: () => {
          amb.setRGB(base.r + k.v * 0.9, base.g + k.v * 0.95, base.b + k.v * 1.05);
          for (const s of this.sky) (s.material as THREE.MeshBasicMaterial).color.setScalar(0.9 + k.v * 1.2);
        },
      }));
      this.onLightning?.();
    }
  }

  allLights(): Light[] { return this.lights.map((l) => l.light); }

  dispose(): void {
    for (const a of this.animations) a.revert();
    for (const l of this.layers) l.group.removeFromParent();
    for (const ml of this.lights) ml.streak?.removeFromParent();
    for (const m of this.mists) m.removeFromParent();
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }
}

export { CAMERA_Y };
