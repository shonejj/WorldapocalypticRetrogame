import * as THREE from 'three';
import { Rng } from '../core/math';

/**
 * Procedural PBR texture factory (create-game-assets: code-authored source art).
 * Each generator fills a tileable height field + albedo + roughness; the normal map is
 * derived from height with a wrapped Sobel filter. Colour maps are sRGB, data maps linear
 * (threejs-materials-lighting pitfall). Results are cached per key.
 */
export interface PbrMaps { map: THREE.Texture; normalMap?: THREE.Texture; roughnessMap?: THREE.Texture; alpha?: boolean }

class Field {
  readonly h: Float32Array; readonly c: Float32Array; readonly r: Float32Array; readonly a: Float32Array;
  constructor(readonly n: number) { const s = n * n; this.h = new Float32Array(s); this.c = new Float32Array(s * 3); this.r = new Float32Array(s).fill(0.8); this.a = new Float32Array(s).fill(1); }
  i(x: number, y: number): number { const n = this.n; return (((y % n) + n) % n) * n + (((x % n) + n) % n); }
  set(x: number, y: number, rgb: readonly number[], h?: number, r?: number): void {
    const i = this.i(x, y); this.c[i * 3] = rgb[0]; this.c[i * 3 + 1] = rgb[1]; this.c[i * 3 + 2] = rgb[2];
    if (h !== undefined) this.h[i] = h; if (r !== undefined) this.r[i] = r;
  }
}

/** Tileable value noise with integer period. */
function tnoise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const hsh = (i: number, j: number) => {
    i = ((i % period) + period) % period; j = ((j % period) + period) % period;
    let n = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed + 1, 1274126177);
    n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hsh(xi, yi), b = hsh(xi + 1, yi), c = hsh(xi, yi + 1), d = hsh(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function tfbm(x: number, y: number, period: number, oct: number, seed: number): number {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let o = 0; o < oct; o++) { s += amp * tnoise(x * f, y * f, period * f, seed + o * 31); norm += amp; amp *= 0.5; f *= 2; }
  return s / norm;
}

const cache = new Map<string, PbrMaps>();

function finish(f: Field, opts: { normal?: number; repeat?: number; alpha?: boolean } = {}): PbrMaps {
  const n = f.n;
  const toTex = (fill: (d: Uint8ClampedArray) => void, srgb: boolean) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = n;
    const g = cv.getContext('2d')!; const img = g.createImageData(n, n); fill(img.data); g.putImageData(img, 0, 0);
    // the scene renders at ≈360 rows: half-resolution maps look identical and use a quarter of the VRAM
    const h = Math.max(64, n >> 1), small = document.createElement('canvas'); small.width = small.height = h;
    const sg = small.getContext('2d')!; sg.imageSmoothingQuality = 'high'; sg.drawImage(cv, 0, 0, h, h);
    const t = new THREE.CanvasTexture(small); t.userData.keep = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return t;
  };
  const map = toTex((d) => { for (let i = 0; i < n * n; i++) { d[i * 4] = f.c[i * 3] * 255; d[i * 4 + 1] = f.c[i * 3 + 1] * 255; d[i * 4 + 2] = f.c[i * 3 + 2] * 255; d[i * 4 + 3] = f.a[i] * 255; } }, true);
  const out: PbrMaps = { map, alpha: opts.alpha };
  if (opts.normal) {
    const s = opts.normal;
    out.normalMap = toTex((d) => {
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const dx = (f.h[f.i(x + 1, y - 1)] + 2 * f.h[f.i(x + 1, y)] + f.h[f.i(x + 1, y + 1)]) - (f.h[f.i(x - 1, y - 1)] + 2 * f.h[f.i(x - 1, y)] + f.h[f.i(x - 1, y + 1)]);
        const dy = (f.h[f.i(x - 1, y + 1)] + 2 * f.h[f.i(x, y + 1)] + f.h[f.i(x + 1, y + 1)]) - (f.h[f.i(x - 1, y - 1)] + 2 * f.h[f.i(x, y - 1)] + f.h[f.i(x + 1, y - 1)]);
        let nx = -dx * s, ny = dy * s, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        const i = (y * n + x) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
      }
    }, false);
  }
  out.roughnessMap = toTex((d) => { for (let i = 0; i < n * n; i++) { const v = f.r[i] * 255; d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255; } }, false);
  return out;
}

