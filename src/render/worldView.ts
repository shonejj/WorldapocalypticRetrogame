import * as THREE from 'three';
import { animate, utils } from 'animejs';
import type { LevelDef } from '../game/levels/types';
import { PPU, hex, mix, PAL } from './painter';
import {
  paintBillboard, paintBuilding, paintBush, paintCanopy, paintClouds, paintCone2, paintFence,
  paintGlow, paintGround, paintIndustrial, paintOverpass, paintPowerPole, paintRelay, paintSky, paintSkyline, paintStreetLamp,
  paintTree, paintVehicle,
} from './art/environment';
import { spriteFrom, VIEW_HEIGHT, type Renderer } from './renderer';
import { hashSeed } from '../core/rng';

interface Layer { group: THREE.Group; factor: number }

/** Depth bands: parallax factor (1 = moves with gameplay) and z (fog distance). */
export const LAYERS = {
  sky: { z: -500, f: 0 }, clouds: { z: -470, f: 0.02 }, skylineFar: { z: -420, f: 0.07 }, skylineNear: { z: -340, f: 0.14 },
  industrial: { z: -260, f: 0.24 }, overpass: { z: -170, f: 0.38 }, rear: { z: -95, f: 0.62 },
  street: { z: -8, f: 1 }, curb: { z: -3, f: 1 }, gameplay: { z: 0, f: 1 }, ground: { z: 1, f: 1 },
  fg: { z: 9, f: 1.12 }, fgFar: { z: 18, f: 1.32 },
} as const;

export interface Lamp { x: number; on: boolean; intensity: number; flicker: boolean }

export class WorldView {
  readonly layers = new Map<keyof typeof LAYERS, Layer>();
  readonly lamps: Lamp[] = [];
  private clouds: THREE.Mesh[] = [];
  private animations: { revert(): unknown }[] = [];
  private sky: THREE.Mesh;

