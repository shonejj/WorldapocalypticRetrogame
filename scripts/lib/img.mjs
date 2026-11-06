// Minimal RGBA image toolkit for the build-time asset pipeline (no browser needed).
import sharp from 'sharp';

export class Img {
  constructor(w, h, data) { this.w = w; this.h = h; this.data = data ?? new Uint8ClampedArray(w * h * 4); }
  static async load(path) {
    const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return new Img(info.width, info.height, new Uint8ClampedArray(data.buffer, data.byteOffset, data.length).slice());
  }
  clone() { return new Img(this.w, this.h, this.data.slice()); }
  i(x, y) { return (y * this.w + x) * 4; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { x |= 0; y |= 0; if (!this.inside(x, y)) return [0, 0, 0, 0]; const i = this.i(x, y), d = this.data; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; }
  set(x, y, r, g, b, a = 255) { x |= 0; y |= 0; if (!this.inside(x, y)) return; const i = this.i(x, y), d = this.data; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a; }
  alpha(x, y) { x |= 0; y |= 0; return this.inside(x, y) ? this.data[this.i(x, y) + 3] : 0; }
  /** Source-over blend one pixel. */
  blend(x, y, r, g, b, a) {
    x |= 0; y |= 0; if (!this.inside(x, y) || a <= 0) return;
    const i = this.i(x, y), d = this.data, t = a / 255, da = d[i + 3] / 255, oa = t + da * (1 - t);
    if (oa <= 0) return;
    d[i] = (r * t + d[i] * da * (1 - t)) / oa; d[i + 1] = (g * t + d[i + 1] * da * (1 - t)) / oa; d[i + 2] = (b * t + d[i + 2] * da * (1 - t)) / oa; d[i + 3] = oa * 255;
  }
  /** Draw `src` with an affine map: dst = R(angle)·S(scale)·(src - pivot) + at. Nearest sampling (keeps pixel crispness). */
  drawTransformed(src, { pivotX = 0, pivotY = 0, atX = 0, atY = 0, angle = 0, sx = 1, sy = 1, mask = null, tint = null, alphaMul = 1 } = {}) {
    const c = Math.cos(angle), s = Math.sin(angle);
    // bounds of transformed src
    const corners = [[0, 0], [src.w, 0], [0, src.h], [src.w, src.h]].map(([x, y]) => {
      const dx = (x - pivotX) * sx, dy = (y - pivotY) * sy; return [atX + dx * c - dy * s, atY + dx * s + dy * c];
    });
    const minX = Math.floor(Math.min(...corners.map((p) => p[0]))), maxX = Math.ceil(Math.max(...corners.map((p) => p[0])));
    const minY = Math.floor(Math.min(...corners.map((p) => p[1]))), maxY = Math.ceil(Math.max(...corners.map((p) => p[1])));
    for (let y = Math.max(0, minY); y < Math.min(this.h, maxY); y++) for (let x = Math.max(0, minX); x < Math.min(this.w, maxX); x++) {
      const dx = x + 0.5 - atX, dy = y + 0.5 - atY;
      const ux = (dx * c + dy * s) / sx + pivotX, uy = (-dx * s + dy * c) / sy + pivotY;
      const ix = Math.floor(ux), iy = Math.floor(uy);
      if (!src.inside(ix, iy) || (mask && !mask(ix, iy))) continue;
      const [r, g, b, a] = src.get(ix, iy);
      if (!a) continue;
      if (tint) { const t = tint(r, g, b); this.blend(x, y, t[0], t[1], t[2], a * alphaMul); } else this.blend(x, y, r, g, b, a * alphaMul);
    }
  }
  drawImage(src, ox, oy, mask = null) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      if (mask && !mask(x, y)) continue;
      const [r, g, b, a] = src.get(x, y); if (a) this.blend(ox + x, oy + y, r, g, b, a);
    }
  }
  crop(x0, y0, w, h) { const o = new Img(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = this.get(x0 + x, y0 + y); o.set(x, y, ...p); } return o; }
  /** Keep only pixels where pred is true (else transparent). */
  keep(pred) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (!pred(x, y)) this.data[this.i(x, y) + 3] = 0; return this; }
  bbox(th = 16) {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.data[this.i(x, y) + 3] > th) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  /** Remove disconnected specks: keep components >= minPixels (8-connectivity on alpha > th). */
  removeSpecks(minPixels = 400, th = 40) {
    const lab = new Int32Array(this.w * this.h).fill(-1), sizes = [];
    for (let p = 0; p < this.w * this.h; p++) {
      if (lab[p] !== -1 || this.data[p * 4 + 3] <= th) continue;
      const id = sizes.length; let n = 0; const st = [p]; lab[p] = id;
      while (st.length) {
        const q = st.pop(); n++; const qx = q % this.w, qy = (q / this.w) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = qx + dx, ny = qy + dy; if (!this.inside(nx, ny)) continue;
          const r = ny * this.w + nx; if (lab[r] === -1 && this.data[r * 4 + 3] > th) { lab[r] = id; st.push(r); }
        }
      }
      sizes.push(n);
    }
    let removed = 0;
    for (let p = 0; p < this.w * this.h; p++) if (lab[p] >= 0 && sizes[lab[p]] < minPixels) { this.data[p * 4 + 3] = 0; removed++; }
    return removed;
  }
  async save(path, { quality = 88, lossless = false, png = false } = {}) {
    const s = sharp(Buffer.from(this.data.buffer, this.data.byteOffset, this.data.length), { raw: { width: this.w, height: this.h, channels: 4 } });
    if (png) await s.png({ compressionLevel: 9 }).toFile(path);
    else await s.webp({ quality, lossless, alphaQuality: 100, effort: 5 }).toFile(path);
  }
  async resized(w, h, kernel = 'lanczos3') {
    const { data, info } = await sharp(Buffer.from(this.data.buffer, this.data.byteOffset, this.data.length), { raw: { width: this.w, height: this.h, channels: 4 } })
      .resize(w, h, { kernel, fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
    return new Img(info.width, info.height, new Uint8ClampedArray(data.buffer, data.byteOffset, data.length).slice());
  }
}

export function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx ? d / mx : 0, mx];
}
export function hsv2rgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
export const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/** Deterministic PRNG for reproducible assets. */
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
