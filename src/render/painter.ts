import * as THREE from 'three';
import { Rng } from '../core/rng';

/** Texels per world metre for each depth band. Gameplay art is densest. */
export const PPU = { near: 64, mid: 48, far: 32 } as const;

export type RGB = [number, number, number];

export const hex = (h: string): RGB => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const shade = (c: RGB, f: number): RGB => [
  Math.max(0, Math.min(255, c[0] * f)), Math.max(0, Math.min(255, c[1] * f)), Math.max(0, Math.min(255, c[2] * f)),
];
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/**
 * Pixel-art canvas. All drawing is integer-pixel with no antialiasing; shading
 * uses ordered dithering + seeded noise so output is deterministic per seed.
 * Coordinates: pixels, origin top-left, y down.
 */
export class Painter {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private img: ImageData;
  readonly rng: Rng;
  private dirty = false;

  constructor(readonly w: number, readonly h: number, seed = 1) {
    this.w = Math.max(1, Math.round(w)); this.h = Math.max(1, Math.round(h));
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.w; this.canvas.height = this.h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.ctx.imageSmoothingEnabled = false;
    this.img = this.ctx.getImageData(0, 0, this.w, this.h);
    this.rng = new Rng(seed);
  }

  // ---------- low level ----------
  px(x: number, y: number, c: RGB, a = 255): void {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4, d = this.img.data;
    if (a >= 255) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; }
    else if (a > 0) {
      const t = a / 255, ia = d[i + 3] / 255, oa = t + ia * (1 - t);
      d[i] = (c[0] * t + d[i] * ia * (1 - t)) / oa; d[i + 1] = (c[1] * t + d[i + 1] * ia * (1 - t)) / oa; d[i + 2] = (c[2] * t + d[i + 2] * ia * (1 - t)) / oa;
      d[i + 3] = oa * 255;
    }
    this.dirty = true;
  }
  /** Make a pixel fully transparent. */
  erase(x: number, y: number): void {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.img.data[(y * this.w + x) * 4 + 3] = 0; this.dirty = true;
  }
  clearRect(x: number, y: number, w: number, h: number): void {
    const x1 = (x + w) | 0, y1 = (y + h) | 0;
    for (let j = y | 0; j < y1; j++) for (let i = x | 0; i < x1; i++) this.erase(i, j);
  }
  get(x: number, y: number): [number, number, number, number] {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0];
    const i = (y * this.w + x) * 4, d = this.img.data; return [d[i], d[i + 1], d[i + 2], d[i + 3]];
  }
  alphaAt(x: number, y: number): number {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.img.data[(y * this.w + x) * 4 + 3];
  }

  /** Multiply existing (opaque) pixels' colour by f; keeps alpha. */
  tint(x: number, y: number, f: number): void {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4, d = this.img.data;
    if (!d[i + 3]) return;
    d[i] = Math.min(255, d[i] * f); d[i + 1] = Math.min(255, d[i + 1] * f); d[i + 2] = Math.min(255, d[i + 2] * f);
    this.dirty = true;
  }

  // ---------- shapes ----------
  rect(x: number, y: number, w: number, h: number, c: RGB, a = 255): void {
    for (let j = Math.max(0, y | 0); j < Math.min(this.h, (y + h) | 0); j++)
      for (let i = Math.max(0, x | 0); i < Math.min(this.w, (x + w) | 0); i++) this.px(i, j, c, a);
  }
  /** Rect with per-pixel noise (texture) and optional vertical light gradient. */
  texRect(x: number, y: number, w: number, h: number, c: RGB, noise = 0.08, topLight = 0.12, a = 255): void {
    for (let j = 0; j < h; j++) {
      const g = 1 + topLight * (1 - (2 * j) / Math.max(1, h - 1));
      for (let i = 0; i < w; i++) this.px(x + i, y + j, shade(c, g + (this.rng.next() - 0.5) * 2 * noise), a);
    }
  }
  /** Ordered-dither gradient between two colours (vertical). */
  gradRect(x: number, y: number, w: number, h: number, top: RGB, bottom: RGB, steps = 8): void {
    const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let j = 0; j < h; j++) {
      const t = j / Math.max(1, h - 1);
      for (let i = 0; i < w; i++) {
        const thr = bayer[((j + y) & 3) * 4 + ((i + x) & 3)] / 16;
        const q = Math.min(steps, Math.floor(t * steps + thr)) / steps;
        this.px(x + i, y + j, mix(top, bottom, q));
      }
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, a = 255): void {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  thickLine(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n;
      this.disc(x, y, t / 2, c);
    }
  }
  disc(cx: number, cy: number, r: number, c: RGB, a = 255): void {
    for (let j = Math.floor(cy - r); j <= Math.ceil(cy + r); j++)
      for (let i = Math.floor(cx - r); i <= Math.ceil(cx + r); i++)
        if ((i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2 <= r * r) this.px(i, j, c, a);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB, a = 255): void {
    for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++)
      for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++)
        if (((i + 0.5 - cx) / rx) ** 2 + ((j + 0.5 - cy) / ry) ** 2 <= 1) this.px(i, j, c, a);
  }
  /** Filled polygon (even-odd scanline). */
  poly(pts: [number, number][], c: RGB, a = 255): void {
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= y + 0.5 && y1 > y + 0.5) || (y1 <= y + 0.5 && y0 > y + 0.5)) xs.push(x0 + ((y + 0.5 - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.px(x, y, c, a);
    }
  }

  // ---------- material passes (operate on existing pixels) ----------
  /** Darken a 1px rim on opaque pixels that border transparency (sprite outline). */
  outline(f = 0.55): void {
    const mark: number[] = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.alphaAt(x, y) < 128) continue;
      if (this.alphaAt(x - 1, y) < 128 || this.alphaAt(x + 1, y) < 128 || this.alphaAt(x, y - 1) < 128 || this.alphaAt(x, y + 1) < 128) mark.push(x, y);
    }
    for (let k = 0; k < mark.length; k += 2) this.tint(mark[k], mark[k + 1], f);
  }
  /** Rim light on edges facing a direction (dx,dy), e.g. a lamp to the upper-right. */
  rimLight(dx: number, dy: number, f = 1.35): void {
    const mark: number[] = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++)
      if (this.alphaAt(x, y) >= 128 && this.alphaAt(x + dx, y + dy) < 128) mark.push(x, y);
    for (let k = 0; k < mark.length; k += 2) this.tint(mark[k], mark[k + 1], f);
  }
  /** Rust / water streaks running down from random points. */
  streaks(x: number, y: number, w: number, h: number, c: RGB, count: number, alpha = 90): void {
    for (let n = 0; n < count; n++) {
      const sx = x + this.rng.int(0, w - 1), sy = y + this.rng.int(0, Math.max(0, h / 3));
      const len = this.rng.int(4, Math.max(5, h * 0.6));
      for (let k = 0; k < len; k++) if (this.alphaAt(sx, sy + k) > 0) this.px(sx, sy + k, c, alpha * (1 - k / len));
    }
  }
  /** Speckled grime over opaque pixels. */
  grime(x: number, y: number, w: number, h: number, density: number, dark = 0.7): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++)
      if (this.rng.next() < density) this.tint(i, j, dark + this.rng.next() * 0.15);
  }
  /** Climbing ivy / overgrowth clusters starting at (x,y) growing in direction. */
  ivy(x: number, y: number, len: number, dirY: 1 | -1, palette: RGB[], spread = 3): void {
    let cx = x, cy = y;
    for (let k = 0; k < len; k++) {
      cy += dirY; cx += this.rng.int(-1, 1);
      this.px(cx, cy, shade(palette[0], 0.6));
      if (this.rng.chance(0.55)) {
        const r = this.rng.range(1, spread);
        const c = this.rng.pick(palette);
        for (let n = 0; n < r * 3; n++) this.px(cx + this.rng.int(-r, r), cy + this.rng.int(-1, 1), shade(c, this.rng.range(0.8, 1.15)));
      }
    }
  }
  /** Grass tufts along a baseline. */
  grass(x0: number, x1: number, baseY: number, maxH: number, density: number, palette: RGB[]): void {
    for (let x = x0; x < x1; x++) {
      if (!this.rng.chance(density)) continue;
      const h = this.rng.int(2, maxH), lean = this.rng.range(-0.5, 0.5), c = this.rng.pick(palette);
      for (let k = 0; k < h; k++) this.px(x + Math.round(lean * k), baseY - k, shade(c, 0.7 + (0.5 * k) / h));
    }
  }
  /** Crisp bitmap text: rendered with canvas fonts then alpha-thresholded. */
  text(str: string, x: number, y: number, size: number, c: RGB, opts: { bold?: boolean; font?: string; align?: CanvasTextAlign; worn?: number } = {}): void {
    this.flush();
    const tmp = document.createElement('canvas');
    tmp.width = this.w; tmp.height = this.h;
    const t = tmp.getContext('2d', { willReadFrequently: true })!;
    t.font = `${opts.bold ? '900 ' : ''}${size}px ${opts.font ?? '"Arial Black", Impact, "Helvetica Neue", sans-serif'}`;
    t.textAlign = opts.align ?? 'left'; t.textBaseline = 'top'; t.fillStyle = '#fff';
    t.fillText(str, x, y);
    const d = t.getImageData(0, 0, this.w, this.h).data;
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      if (d[(j * this.w + i) * 4 + 3] > 110 && !(opts.worn && this.rng.chance(opts.worn))) this.px(i, j, shade(c, 0.9 + this.rng.next() * 0.2));
    }
  }

  // ---------- output ----------
  flush(): void {
    if (this.dirty) { this.ctx.putImageData(this.img, 0, 0); this.dirty = false; }
    this.img = this.ctx.getImageData(0, 0, this.w, this.h);
  }
  texture(): THREE.CanvasTexture {
    if (this.dirty) { this.ctx.putImageData(this.img, 0, 0); this.dirty = false; }
    const t = new THREE.CanvasTexture(this.canvas);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  dataURL(): string {
    if (this.dirty) { this.ctx.putImageData(this.img, 0, 0); this.dirty = false; }
    return this.canvas.toDataURL();
  }
}