  constructor(r: Renderer, readonly level: LevelDef) {
    for (const [k, v] of Object.entries(LAYERS)) {
      const g = new THREE.Group(); g.position.z = v.z;
      if (k === 'sky') r.rig.add(g); else r.scene.add(g);
      this.layers.set(k as keyof typeof LAYERS, { group: g, factor: v.f });
    }
    const L = (k: keyof typeof LAYERS) => this.layers.get(k)!.group;
    const seed = level.seed, W = level.width;
    const viewW = VIEW_HEIGHT * 2.4;                         // generous: ultra-wide screens
    const span = (f: number) => W * f + viewW * 1.4;          // layer content width needed

    // ---- sky (follows camera)
    const sky = paintSky(512, 300, seed);
    this.sky = spriteFrom(sky, { ppu: 300 / (VIEW_HEIGHT * 1.6), anchorY: 0.5, fog: false }, { w: VIEW_HEIGHT * 4, h: VIEW_HEIGHT * 1.6 });
    this.sky.position.y = 0.6; L('sky').add(this.sky);
    for (let i = 0; i < 3; i++) {
      const c = spriteFrom(paintClouds(900, 120, seed + i, i === 2), { ppu: 40, anchorY: 0.5, fog: false, alphaTest: 0.05, opacity: 0.55 });
      c.position.set(i * 22 - 10, 3.6 + i * 0.5, 0); L('clouds').add(c); this.clouds.push(c);
    }
    // ---- distant city
    const skyline = (key: 'skylineFar' | 'skylineNear', tone: string, lit: number, hM: number, ppu: number, y: number) => {
      const w = span(LAYERS[key].f) + 20, segs = Math.ceil(w / 40);
      for (let i = 0; i < segs; i++) {
        const m = spriteFrom(paintSkyline(40 * ppu, hM * ppu, seed + i * 13 + key.length, hex(tone), lit), { ppu, anchorX: 0, anchorY: 0 });
        m.position.set(-viewW + i * 40, y, 0); L(key).add(m);
      }
    };
    skyline('skylineFar', '#132433', 0.03, 9, PPU.far / 2, 0.4);
    skyline('skylineNear', '#162b3a', 0.05, 8, PPU.far / 2, 0.2);
    { const w = span(LAYERS.industrial.f) + 20; for (let x = -viewW; x < w; x += 30) { const m = spriteFrom(paintIndustrial(30 * PPU.far / 2, 6 * PPU.far / 2, seed + x), { ppu: PPU.far / 2, anchorX: 0, anchorY: 0 }); m.position.set(x, 0, 0); L('industrial').add(m); } }
    { const w = span(LAYERS.overpass.f) + 20; for (let x = -viewW; x < w; x += 36) { const m = spriteFrom(paintOverpass(36 * PPU.far, 7 * PPU.far, seed + x * 3), { ppu: PPU.far, anchorX: 0, anchorY: 0 }); m.position.set(x, 0, 0); L('overpass').add(m);
      for (let lx = x + 3; lx < x + 36; lx += 9) this.glow(L('overpass'), lx, 7 * 0.72 + 0.5, 1.6, '#ffcf7a', 0.5); } }
    // rear street (darker silhouettes with a few lit windows)
    for (const b of level.rearBuildings) {
      const p = paintBuilding({ kind: b.x % 3 ? 'apartment' : 'ruin', wPx: b.w * PPU.far, hPx: b.h * PPU.far, seed: hashSeed(`rear${b.x}`), litWindows: 0.06 });
      const m = spriteFrom(p, { ppu: PPU.far, anchorX: 0, anchorY: 0, tint: 0x8090a0 });
      m.position.set(b.x * LAYERS.rear.f - 4, 0.2, 0); L('rear').add(m);
    }
    // ---- street buildings (f = 1 so doors line up with interactables)
    for (const b of level.buildings) {
      const p = paintBuilding({ ...b, wPx: b.w * PPU.mid, hPx: b.h * PPU.mid, seed: hashSeed(`${level.id}:${b.x}`) });
      const m = spriteFrom(p, { ppu: PPU.mid, anchorX: 0, anchorY: 0 });
      m.position.set(b.x, 0.25, 0); L('street').add(m);
      if (b.kind === 'store' || b.kind === 'pharmacy') {                 // warm interior spill + sign lamps
        this.glow(L('street'), b.x + b.w * 0.27, 1.4, 4.2, '#f2b060', 0.45);
        this.glow(L('street'), b.x + 1.5, b.w > 0 ? 3.55 : 0, 1.4, '#ffd8a0', 0.5);
        this.glow(L('street'), b.x + b.w - 1.5, 3.55, 1.4, '#ffd8a0', 0.5);
      }
    }
    // gap fillers between buildings: dark alley + chain fence
    // ---- curb vehicles
    for (const v of level.curbVehicles) {
      const m = spriteFrom(paintVehicle(v.kind, hashSeed(`v${v.x}`)), { ppu: PPU.near, anchorY: 0 });
      m.position.set(v.x, 0.12, 0); if (v.flip) m.scale.x = -1; L('curb').add(m);
    }
    // ---- decor (lamps, poles, fences, vegetation, relay)
    for (const d of level.decor) {
      const s = hashSeed(`d${d.x}${d.kind}`);
      if (d.kind === 'lamp') {
        const m = spriteFrom(paintStreetLamp(s), { ppu: PPU.near, anchorX: 0.21, anchorY: 0 }); m.position.set(d.x, 0, -0.5); L('curb').add(m);
        const lamp: Lamp = { x: d.x + 0.6, on: !!d.lit, intensity: d.lit ? 1 : 0, flicker: !!d.flicker };
        this.lamps.push(lamp);
        if (d.lit) {
          const head = this.glow(L('curb'), d.x + 0.68, 5.1, 2.2, '#ffcf7a', 0.9, 0.5);
          const cone = spriteFrom(paintCone2(96, 160, hex('#ffcf7a')), { ppu: 96 / 4.2, anchorY: 1, additive: true, opacity: 0.55 });
          cone.position.set(d.x + 0.68, 5.1, 0.6); L('curb').add(cone);
          const pool = this.glow(L('ground'), d.x + 0.68, 0.0, 4.5, '#ffcf7a', 0.5, 0.2); pool.scale.y = 0.28;
          if (d.flicker) {
            const mats = [head, cone, pool].map((o) => o.material as THREE.MeshBasicMaterial);
            const base = mats.map((m) => m.opacity);
            const state = { k: 1 };
            const run = () => {
              this.animations.push(animate(state, {
                k: [{ to: 0.1, duration: 50 }, { to: 1, duration: 60 }, { to: 0.25, duration: 40 }, { to: 1, duration: 90 }],
                delay: utils.random(800, 4200),
                onUpdate: () => { mats.forEach((m, i) => { m.opacity = base[i] * state.k; }); lamp.intensity = state.k; },
                onComplete: run,
              }));
            };
            run();
          }
        }
      } else if (d.kind === 'pole') {
        const m = spriteFrom(paintPowerPole(s), { ppu: PPU.near, anchorY: 0 }); m.position.set(d.x, 0, -1); L('curb').add(m);
      } else if (d.kind === 'fence') {
        const m = spriteFrom(paintFence(s), { ppu: PPU.near, anchorY: 0 }); m.position.set(d.x, 0, -1.5); L('curb').add(m);
      } else if (d.kind === 'billboard') {
        const m = spriteFrom(paintBillboard(s, d.text ?? ''), { ppu: PPU.mid, anchorY: 0 }); m.position.set(d.x, 0.2, -0.5); L('street').add(m);
      } else if (d.kind === 'bush') {
        const m = spriteFrom(paintBush(s), { ppu: PPU.near, anchorY: 0 }); m.position.set(d.x, 0, -0.4); L('curb').add(m);
      } else if (d.kind === 'tree') {
        const m = spriteFrom(paintTree(s), { ppu: PPU.mid, anchorY: 0 }); m.position.set(d.x, 0.1, -2); L('street').add(m);
      } else if (d.kind === 'relay') {
        const m = spriteFrom(paintRelay(s), { ppu: PPU.near, anchorX: 0.35, anchorY: 0 }); m.position.set(d.x, 0, -1.2); L('curb').add(m);
        const beacon = this.glow(L('curb'), d.x - 0.3 * 0 + (210 - 105) / PPU.near, 11.2, 1.2, '#ff3a2a', 1, 1.4);
        this.animations.push(animate(beacon.material as THREE.MeshBasicMaterial, { opacity: [1, 0.1], duration: 900, loop: true, alternate: true, ease: 'inOutSine' }));
      }
    }
    // ---- ground strip (tiled)
    for (let x = -12; x < W + 12; x += 16) {
      const g = spriteFrom(paintGround(16 * PPU.near, 1.6 * PPU.near, seed + x), { ppu: PPU.near, anchorX: 0, anchorY: 1 });
      g.position.set(x, 0.16, 0); L('ground').add(g);
    }
    // ---- foreground vegetation + debris silhouettes (darkened)
    const fgSpan = span(LAYERS.fg.f);
    for (let x = -10, i = 0; x < fgSpan; x += 9 + ((i * 29) % 11), i++) {
      const m = spriteFrom(paintBush(seed + i * 7, 180, 70, false), { ppu: PPU.near, anchorY: 0, tint: 0x6f7f72 });
      m.position.set(x, -1.05, 0); L('fg').add(m);
    }
    const fgFarSpan = span(LAYERS.fgFar.f);
    for (let x = -10, i = 0; x < fgFarSpan; x += 30 + ((i * 17) % 16), i++) {
      if (i % 2 === 0) { const m = spriteFrom(paintCanopy(seed + i, 520, 130), { ppu: PPU.near * 0.75, anchorY: 1, tint: 0x4a5a52 }); m.position.set(x, 2.25 + VIEW_HEIGHT / 2 + 0.3, 0); L('fgFar').add(m); }
      const b = spriteFrom(paintBush(seed + i * 3, 200, 80, true), { ppu: PPU.near * 0.8, anchorY: 0, tint: 0x45524c }); b.position.set(x + 12, -1.35, 0); L('fgFar').add(b);
    }
  }