const mixc = (a: readonly number[], b: readonly number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a: readonly number[], k: number) => [a[0] * k, a[1] * k, a[2] * k];
const hex = (h: string) => { const v = parseInt(h.slice(1), 16); return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]; };

function gen(key: string, make: () => PbrMaps): PbrMaps { let t = cache.get(key); if (!t) { t = make(); cache.set(key, t); } return t; }

// ---------------------------------------------------------------- surfaces
export function brick(tint = '#6b3f33', seed = 1): PbrMaps {
  return gen(`brick${tint}${seed}`, () => {
    const N = 512, f = new Field(N), R = new Rng(seed), base = hex(tint), mortar = [0.36, 0.34, 0.31];
    const rows = 16, bw = N / 4, bh = N / rows;
    const tones: number[] = []; for (let i = 0; i < 4 * rows * 2; i++) tones.push(0.75 + R.next() * 0.45);
    for (let y = 0; y < N; y++) {
      const row = Math.floor(y / bh), off = row % 2 ? bw / 2 : 0, yy = y % bh;
      for (let x = 0; x < N; x++) {
        const xx = (x + off) % bw, col = Math.floor(((x + off) % N) / bw);
        const gap = yy < 3 || xx < 3;
        const n = tfbm(x / 32, y / 32, N / 32, 4, seed), fine = tnoise(x / 3, y / 3, N / 3, seed + 5);
        const grime = Math.max(0, tfbm(x / 128, y / 128, 4, 3, seed + 9) - 0.45) * 1.6;
        if (gap) f.set(x, y, mul(mortar, 0.85 + n * 0.3 - grime * 0.3), 0.1 + fine * 0.05, 0.95);
        else {
          const t = tones[(row * 4 + col) % tones.length];
          const edge = Math.min(xx, yy, bw - xx, bh - yy) < 6 ? 0.88 : 1;
          f.set(x, y, mul(mixc(mul(base, t), [0.18, 0.2, 0.17], grime * 0.6), (0.82 + n * 0.32) * edge), 0.6 + n * 0.3 + fine * 0.1, 0.86 + fine * 0.1);
        }
      }
    }
    return finish(f, { normal: 2.2 });
  });
}

export function concrete(tint = '#6a6e6c', seed = 2): PbrMaps {
  return gen(`concrete${tint}${seed}`, () => {
    const N = 512, f = new Field(N), base = hex(tint), R = new Rng(seed);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const n = tfbm(x / 64, y / 64, N / 64, 5, seed), fine = tnoise(x / 2, y / 2, N / 2, seed + 3);
      const stain = Math.max(0, tfbm(x / 160, y / 90, 3, 3, seed + 11) - 0.5) * 2;
      const streak = Math.max(0, tnoise(x / 6, 0, N / 6, seed + 21) - 0.6) * 2.4 * (0.4 + 0.6 * (y / N));
      f.set(x, y, mul(mixc(base, [0.16, 0.17, 0.14], Math.min(1, stain * 0.8 + streak * 0.5)), 0.78 + n * 0.4 + fine * 0.06), n * 0.4 + fine * 0.15, 0.82 + fine * 0.15 - stain * 0.1);
    }
    for (let k = 0; k < 7; k++) {         // hairline cracks
      let x = R.next() * N, y = R.next() * N, a = R.next() * Math.PI * 2;
      for (let s = 0; s < 120; s++) { a += (R.next() - 0.5) * 0.6; x += Math.cos(a); y += Math.sin(a); const i = f.i(Math.floor(x), Math.floor(y)); f.h[i] -= 0.35; f.c[i * 3] *= 0.55; f.c[i * 3 + 1] *= 0.55; f.c[i * 3 + 2] *= 0.55; }
    }
    return finish(f, { normal: 1.6 });
  });
}

