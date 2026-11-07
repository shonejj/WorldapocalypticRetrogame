// Background layers: clean alpha mattes, repaint the store sign, export WebP.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { Img, rgb2hsv, rng } from './lib/img.mjs';

export const LAYERS = [
  '01_distant_skyline', '02_distant_city_architecture', '03_mid_distance_structures', '04_main_street_storefronts',
  '05_abandoned_vehicles_props', '06_playable_ground', '07_vegetation', '08_foreground_depth', '09_extreme_foreground',
];

/** Store name is single-sourced from src/config/game.ts (WORLD_NAMES.storeName). */
export function storeName() {
  const src = readFileSync(new URL('../src/config/game.ts', import.meta.url), 'utf8');
  return /storeName:\s*'([^']+)'/.exec(src)?.[1] ?? 'FRESH VEGGIES';
}

/** Matte cleanup: drop near-invisible residue (AI background-removal halos);
 *  for soft vegetation mattes, firm up partially transparent leaves. */
function cleanAlpha(img, boost) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let a = d[i + 3];
    if (a < 14) a = 0;
    else if (boost) a = Math.min(255, Math.max(0, (a - 22) * boost));
    d[i + 3] = a;
  }
}

async function textMask(text, w, h) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <text x="50%" y="${h * 0.86}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="${h * 1.12}"
      textLength="${w}" lengthAdjust="spacingAndGlyphs" fill="#fff">${text}</text></svg>`;
  const { data, info } = await sharp(Buffer.from(svg)).raw().toBuffer({ resolveWithObject: true });
  return new Img(info.width, info.height, new Uint8ClampedArray(data));
}

/** Replace the painted shop name with WORLD_NAMES.storeName, keeping the board texture and vines. */
async function repaintSign(img, name) {
  const R = { x: 214, y: 344, w: 470, h: 60 };          // board interior
  const L = { x: 290, y: 351, w: 348, h: 48 };          // original lettering
  const isLetterPx = (r, g, b) => { const [, s, v] = rgb2hsv(r, g, b); return v > 0.42 && s < 0.5; };
  const isVine = (r, g, b) => { const [hh, s, v] = rgb2hsv(r, g, b); return hh > 45 && hh < 110 && s > 0.35 && v > 0.25; };
  const orig = img.clone();
  // letter mask, dilated by 1px to catch anti-aliased edges
  const lm = new Uint8Array(img.w * img.h);
  for (let y = L.y - 4; y < L.y + L.h + 4; y++) for (let x = L.x - 6; x < L.x + L.w + 6; x++) {
    const [r, g, b] = orig.get(x, y);
    if (isLetterPx(r, g, b) && !isVine(r, g, b)) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) lm[(y + dy) * img.w + x + dx] = 1;
  }
  const isLetterAt = (x, y) => lm[y * img.w + x] === 1;
  // 1) inpaint letters row by row from the nearest board pixels
  for (let y = L.y - 4; y < L.y + L.h + 4; y++) {
    const row = [];
    for (let x = R.x; x < R.x + R.w; x++) { const [r, g, b] = orig.get(x, y); row.push(!isLetterAt(x, y) && !isVine(r, g, b)); }
    for (let x = L.x - 6; x < L.x + L.w + 6; x++) {
      const a = orig.get(x, y)[3];
      if (!isLetterAt(x, y)) continue;
      let k = 1, src = null;
      while (k < 60 && !src) {
        for (const sx of [x - k, x + k]) if (sx >= R.x && sx < R.x + R.w && row[sx - R.x]) { src = orig.get(sx, y); break; }
        k++;
      }
      if (src) img.set(x, y, src[0], src[1], src[2], a);
    }
  }
  // 2) new lettering: cream paint, worn, slight per-pixel texture
  const pad = 22, tw = R.w - pad * 2, th = 44;
  const mask = await textMask(name, tw, th);
  const rnd = rng(7);
  const ox = R.x + pad, oy = R.y + (R.h - th) / 2 + 1;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const a = mask.data[(y * tw + x) * 4 + 3];
    if (a < 120 || rnd() < 0.1) continue;
    const base = 188 + (rnd() - 0.5) * 46;
    img.blend(ox + x + 2, oy + y + 2, 40, 14, 10, 110);                       // drop shadow
    const bg = img.get(ox + x, oy + y);
    img.set(ox + x, oy + y, base * 0.9 + bg[0] * 0.1, base * 0.86 + bg[1] * 0.07, base * 0.74 + bg[2] * 0.06, 255);
  }
  // 3) put the vines back in front of the sign
  for (let y = R.y - 6; y < R.y + R.h + 6; y++) for (let x = R.x; x < R.x + R.w; x++) {
    const [r, g, b, a] = orig.get(x, y);
    if (a > 0 && isVine(r, g, b)) img.set(x, y, r, g, b, a);
  }
}

export async function buildLayers(srcDir, outDir) {
  const meta = {};
  for (const name of LAYERS) {
    const img = await Img.load(`${srcDir}/${name}.png`);
    cleanAlpha(img, name.startsWith('07') ? 1.7 : name.startsWith('08') || name.startsWith('09') ? 1.25 : 0);
    if (name.startsWith('04')) await repaintSign(img, storeName());
    await img.save(`${outDir}/${name}.webp`, { quality: name.startsWith('01') ? 82 : 90 });
    meta[name] = { w: img.w, h: img.h };
  }
  return meta;
}
