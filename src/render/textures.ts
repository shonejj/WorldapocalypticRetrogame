import * as THREE from 'three';
import { Painter, hex, mix, PAL, type RGB } from './painter';

/** Small procedural helper textures (glows, streaks, mist) — the art itself is painted. */
const cache = new Map<string, THREE.Texture>();
const smooth = (t: THREE.Texture) => { t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; };

export function glowTexture(color: string, falloff = 2.2): THREE.Texture {
  const key = `g${color}${falloff}`;
  let t = cache.get(key);
  if (!t) {
    const p = new Painter(64, 64, 1), c = mix(hex(color), PAL.white, 0.12);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const d = Math.hypot(x + 0.5 - 32, y + 0.5 - 32) / 32; if (d < 1) p.px(x, y, c, Math.pow(1 - d, falloff) * 255); }
    t = smooth(p.texture()); cache.set(key, t);
  }
  return t;
}

/** Vertical light streak for reflections of lamps on the wet street. */
export function streakTexture(): THREE.Texture {
  let t = cache.get('streak');
  if (!t) {
    const p = new Painter(16, 128, 2), c: RGB = hex('#ffd9a0');
    for (let y = 0; y < 128; y++) for (let x = 0; x < 16; x++) {
      const dx = Math.abs(x + 0.5 - 8) / 8, fy = 1 - y / 128, wob = 0.65 + 0.35 * Math.sin(y * 0.9 + x);
      p.px(x, y, c, Math.max(0, (1 - dx * dx) * fy * fy * wob) * 200);
    }
    t = smooth(p.texture()); cache.set('streak', t);
  }
  return t;
}

/** Soft tileable mist. */
export function mistTexture(): THREE.Texture {
  let t = cache.get('mist');
  if (!t) {
    const W = 512, H = 128, p = new Painter(W, H, 9), c = hex('#a9bfcc');
    const field = new Float32Array(W * H);
    for (let n = 0; n < 90; n++) {
      const cx = p.rng.range(0, W), cy = p.rng.range(H * 0.25, H * 0.8), rx = p.rng.range(30, 110), ry = p.rng.range(10, 28);
      for (let y = 0; y < H; y++) for (let x = -W; x < 2 * W; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d >= 1) continue;
        const xi = ((x % W) + W) % W; field[y * W + xi] += (1 - d) * 0.35;
      }
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) p.px(x, y, c, Math.min(1, field[y * W + x]) * 255 * Math.sin((y / H) * Math.PI));
    t = smooth(p.texture()); t.wrapS = THREE.RepeatWrapping; cache.set('mist', t);
  }
  return t;
}