export function plaster(tint = '#8a8170', seed = 3): PbrMaps {
  return gen(`plaster${tint}${seed}`, () => {
    const N = 512, f = new Field(N), base = hex(tint), brickC = hex('#6b3f33');
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const n = tfbm(x / 48, y / 48, N / 48, 5, seed), peel = tfbm(x / 120, y / 120, 4, 4, seed + 7);
      const exposed = peel > 0.77;
      const streak = Math.max(0, tnoise(x / 5, y / 400, N / 5, seed + 13) - 0.55) * 2 * (y / N);
      if (exposed) {
        const by = Math.floor(y / 24), bx = Math.floor((x + (by % 2) * 24) / 48), gap = y % 24 < 3 || (x + (by % 2) * 24) % 48 < 3;
        f.set(x, y, gap ? [0.3, 0.29, 0.27] : mul(brickC, 0.7 + ((bx * 7 + by * 13) % 5) * 0.08), gap ? 0.0 : 0.15, 0.92);
      } else f.set(x, y, mul(mixc(base, [0.2, 0.2, 0.18], Math.min(1, streak)), 0.85 + n * 0.3), 0.4 + n * 0.2 + (peel > 0.58 ? 0.15 : 0), 0.9);
    }
    return finish(f, { normal: 2 });
  });
}

/** Wet asphalt: low-frequency puddle mask drives darker colour and near-mirror roughness. */
export function asphalt(seed = 4): PbrMaps {
  return gen(`asphalt${seed}`, () => {
    const N = 512, f = new Field(N), base = [0.11, 0.12, 0.13];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const grain = tnoise(x / 1.5, y / 1.5, N / 1.5, seed), agg = tnoise(x / 4, y / 4, N / 4, seed + 1);
      const puddle = tfbm(x / 110, y / 110, N / 110, 4, seed + 2);
      const wet = Math.min(1, Math.max(0, (puddle - 0.5) * 5));
      const crack = Math.abs(tfbm(x / 70, y / 70, N / 70, 3, seed + 5) - 0.5) < 0.012 ? 1 : 0;
      const c = mul(base, (0.75 + grain * 0.5 + (agg > 0.82 ? 0.5 : 0)) * (1 - wet * 0.35) * (crack ? 0.5 : 1));
      f.set(x, y, c, (1 - wet) * (grain * 0.25 + agg * 0.2) - crack * 0.4, 0.62 - wet * 0.52 + grain * 0.08);
    }
    return finish(f, { normal: 1.2 });
  });
}

/** Sidewalk slabs with moss in the joints, slightly wet. */
export function paving(seed = 5): PbrMaps {
  return gen(`paving${seed}`, () => {
    const N = 512, f = new Field(N), slab = 128, tones = [0.92, 1.04, 0.97, 1.08, 0.9, 1.0, 1.06, 0.95, 0.99, 1.02, 0.93, 1.05, 0.98, 0.96, 1.01, 1.03];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const sx = Math.floor(x / slab), sy = Math.floor(y / slab), gx = x % slab, gy = y % slab;
      const joint = gx < 4 || gy < 4;
      const n = tfbm(x / 40, y / 40, N / 40, 4, seed), wet = Math.max(0, tfbm(x / 150, y / 150, 4, 3, seed + 4) - 0.5) * 3;
      if (joint) f.set(x, y, n > 0.45 ? mixc([0.22, 0.3, 0.12], [0.3, 0.4, 0.16], n) : [0.15, 0.14, 0.13], 0, 0.95);
      else f.set(x, y, mul([0.42, 0.42, 0.4], tones[(sx + sy * 4) % 16] * (0.82 + n * 0.3) * (1 - Math.min(1, wet) * 0.25)), 0.5 + n * 0.2, 0.75 - Math.min(1, wet) * 0.45);
    }
    return finish(f, { normal: 2.4 });
  });
}