/** Shared palettes: rainy night, sodium lamps, overgrowth. */
export const PAL = {
  skyTop: hex('#060b14'), skyMid: hex('#0d1d2e'), skyLow: hex('#1d3444'), haze: hex('#22394a'),
  moon: hex('#dfe7e6'),
  concrete: hex('#5b6266'), concreteDark: hex('#3a4044'), brick: hex('#6b3f33'), brickDark: hex('#4a2b25'),
  plaster: hex('#8a8170'), plasterDark: hex('#5f594d'),
  metal: hex('#5d6a70'), rust: hex('#7a4426'), rustLight: hex('#a65f2e'),
  asphalt: hex('#24292d'), asphaltWet: hex('#1a2026'), curb: hex('#6f7472'),
  glassDark: hex('#14212b'), glassLit: hex('#e6b25c'), glassCold: hex('#3c6a7a'),
  lamp: hex('#ffcf7a'), lampCold: hex('#bfe4ff'),
  leaf: [hex('#2f4a1f'), hex('#3f5f24'), hex('#55772c'), hex('#6d8a33')] as RGB[],
  leafDark: [hex('#17240f'), hex('#223417'), hex('#2c401b')] as RGB[],
  grass: [hex('#3b5520'), hex('#4f6b26'), hex('#6a8231'), hex('#7b8c3a')] as RGB[],
  hazardYellow: hex('#c9a227'), hazardRed: hex('#a8322a'), white: hex('#d8d8d0'),
  wood: hex('#6e4c30'), woodDark: hex('#4a321f'),
} as const;