  /** Additive glow sprite. */
  glow(parent: THREE.Object3D, x: number, y: number, size: number, color: string, opacity: number, z = 0.3): THREE.Mesh {
    const key = color;
    let tex = glowCache.get(key);
    if (!tex) { tex = paintGlow(64, mix(hex(color), PAL.white, 0.1), 2.2).texture(); tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; glowCache.set(key, tex); }
    const m = spriteFrom(tex, { ppu: 1, anchorY: 0.5, additive: true, opacity }, { w: size, h: size });
    m.position.set(x, y, z); parent.add(m);
    return m;
  }

  /** 0 (dark) … 1 (under a working lamp) at world x. */
  lightAt(x: number): number {
    let l = 0.15;
    for (const lamp of this.lamps) if (lamp.on) l = Math.max(l, lamp.intensity * Math.max(0, 1 - Math.abs(lamp.x - x) / 3.4));
    return l;
  }

  update(dt: number, camX: number): void {
    for (const layer of this.layers.values()) if (layer.factor !== 0) layer.group.position.x = camX * (1 - layer.factor);
    this.clouds.forEach((c, i) => { c.position.x -= dt * (0.15 + i * 0.08); if (c.position.x < -30) c.position.x += 66; });
  }

  dispose(): void {
    for (const a of this.animations) a.revert();
    for (const layer of this.layers.values()) {
      layer.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { const mat = m.material as THREE.MeshBasicMaterial; if (mat.map && ![...glowCache.values()].includes(mat.map)) mat.map.dispose(); mat.dispose(); } });
      layer.group.removeFromParent();
    }
  }
}

const glowCache = new Map<string, THREE.Texture>();