export function rust(tint = '#5c6468', seed = 6): PbrMaps {
  return gen(`rust${tint}${seed}`, () => {
    const N = 256, f = new Field(N), base = hex(tint), rc = hex('#8a4a26');
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const r = tfbm(x / 40, y / 40, N / 40, 5, seed), fine = tnoise(x / 2, y / 2, N / 2, seed + 1);
      const t = Math.min(1, Math.max(0, (r - 0.58) * 3)) * 0.85;
      f.set(x, y, mul(mixc(base, mul(rc, 0.8 + fine * 0.4), t), 0.85 + fine * 0.25), t * 0.4 + fine * 0.1, 0.45 + t * 0.45);
    }
    return finish(f, { normal: 1.2 });
  });
}

export function wood(tint = '#6e4c30', seed = 7): PbrMaps {
  return gen(`wood${tint}${seed}`, () => {
    const N = 256, f = new Field(N), base = hex(tint), plank = 64;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const p = Math.floor(y / plank), gap = y % plank < 3;
      const grain = Math.sin((x / N) * Math.PI * 2 * 6 + tfbm(x / 30, y / 8, N / 30, 3, seed + p) * 9) * 0.5 + 0.5;
      f.set(x, y, gap ? [0.08, 0.06, 0.05] : mul(base, 0.75 + grain * 0.3 + p * 0.03), gap ? 0 : 0.5 + grain * 0.2, 0.85);
    }
    return finish(f, { normal: 1.8 });
  });
}

/** Neutral cloth weave detail (multiplied by material colour). */
export function cloth(seed = 8): PbrMaps {
  return gen(`cloth${seed}`, () => {
    const N = 128, f = new Field(N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const w = ((x >> 1) + (y >> 1)) % 2 ? 0.92 : 1, n = tnoise(x / 6, y / 6, N / 6, seed), dirt = tfbm(x / 40, y / 40, N / 40, 3, seed + 2);
      const v = w * (0.8 + n * 0.25) * (1 - Math.max(0, dirt - 0.55) * 0.8);
      f.set(x, y, [v, v, v], w * 0.3 + n * 0.2, 0.95);
    }
    return finish(f, { normal: 1.4 });
  });
}

/** Leaf clusters with alpha (ivy curtains, tree crowns, bushes). */
export function leaves(seed = 9, dark = false): PbrMaps {
  return gen(`leaves${seed}${dark}`, () => {
    const N = 256, f = new Field(N), R = new Rng(seed);
    f.a.fill(0);
    const pal = dark ? [hex('#1d2c14'), hex('#26391a'), hex('#304621')] : [hex('#3d5a22'), hex('#4f6e2a'), hex('#66833a'), hex('#7e9440')];
    for (let k = 0; k < 520; k++) {
      const cx = R.next() * N, cy = R.next() * N, s = 5 + R.next() * 9, a = R.next() * Math.PI, c = R.pick(pal);
      for (let y = -s; y <= s; y++) for (let x = -s; x <= s; x++) {
        const rx = x * Math.cos(a) + y * Math.sin(a), ry = -x * Math.sin(a) + y * Math.cos(a);
        if ((rx / s) ** 2 + (ry / (s * 0.5)) ** 2 > 1) continue;
        const i = f.i(Math.floor(cx + x), Math.floor(cy + y)), sh = 0.75 + 0.35 * (1 - (ry / (s * 0.5) + 1) / 2) + (Math.abs(ry) < 0.8 ? -0.15 : 0);
        f.c[i * 3] = c[0] * sh; f.c[i * 3 + 1] = c[1] * sh; f.c[i * 3 + 2] = c[2] * sh; f.a[i] = 1; f.r[i] = 0.55; f.h[i] = sh;
      }
    }
    return finish(f, { normal: 1, alpha: true });
  });
}

