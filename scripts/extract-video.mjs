// One-off extractor: AI-generated animation video (flat grey background) → transparent,
// normalised sprite frames in assets-src/characters/<id>/<anim>_NN.png.
// Usage: node scripts/extract-video.mjs assets-src/video/reed_anim.mp4 reed
// Needs ffmpeg on PATH (only for this step; the regular asset build does not).
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Img, rgb2hsv } from './lib/img.mjs';

const [video, id] = process.argv.slice(2);
if (!video || !id) { console.error('usage: extract-video.mjs <video> <characterId>'); process.exit(1); }

/** Frame ranges (1-based, 24 fps source) chosen by cycle analysis of the Reed video. */
const ANIMS = {
  idle: { from: 1, to: 48, step: 4 },
  run: { from: 68, to: 89, step: 2 },        // 22-frame loop
  walk: { from: 108, to: 137, step: 2 },     // 30-frame loop (both legs)
  draw: { from: 148, to: 179, step: 2 },     // pull rifle off the back
  aim: { from: 182, to: 189, step: 1 },      // 8-frame aim loop
};
const FIGURE_SRC = 656, FIGURE_DST = 500, BASE_SRC = 692, BASE_DST = 514;
const CANVAS_W = 450, CANVAS_H = 520;
const S = FIGURE_DST / FIGURE_SRC;

const tmp = mkdtempSync(join(tmpdir(), 'frames-'));
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', video, join(tmp, '%03d.png')]);

function key(img) {
  const bg = img.get(8, 8);
  const near = (x, y, tol) => { const [r, g, b] = img.get(x, y); return Math.max(Math.abs(r - bg[0]), Math.abs(g - bg[1]), Math.abs(b - bg[2])) <= tol; };
  const seen = new Uint8Array(img.w * img.h), st = [];
  for (let x = 0; x < img.w; x++) st.push([x, 0], [x, img.h - 1]);
  for (let y = 0; y < img.h; y++) st.push([0, y], [img.w - 1, y]);
  while (st.length) {
    const [x, y] = st.pop(); if (!img.inside(x, y)) continue;
    const k = y * img.w + x; if (seen[k] || !near(x, y, 12)) continue;
    seen[k] = 1; img.data[k * 4 + 3] = 0;
    st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  // enclosed background pockets (e.g. between arm and chest): only LARGE flat regions,
  // so dark pixels inside the gun/pants that happen to match the grey are kept
  const lab = new Int32Array(img.w * img.h).fill(-1);
  for (let p0 = 0; p0 < img.w * img.h; p0++) {
    if (lab[p0] !== -1 || !img.data[p0 * 4 + 3] || !near(p0 % img.w, (p0 / img.w) | 0, 5)) continue;
    const comp = [p0]; lab[p0] = p0;
    for (let q = 0; q < comp.length; q++) {
      const c = comp[q], cx = c % img.w, cy = (c / img.w) | 0;
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        if (!img.inside(nx, ny)) continue; const r = ny * img.w + nx;
        if (lab[r] === -1 && img.data[r * 4 + 3] && near(nx, ny, 5)) { lab[r] = p0; comp.push(r); }
      }
    }
    if (comp.length >= 600) for (const c of comp) img.data[c * 4 + 3] = 0;
  }
  // soften the 1px rim that still carries background tint
  const a = img.clone();
  for (let y = 1; y < img.h - 1; y++) for (let x = 1; x < img.w - 1; x++) {
    if (!a.alpha(x, y)) continue;
    if ((!a.alpha(x - 1, y) || !a.alpha(x + 1, y) || !a.alpha(x, y - 1) || !a.alpha(x, y + 1)) && near(x, y, 26)) img.data[(y * img.w + x) * 4 + 3] = 110;
  }
  for (let y = 660; y < 716; y++) for (let x = 1130; x < 1210; x++) img.data[(y * img.w + x) * 4 + 3] = 0;   // generator watermark
}

const outDir = `assets-src/characters/${id}`;
mkdirSync(outDir, { recursive: true });
let offsetX = null, muzzleX = null;
for (const [name, r] of Object.entries(ANIMS)) {
  let i = 0;
  for (let n = r.from; n <= r.to; n += r.step) {
    const src = await Img.load(join(tmp, `${String(n).padStart(3, '0')}.png`));
    key(src);
    const scaled = await src.resized(Math.round(src.w * S), Math.round(src.h * S));
    if (offsetX === null) {          // anchor: torso centre of the first idle frame → x = 160
      let sx = 0, c = 0; for (let y = 150; y < 290; y++) for (let x = 0; x < scaled.w; x++) if (scaled.alpha(x, y + Math.round(BASE_SRC * S) - BASE_DST) > 128) { sx += x; c++; }
      offsetX = 160 - Math.round(sx / c);
    }
    const out = new Img(CANVAS_W, CANVAS_H);
    out.drawImage(scaled, offsetX, BASE_DST - Math.round(BASE_SRC * S));
    if (name === 'aim' && muzzleX === null) {          // muzzle = right-most rifle pixel at chest height
      muzzleX = 0; for (let y = 150; y < 215; y++) for (let x = CANVAS_W - 1; x > 200; x--) if (out.alpha(x, y) > 100) { muzzleX = Math.max(muzzleX, x); break; }
      console.log('muzzle x', muzzleX);
    }
    out.removeSpecks(200, 60);                          // flying casings / smoke specks
    await out.save(`${outDir}/${name}_${String(i).padStart(2, '0')}.png`, { png: true });
    i++;
  }
  console.log(name, i, 'frames');
}
rmSync(tmp, { recursive: true, force: true });