// ---------------------------------------------------------------- canvas-based (text, windows)
/** Weathered sign board with painted text. Returns a colour map (and the same as emissive source). */
export function signTexture(text: string, opts: { bg: string; fg: string; w?: number; h?: number; font?: string; seed?: number }): THREE.CanvasTexture {
  const key = `sign${text}${opts.bg}${opts.fg}`;
  const hit = cache.get(key); if (hit) return hit.map as THREE.CanvasTexture;
  const w = opts.w ?? 512, h = opts.h ?? 128, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!, R = new Rng(opts.seed ?? 3);
  g.fillStyle = opts.bg; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(0,0,0,${R.next() * 0.12})`; g.fillRect(R.next() * w, R.next() * h, 2 + R.next() * 4, 1 + R.next() * 3); }
  g.font = opts.font ?? `900 ${Math.floor(h * 0.62)}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillText(text, w / 2 + 3, h / 2 + 4, w * 0.92);
  g.fillStyle = opts.fg; g.fillText(text, w / 2, h / 2 + 1, w * 0.92);
  g.globalCompositeOperation = 'destination-out';         // flaked paint
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${0.3 + R.next() * 0.6})`; g.fillRect(R.next() * w, R.next() * h, 1 + R.next() * 3, 1 + R.next() * 2); }
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 40; i++) { const x = R.next() * w; const grd = g.createLinearGradient(x, 0, x, h); grd.addColorStop(0, 'rgba(90,40,20,0.35)'); grd.addColorStop(1, 'rgba(90,40,20,0)'); g.fillStyle = grd; g.fillRect(x, R.next() * h * 0.3, 2 + R.next() * 3, h * (0.3 + R.next() * 0.7)); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  cache.set(key, { map: t });
  return t;
}

/** Interior seen through a window: lit room with shelves/silhouettes, or a dark room. */
export function windowTexture(kind: 'lit' | 'dark' | 'shop' | 'tv', seed = 1): THREE.CanvasTexture {
  const key = `win${kind}${seed}`;
  const hit = cache.get(key); if (hit) return hit.map as THREE.CanvasTexture;
  const w = 128, h = 128, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!, R = new Rng(seed);
  if (kind === 'dark') {
    const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, '#0d1820'); grd.addColorStop(1, '#05090c'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(120,170,200,0.12)'; g.beginPath(); g.moveTo(0, h * 0.2); g.lineTo(w * 0.5, 0); g.lineTo(w * 0.62, 0); g.lineTo(0, h * 0.35); g.fill();
    if (R.chance(0.4)) { g.strokeStyle = 'rgba(220,240,255,0.35)'; g.beginPath(); g.moveTo(R.next() * w, 0); g.lineTo(R.next() * w, h); g.stroke(); }
  } else {
    const warm = kind === 'tv' ? ['#2a6f8a', '#0b1d26'] : ['#ffcf86', '#8a4a1e'];
    const grd = g.createRadialGradient(w * 0.5, h * 0.35, 4, w * 0.5, h * 0.5, w * 0.8); grd.addColorStop(0, warm[0]); grd.addColorStop(1, warm[1]); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(40,20,10,0.75)';
    if (kind === 'shop') for (let s = 0; s < 4; s++) { const y = 26 + s * 26; g.fillRect(0, y, w, 4); for (let i = 0; i < w; i += 6) { g.fillStyle = ['#7a8a2a', '#a5462a', '#c7782a', '#5c6e24', '#6b4a2a'][R.int(0, 4)]; g.fillRect(i + 1, y - 7, 4, 7); } g.fillStyle = 'rgba(40,20,10,0.75)'; }
    else { g.fillRect(R.next() * 40, h * 0.55, 30 + R.next() * 30, h * 0.45); g.fillRect(w * 0.6, h * 0.3, 6, h * 0.7); if (R.chance(0.5)) { g.beginPath(); g.arc(w * 0.3, h * 0.42, 9, 0, Math.PI * 2); g.fill(); g.fillRect(w * 0.3 - 10, h * 0.5, 20, 40); } }
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, 0, w, 3);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, { map: t });
  return t;
}

/** Soft radial sprite for glows/volumetric cones (linear filtering). */
export function glowTexture(): THREE.CanvasTexture {
  const hit = cache.get('glow'); if (hit) return hit.map as THREE.CanvasTexture;
  const n = 128, cv = document.createElement('canvas'); cv.width = cv.height = n; const g = cv.getContext('2d')!;
  const grd = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, n, n);
  const t = new THREE.CanvasTexture(cv); cache.set('glow', { map: t }); return t;
}

/** Repeat a PBR set (returns clones that share the image). */
export function repeated(m: PbrMaps, rx: number, ry: number): PbrMaps {
  const c = (t?: THREE.Texture) => { if (!t) return t; const x = t.clone(); x.repeat.set(rx, ry); x.needsUpdate = true; return x; };
  return { map: c(m.map)!, normalMap: c(m.normalMap), roughnessMap: c(m.roughnessMap), alpha: m.alpha };
}

/** Vertical falloff for additive light cones (v = 1 at the lamp, 0 at the far end). */
export function coneTexture(): THREE.CanvasTexture {
  const hit = cache.get('cone'); if (hit) return hit.map as THREE.CanvasTexture;
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 128; const g = cv.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 128); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(cv); cache.set('cone', { map: t }); return t;
}

/** Striped awning canvas (faded, stained, tattered bottom handled by geometry). */
export function stripes(a: string, b: string, n = 8): THREE.CanvasTexture {
  const key = `stripes${a}${b}${n}`; const hit = cache.get(key); if (hit) return hit.map as THREE.CanvasTexture;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d')!, R = new Rng(n);
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect((i * 256) / n, 0, 256 / n + 1, 64); }
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(30,20,10,${R.next() * 0.18})`; g.fillRect(R.next() * 256, R.next() * 64, 3, 2 + R.next() * 10); }
  const grd = g.createLinearGradient(0, 0, 0, 64); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(20,10,5,0.45)'); g.fillStyle = grd; g.fillRect(0, 0, 256, 64);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; cache.set(key, { map: t }); return t;
}

// ---------------------------------------------------------------- dressing (art pass 2: reference-driven detail)
const canvasTex = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, R: Rng) => void, seed = 1): THREE.CanvasTexture => {
  const hit = cache.get(key); if (hit) return hit.map as THREE.CanvasTexture;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d')!, new Rng(seed));
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; cache.set(key, { map: t }); return t;
};

/** Hanging ivy curtain: dense crown fading into thin trailing strands (alpha). Yellow-green like wet overgrowth. */
export function ivy(seed = 1): THREE.CanvasTexture {
  return canvasTex(`ivy${seed}`, 128, 256, (g, R) => {
    const pal = ['#3c4f1c', '#55692a', '#6f8034', '#8c9440', '#a7a24a', '#2c3a16'];
    const strands = 7 + R.int(0, 5);
    for (let k = 0; k < strands; k++) {
      let x = 10 + R.next() * 108; const len = 60 + R.next() * 190;
      for (let y = 0; y < len; y += 2.5) {
        x += (R.next() - 0.5) * 2.2; const dens = 1 - y / len, r = 2 + dens * 6;
        const n = 1 + Math.floor(dens * 3);
        for (let i = 0; i < n; i++) { g.fillStyle = pal[R.int(0, pal.length - 1)]; g.beginPath(); g.ellipse(x + (R.next() - 0.5) * r * 2.4, y + (R.next() - 0.5) * 3, 1.5 + R.next() * 2.4, 1 + R.next() * 1.6, R.next() * 3, 0, Math.PI * 2); g.fill(); }
      }
    }
    for (let i = 0; i < 260; i++) { g.fillStyle = pal[R.int(0, pal.length - 1)]; g.beginPath(); g.ellipse(R.next() * 128, R.next() * 26, 2 + R.next() * 3.5, 1.4 + R.next() * 2, R.next() * 3, 0, Math.PI * 2); g.fill(); }
  }, seed);
}

/** Torn, faded street poster / graffiti panel. */
export function poster(seed = 1): THREE.CanvasTexture {
  return canvasTex(`poster${seed}`, 128, 160, (g, R) => {
    const bgs = ['#c9b78f', '#b8473a', '#d9cfb0', '#3e6f8a', '#e0c35a', '#8f8a78'];
    g.fillStyle = bgs[seed % bgs.length]; g.fillRect(0, 0, 128, 160);
    const ink = ['#2a1e18', '#8a2a22', '#1e3a52', '#f0e6c8'];
    if (seed % 3 === 0) { g.fillStyle = ink[1]; g.beginPath(); g.arc(64, 62, 38, 0, Math.PI * 2); g.fill(); g.fillStyle = '#f0e6c8'; g.font = 'italic 900 26px Georgia, serif'; g.textAlign = 'center'; g.fillText('MISSING', 64, 70); }
    else if (seed % 3 === 1) { g.fillStyle = ink[0]; g.fillRect(14, 16, 100, 70); g.fillStyle = bgs[(seed + 2) % bgs.length]; g.beginPath(); g.arc(64, 44, 18, 0, Math.PI * 2); g.fill(); g.fillRect(40, 62, 48, 24); }
    else { g.strokeStyle = ink[2]; g.lineWidth = 9; g.beginPath(); g.moveTo(30, 30); g.lineTo(98, 100); g.moveTo(98, 30); g.lineTo(30, 100); g.stroke(); }
    g.fillStyle = ink[0]; for (let i = 0; i < 6; i++) g.fillRect(16, 104 + i * 8, 40 + R.next() * 56, 3);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 14; i++) { g.beginPath(); const x = R.next() * 128, y = R.chance(0.5) ? R.next() * 20 : 140 + R.next() * 20; g.moveTo(x, y); g.lineTo(x + 20 * R.next(), y + 30 * (R.next() - 0.5)); g.lineTo(x - 15 * R.next(), y + 20 * R.next()); g.fill(); }
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(0,0,0,${R.next() * 0.5})`; g.fillRect(R.next() * 128, R.next() * 160, 1 + R.next() * 3, 1 + R.next() * 2); }
    g.globalCompositeOperation = 'source-over';
    const grd = g.createLinearGradient(0, 0, 0, 160); grd.addColorStop(0, 'rgba(30,25,15,0)'); grd.addColorStop(1, 'rgba(30,25,15,0.5)'); g.fillStyle = grd; g.fillRect(0, 0, 128, 160);
  }, seed);
}

/** Vertical rain-water stains running down from ledges (multiplied over walls as a decal). */
export function grime(seed = 1): THREE.CanvasTexture {
  return canvasTex(`grime${seed}`, 128, 256, (g, R) => {
    for (let i = 0; i < 40; i++) {
      const x = R.next() * 128, w = 1 + R.next() * 7, len = 40 + R.next() * 216;
      const grd = g.createLinearGradient(0, 0, 0, len); grd.addColorStop(0, `rgba(12,14,10,${0.35 + R.next() * 0.4})`); grd.addColorStop(1, 'rgba(12,14,10,0)');
      g.fillStyle = grd; g.fillRect(x, 0, w, len);
    }
    const top = g.createLinearGradient(0, 0, 0, 40); top.addColorStop(0, 'rgba(10,12,8,0.6)'); top.addColorStop(1, 'rgba(10,12,8,0)'); g.fillStyle = top; g.fillRect(0, 0, 128, 40);
  }, seed);
}

/** Overcast night cloud bank for the far sky (alpha, lit from below by the city). */
export function clouds(seed = 1): THREE.CanvasTexture {
  return canvasTex(`clouds${seed}`, 512, 128, (g, R) => {
    for (let i = 0; i < 380; i++) {
      const x = R.next() * 512, y = 20 + R.next() * 90, r = 10 + R.next() * 34, a = 0.05 + R.next() * 0.09;
      const grd = g.createRadialGradient(x, y, 0, x, y, r); const c = y > 70 ? '88,104,116' : '58,74,88';
      grd.addColorStop(0, `rgba(${c},${a})`); grd.addColorStop(1, `rgba(${c},0)`); g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }, seed);
}
