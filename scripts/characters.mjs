// Character pipeline: painted source frames (300x520, shared foot baseline) →
// per-character atlases with idle / walk / aim-idle / aim-walk animations.
// The aiming upper body is built ONCE from the idle frame by cutting the painted
// arms and re-attaching them rotated around shoulder/elbow, holding a weapon.
// Squad variants and infected are recolours + painted overlays of the base sprite,
// to be replaced 1:1 by dedicated art later (same frame size and baseline).
import { existsSync } from 'node:fs';
import { Img, rgb2hsv, hexRGB, rng } from './lib/img.mjs';

const FW = 300, FH = 520;           // source frame size
const OUT_SCALE = 0.56;             // atlas scale (source figure ≈ 500px → ≈ 280px)
const PAD_R = 150;                  // extra room on the right for weapons
const WAIST = 302;                  // upper/lower body split row (under the jacket hem)

// ---- anatomy of the base sprite (idle_00) in source pixels
const NEAR_ARM = [[98, 112], [143, 112], [147, 200], [143, 244], [154, 262], [154, 316], [105, 316], [103, 262], [100, 244], [96, 200]];
const FAR_ARM = [[219, 116], [247, 118], [251, 200], [252, 305], [224, 306], [222, 250]];
const NEAR = { shoulder: [120, 124], elbow: [121, 202], hand: [128, 290] };
const FAR = { shoulder: [232, 124], elbow: [236, 205], hand: [238, 285] };

const POSES = {
  long: { near: { elbow: [134, 196], hand: [186, 184] }, far: { elbow: [242, 186], hand: [276, 172] }, gun: { grip: [190, 178], angle: -0.04 }, farShoulder: [206, 132] },
  reach: { near: { elbow: [150, 176], hand: [206, 168] }, far: { elbow: [228, 170], hand: [270, 160] }, gun: null, farShoulder: [206, 134] },
  pistol: { near: { elbow: [168, 168], hand: [236, 150] }, far: { elbow: [226, 176], hand: [244, 156] }, gun: { grip: [242, 145], angle: -0.03 }, farShoulder: [206, 132] },
};

function inPoly(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

// ---------------------------------------------------------------- weapons (painted at sprite scale)
function paintGun(kind) {
  const R = rng(kind.length * 97);
  const specs = { carbine: [170, 46], rifle: [205, 40], shotgun: [196, 40], smg: [128, 46], pistol: [58, 40] };
  const [w, h] = specs[kind];
  const g = new Img(w, h);
  const metal = [44, 47, 50], dark = [24, 25, 27], wood = [98, 62, 36], poly = [52, 54, 50];
  const box = (x, y, bw, bh, c, shade = 0.18) => {
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
      const f = 1 + shade * (1 - (2 * j) / Math.max(1, bh - 1)) + (R() - 0.5) * 0.08;
      g.set(x + i, y + j, c[0] * f, c[1] * f, c[2] * f, 255);
    }
  };
  const tri = (pts, c) => { // filled polygon
    const ys = pts.map((p) => p[1]); for (let y = Math.min(...ys); y <= Math.max(...ys); y++) for (let x = 0; x < w; x++) if (inPoly(pts, x + 0.5, y + 0.5)) { const f = 1 + (R() - 0.5) * 0.1; g.set(x, y, c[0] * f, c[1] * f, c[2] * f, 255); }
  };
  // grip origin is returned so the hand lands on it
  let grip;
  if (kind === 'pistol') {
    box(8, 6, 46, 9, metal, 0.3); box(10, 15, 30, 4, dark); tri([[10, 18], [22, 18], [18, 38], [6, 38]], poly); box(20, 18, 6, 7, dark);
    box(50, 4, 3, 3, metal); grip = [14, 26];
  } else {
    const L = w;
    const stock = kind === 'rifle' || kind === 'shotgun' ? wood : poly;
    tri([[0, 12], [34, 10], [40, 18], [36, 28], [4, 34], [0, 30]], stock);                 // stock
    box(34, 10, 58, 13, metal, 0.25);                                                      // receiver
    box(92, 12, L - 92 - 6, kind === 'shotgun' ? 7 : 5, dark, 0.35);                      // barrel
    if (kind === 'shotgun') box(92, 19, 70, 6, wood, 0.25);                                // pump/tube
    else box(92, 17, kind === 'smg' ? 22 : 48, 9, poly, 0.2);                              // handguard
    tri([[52, 23], [64, 23], [60, 40], [48, 40]], poly);                                   // pistol grip
    if (kind === 'carbine' || kind === 'smg') tri([[70, 23], [82, 23], [86, 44], [74, 44]], dark);   // magazine
    if (kind === 'rifle') { box(48, 4, 40, 6, dark, 0.4); box(46, 3, 4, 8, metal); box(86, 3, 4, 8, metal); }  // scope
    else box(40, 6, 10, 4, dark);                                                          // rear sight
    box(L - 9, 8, 3, 5, dark);                                                             // front sight
    grip = [58, 28];
  }
  // outline + highlight
  const o = g.clone();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!o.alpha(x, y)) continue;
    const edge = !o.alpha(x - 1, y) || !o.alpha(x + 1, y) || !o.alpha(x, y - 1) || !o.alpha(x, y + 1);
    const [r, gg, b] = o.get(x, y);
    if (edge) g.set(x, y, r * 0.45, gg * 0.45, b * 0.45, 255);
    else if (!o.alpha(x, y - 2)) g.set(x, y, Math.min(255, r * 1.6 + 20), Math.min(255, gg * 1.6 + 20), Math.min(255, b * 1.6 + 22), 255);
  }
  return { img: g, grip };
}

// ---------------------------------------------------------------- aiming upper body
function cutArm(src, poly, from, to) {
  // piece of the arm between rows `from`..`to` inside the polygon
  const piece = new Img(src.w, src.h);
  for (let y = from; y < to; y++) for (let x = 0; x < src.w; x++) if (inPoly(poly, x + 0.5, y + 0.5)) piece.set(x, y, ...src.get(x, y));
  return piece;
}

const isPack = (x, y) => (y < WAIST && x < 97) || (y < 132 && x < 116 && y > 30);   // backpack + rifle slung on the back
function buildAimUpper(idle, pose, gun, stripPack = false) {
  const W = FW + PAD_R;
  const body = new Img(W, FH);
  body.drawImage(idle, 0, 0, (x, y) => y < WAIST + 24 && !inPoly(NEAR_ARM, x + 0.5, y + 0.5) && !inPoly(FAR_ARM, x + 0.5, y + 0.5) && !(stripPack && isPack(x, y)));
  // fill the hole the near arm leaves over the torso by cloning jacket texture from the right
  for (let y = 120; y < WAIST + 24; y++) for (let x = 88; x < 162; x++) {
    if (!inPoly(NEAR_ARM, x + 0.5, y + 0.5) || x < leftEdgeOfTorso(idle, y)) continue;
    const s = idle.get(x + 46, y);
    if (s[3] > 128) body.set(x, y, s[0] * 0.92, s[1] * 0.92, s[2] * 0.92, 255);
  }
  const P = POSES[pose];
  const out = new Img(W, FH);
  /** Place a cut limb so its source segment srcA→srcB lies along dstA→dstB (rotate + mild stretch). */
  const limb = (seg, srcA, srcB, dstA, dstB, dim) => {
    const rot = ang(dstA, dstB) - ang(srcA, srcB);
    const k = Math.min(1.15, Math.max(0.85, dist(dstA, dstB) / dist(srcA, srcB)));
    out.drawTransformed(seg, { pivotX: srcA[0], pivotY: srcA[1], atX: dstA[0], atY: dstA[1], angle: rot, sx: 1, sy: k, tint: dim ? (r, g, b) => [r * 0.7, g * 0.7, b * 0.74] : null });
  };
  // far arm (behind torso): shoulder hidden behind the chest
  const farUpper = cutArm(idle, FAR_ARM, 110, FAR.elbow[1] + 6), farLower = cutArm(idle, FAR_ARM, FAR.elbow[1] - 6, 320);
  limb(farUpper, FAR.shoulder, FAR.elbow, P.farShoulder, P.far.elbow, true);
  limb(farLower, FAR.elbow, FAR.hand, P.far.elbow, P.far.hand, true);
  out.drawImage(body, 0, 0);
  // weapon (painted at 1.3× for the chunky look of the reference art)
  if (gun) out.drawTransformed(gun.img, { pivotX: gun.grip[0], pivotY: gun.grip[1], atX: P.gun.grip[0], atY: P.gun.grip[1], angle: P.gun.angle, sx: 1.3, sy: 1.3 });
  // near arm (in front of torso and weapon)
  const nearUpper = cutArm(idle, NEAR_ARM, 108, NEAR.elbow[1] + 8), nearLower = cutArm(idle, NEAR_ARM, NEAR.elbow[1] - 8, 322);
  limb(nearUpper, NEAR.shoulder, NEAR.elbow, NEAR.shoulder, P.near.elbow, false);
  limb(nearLower, NEAR.elbow, NEAR.hand, P.near.elbow, P.near.hand, false);
  return out;
}
function leftEdgeOfTorso(img, y) { // backpack sits left of ~x 96 on the base sprite
  void img; return y < 140 ? 96 : 94;
}

/** Torso anchor of a frame: horizontal centre of the jacket band, and head top. */
function anchors(img) {
  let sx = 0, n = 0, top = -1;
  for (let y = 0; y < img.h && top < 0; y++) for (let x = 140; x < 280; x++) if (img.alpha(x, y) > 128) { top = y; break; }
  for (let y = 150; y < 290; y++) for (let x = 0; x < img.w; x++) if (img.alpha(x, y) > 128) { sx += x; n++; }
  return { cx: n ? sx / n : 150, top };
}

/** Upper body (aim) + lower body (from frame), seam blended over a few rows. */
function composeAim(upper, frame, base, stripPack = false) {
  const a = anchors(frame), b = base;
  const dx = Math.round(a.cx - b.cx), dy = a.top - b.top;
  const out = new Img(FW + PAD_R, FH);
  out.drawImage(frame, 0, 0, (x, y) => y >= WAIST - 2 && !(y < WAIST + 30 && isArmy(frame, x, y)) && !(stripPack && isPack(x, y)));
  for (let y = 0; y < FH; y++) for (let x = 0; x < out.w; x++) {
    const sy = y - dy, sx = x - dx;
    if (sy >= WAIST + 24) continue;
    const [r, g, bb, al] = upper.get(sx, sy);
    if (!al) continue;
    const fade = sy < WAIST + 8 ? 1 : 1 - (sy - (WAIST + 8)) / 16;
    out.blend(x, y, r, g, bb, al * fade);
  }
  return out;
}
/** Gloves/hands that swing below the hem in walk frames (dark grey glove or skin). */
function isArmy(img, x, y) {
  const [r, g, b, a] = img.get(x, y); if (!a) return false;
  const [h, s, v] = rgb2hsv(r, g, b);
  const skin = h > 8 && h < 32 && s > 0.45 && v > 0.38;
  return skin && (x < 120 || x > 220);
}

// ---------------------------------------------------------------- variants
function classify(r, g, b, x, y, head) {
  const [h, s, v] = rgb2hsv(r, g, b);
  if (y < head.neck) {
    if (v < 0.3 && s < 0.6) return 'hair';
    if (h > 5 && h < 40 && s > 0.3) return 'skin';
    return 'head';
  }
  if (y > 455 && h > 10 && h < 45 && s > 0.25) return 'boots';
  if (y > WAIST + 10) return v < 0.45 && s < 0.35 ? 'pants' : 'other';
  if (x < head.cx - 92) return 'backpack';
  if (h > 8 && h < 32 && s > 0.45 && v > 0.42) return 'skin';
  if (s < 0.25 && v < 0.32) return 'glove';
  return 'jacket';
}
function tintTo(r, g, b, target, keep = 0.18) {
  const L = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
  const k = Math.pow(L / 0.36, 0.95);
  return [target[0] * k * (1 - keep) + r * keep, target[1] * k * (1 - keep) + g * keep, target[2] * k * (1 - keep) + b * keep];
}
function headInfo(img) {
  let top = -1, topX = 0, front = 0;
  for (let y = 0; y < img.h && top < 0; y++) for (let x = 140; x < 290; x++) if (img.alpha(x, y) > 128) { top = y; topX = x; break; }
  // face front: walk right from the head's own column and stop at the first gap,
  // so a rifle held in front of the face is never mistaken for the face
  for (let y = top + 30; y < top + 80; y++) {
    let x = topX; while (x < img.w - 1 && img.alpha(x, y) <= 128 && x < topX + 40) x++;
    while (x < img.w - 1 && img.alpha(x + 1, y) > 128 && x < topX + 70) x++;
    front = Math.max(front, x);
  }
  return { top, front, neck: top + 108, cx: front - 30 };
}

function recolor(img, v) {
  const head = headInfo(img);
  const out = img.clone();
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const [r, g, b, a] = img.get(x, y); if (!a) continue;
    const c = classify(r, g, b, x, y, head);
    let n = null;
    if (c === 'jacket' && v.jacket) n = tintTo(r, g, b, v.jacket);
    else if (c === 'pants' && v.pants) n = tintTo(r, g, b, v.pants, 0.25);
    else if (c === 'backpack' && v.backpack) n = tintTo(r, g, b, v.backpack);
    else if (c === 'skin' && v.skin) n = tintTo(r, g, b, v.blood ? v.skin.map((q) => q * 0.82) : v.skin, v.blood ? 0.12 : 0.3);
    else if (c === 'hair' && v.hair) n = tintTo(r, g, b, v.hair, 0.2);
    if (v.desaturate) { const base = n ?? [r, g, b]; const l = 0.3 * base[0] + 0.59 * base[1] + 0.11 * base[2]; n = base.map((q) => q + (l - q) * v.desaturate); }
    if (v.darken) n = (n ?? [r, g, b]).map((q) => q * v.darken);
    if (n) out.set(x, y, n[0], n[1], n[2], a);
  }
  return { out, head };
}

/** Painted overlays drawn relative to the head (face points to +x). */
function overlays(img, head, v, seed) {
  const R = rng(seed);
  const paint = (cx, cy, rx, ry, col, pred = () => true, grain = 0.12) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && pred(x, y)) {
        const f = 0.82 + 0.3 * (1 - (y - (cy - ry)) / (2 * ry)) + (R() - 0.5) * grain; img.set(x, y, col[0] * f, col[1] * f, col[2] * f, 255);
      }
  };
  const t = head.top, f = head.front, hx = f - 34;
  const opaque = (x, y) => img.alpha(x, y) > 100;
  if (v.longHair) {                         // hair falling behind the head to the shoulders
    const c = hexRGB(v.longHair);
    for (let y = t + 20; y < t + 130; y++) { const w = 18 - (y - t) * 0.05; for (let x = hx - 30; x < hx - 30 + w; x++) if (R() > 0.08) { const k = 0.6 + R() * 0.5; img.blend(x, y, c[0] * k, c[1] * k, c[2] * k, 255); } }
  }
  if (v.ponytail) {
    const c = hexRGB(v.ponytail);
    for (let k = 0; k < 40; k++) paint(hx - 36 - k * 0.25, t + 30 + k * 1.4, 6 - k * 0.08, 4, c, () => true, 0.3);
  }
  if (v.mask) {                             // face mask / gaiter over the lower face (follows the face contour)
    const c = hexRGB(v.mask);
    for (let y = t + 60; y < t + 104; y++) {
      // face front edge on this row
      let fx = -1; for (let x = f + 4; x > hx; x--) if (opaque(x, y)) { fx = x; break; }
      if (fx < 0) continue;
      const topY = t + 62 + (fx - x0Of(hx)) * 0;   // nose bridge
      if (y < topY) continue;
      for (let x = hx - 4; x <= fx + 1; x++) {
        if (!opaque(x, y) && x <= fx) continue;
        const u = (x - (hx - 4)) / Math.max(1, fx + 1 - (hx - 4));
        const fold = (y - t) % 9 === 0 ? 0.82 : 1;
        const k = (0.62 + 0.45 * u) * fold * (y > t + 98 ? 0.8 : 1) + (R() - 0.5) * 0.06;
        img.set(x, y, c[0] * k, c[1] * k, c[2] * k, 255);
      }
      img.set(fx + 2, y, c[0] * 0.5, c[1] * 0.5, c[2] * 0.5, 255);
    }
    for (let x = hx - 26; x < hx - 4; x++) img.set(x, t + 66 + (hx - 4 - x) * -0.12, c[0] * 0.55, c[1] * 0.55, c[2] * 0.55, 255);  // strap
  }
  if (v.cap) {
    const c = hexRGB(v.cap);
    paint(hx - 2, t + 22, 34, 20, c, (x, y) => y < t + 30);
    for (let x = hx + 14; x < f + 14; x++) for (let y = t + 26; y < t + 33; y++) img.set(x, y, c[0] * 0.65, c[1] * 0.65, c[2] * 0.65, 255);
  }
  if (v.beanie) { const c = hexRGB(v.beanie); paint(hx - 4, t + 20, 34, 22, c, (x, y) => y < t + 34); }
  if (v.headphones) {
    const c = [34, 36, 40];
    for (let a = Math.PI * 1.05; a < Math.PI * 1.95; a += 0.01) { const x = hx - 6 + Math.cos(a) * 30, y = t + 44 + Math.sin(a) * 40; for (let k = 0; k < 5; k++) img.set(x, y + k, ...c, 255); }
    paint(hx - 8, t + 52, 11, 14, [44, 48, 54]); paint(hx - 8, t + 52, 4, 5, [90, 200, 220]);
  }
  if (v.blood) {                            // infected: glazed eye, veins, patchy scalp, torn + bloodied clothes
    const eyeY = t + 62, eyeX = f - 13;
    for (let y = eyeY - 2; y <= eyeY + 2; y++) for (let x = eyeX - 3; x <= eyeX + 3; x++) if (opaque(x, y)) img.set(x, y, 214, 220, 196, 255);
    img.set(eyeX + 1, eyeY, 120, 126, 110, 255);
    for (let n = 0; n < 7; n++) {            // dark veins on face/neck
      let x = hx + (R() - 0.3) * 30, y = t + 60 + R() * 50;
      for (let k = 0; k < 18; k++) { if (opaque(x, y)) img.set(x, y, 62, 46, 58, 255); x += (R() - 0.5) * 2.2; y += R() * 1.6; }
    }
    for (let n = 0; n < 140; n++) { const x = hx - 26 + R() * 50, y = t + 4 + R() * 30; const [r, g, b, a] = img.get(x, y); if (a > 100 && r + g + b < 160) { const k = 0.75 + R() * 0.2; img.set(x, y, v.skin[0] * k, v.skin[1] * k, v.skin[2] * k, 255); } }   // patchy scalp
    for (let n = 0; n < 34; n++) {           // blood splotches: mouth, chest, hands, legs
      const cx = n < 6 ? f - 12 : hx - 40 + R() * 120, cy = n < 6 ? t + 88 + R() * 12 : t + 110 + R() * 300, rr = 2 + R() * (n < 6 ? 4 : 7);
      for (let y = cy - rr; y < cy + rr; y++) for (let x = cx - rr; x < cx + rr; x++) if (opaque(x, y) && (x - cx) ** 2 + (y - cy) ** 2 < rr * rr * (0.5 + R() * 0.6)) { const k = 0.6 + R() * 0.5; img.set(x, y, 96 * k, 12 * k, 10 * k, 255); }
    }
    for (let n = 0; n < 16; n++) {           // dark rips in the clothing
      let x = hx - 50 + R() * 110, y = t + 130 + R() * 250;
      for (let k = 0; k < 9; k++) { if (opaque(x, y)) { img.set(x, y, 22, 18, 16, 255); if (opaque(x + 1, y)) img.set(x + 1, y, 40, 34, 30, 255); } x += R() - 0.5; y += 1; }
    }
  }
}

const x0Of = (v) => v;

// ---------------------------------------------------------------- infected posture
function hunch(frame, lean) {
  // rotate everything above the waist forward around the hips; head droops further
  const out = new Img(frame.w, frame.h);
  out.drawImage(frame, 0, 0, (x, y) => y >= WAIST);
  const upper = new Img(frame.w, frame.h); upper.drawImage(frame, 0, 0, (x, y) => y < WAIST + 6);
  out.drawTransformed(upper, { pivotX: 170, pivotY: WAIST, atX: 176, atY: WAIST + 4, angle: lean });
  return out;
}

// ---------------------------------------------------------------- characters
export const CHARACTERS = {
  reed: { base: 'reed', weapon: 'carbine', pose: 'long', look: {} },
  maya: { base: 'reed', weapon: 'pistol', pose: 'pistol', look: { jacket: hexRGB('#6a3a34'), pants: hexRGB('#2e3a4e'), backpack: hexRGB('#7a2a24'), skin: hexRGB('#b07a5a'), mask: '#c9d6d8', ponytail: '#2a1a14' } },
  miller: { base: 'reed', weapon: 'shotgun', pose: 'long', look: { jacket: hexRGB('#7a6a48'), pants: hexRGB('#4a4632'), backpack: hexRGB('#4a4a3a'), skin: hexRGB('#d0957a'), hair: hexRGB('#b8b4ac'), cap: '#55603e' } },
  iris: { base: 'reed', weapon: 'rifle', pose: 'long', look: { jacket: hexRGB('#3a4c6a'), pants: hexRGB('#8a7a5a'), backpack: hexRGB('#3d4a3a'), skin: hexRGB('#d8a888'), mask: '#2f4a52', longHair: '#141416', headphones: true } },
  infected_a: { base: 'reed', infected: true, look: { jacket: hexRGB('#5a5448'), pants: hexRGB('#2e3440'), backpack: hexRGB('#3a3430'), skin: hexRGB('#b4b8a2'), hair: hexRGB('#2a2622'), desaturate: 0.35, darken: 0.88, blood: true } },
  infected_b: { base: 'reed', infected: true, look: { jacket: hexRGB('#6a3a32'), pants: hexRGB('#3a3a3a'), backpack: hexRGB('#2e2a26'), skin: hexRGB('#bcb8a4'), hair: hexRGB('#3a3028'), desaturate: 0.3, darken: 0.85, blood: true } },
  infected_c: { base: 'reed', infected: true, look: { jacket: hexRGB('#3a4a5a'), pants: hexRGB('#4a4032'), backpack: hexRGB('#2a2a2a'), skin: hexRGB('#a8b09c'), hair: hexRGB('#1a1612'), desaturate: 0.4, darken: 0.82, blood: true } },
};

async function loadFrames(dir, name, max = 99) {
  const out = [];
  for (let i = 0; i < max; i++) {
    const f = `${dir}/${name}_${String(i).padStart(2, '0')}.png`;
    if (!existsSync(f)) break;
    out.push(await Img.load(f));
  }
  return out;
}

/** Right-most gun pixel at chest height = muzzle (source frame coords). */
function muzzleOf(img) {
  let best = [0, 0];
  for (let y = 100; y < 220; y++) for (let x = img.w - 1; x > 220; x--) if (img.alpha(x, y) > 100) { if (x > best[0]) best = [x, y]; break; }
  return best;
}

export async function buildCharacters(srcDir, outDir, preview = null) {
  // squad: real painted animation extracted from video (scripts/extract-video.mjs)
  const v = {};
  for (const a of ['idle', 'walk', 'run', 'draw', 'aim']) v[a] = await loadFrames(`${srcDir}/reed`, a);
  const vAnchor = anchors(v.idle[0]);
  // infected: original sample frames (arm surgery → reaching pose)
  const sIdle = await loadFrames(`${srcDir}/reed_sample`, 'idle'), sWalk = await loadFrames(`${srcDir}/reed_sample`, 'walk');
  for (const f of [...sIdle, ...sWalk]) f.removeSpecks(300);
  const pad = (f) => { const o = new Img(FW + PAD_R, FH); o.drawImage(f, 0, 0); return o; };
  const sAnchor = anchors(sIdle[0]);
  const meta = {};
  for (const [id, c] of Object.entries(CHARACTERS)) {
    let anims;
    if (!c.infected) {
      const aimWalk = v.walk.map((f, i) => { const o = composeAim(v.aim[i % v.aim.length], f, vAnchor); o.removeSpecks(260); return o; });
      anims = { idle: v.idle, walk: v.walk, run: v.run, draw: v.draw, aim: v.aim, aimWalk };
    } else {
      const upper = buildAimUpper(sIdle[0], 'reach', null, true);
      const reach = (f) => { const o = composeAim(upper, f, sAnchor, true); o.removeSpecks(260); return o; };
      anims = {
        idle: sIdle.map((f, i) => hunch(reach(pad(f)), 0.14 + 0.025 * Math.sin(i * 0.8))),
        walk: sWalk.map((f, i) => hunch(reach(pad(f)), 0.22 + 0.03 * Math.sin(i * 0.8))),
      };
    }
    const muzzles = {};
    if (!c.infected) for (const k of ['aim', 'aimWalk']) muzzles[k] = anims[k].map(muzzleOf);
    const looked = {};
    let seed = 1;
    for (const [k, frames] of Object.entries(anims)) {
      looked[k] = frames.map((f) => { const { out, head } = recolor(f, c.look); overlays(out, head, c.look, seed++); return out; });
    }
    meta[id] = await packAtlas(id, looked, outDir, preview, muzzles);
    meta[id].parts = await buildParts(id, looked.idle[0], meta[id], outDir, preview);
    meta[id].portrait = await buildPortrait(id, looked.idle[0], outDir);
    console.log(' ', id, Object.entries(looked).map(([k, f]) => `${k}:${f.length}`).join(' '));
  }
  return meta;
}

// ---------------------------------------------------------------- ragdoll parts + portrait
/** Cut the idle pose into 6 masked limbs for the physics ragdoll. Coordinates are
 *  returned in atlas-cell pixels (same space as the animation frames). */
async function buildParts(id, frame, m, outDir, preview) {
  const head = headInfo(frame);
  const neck = head.top + 104, waist = WAIST + 4, knee = 412;
  const rowMid = (y) => { let a = -1, b = -1; for (let x = 0; x < frame.w; x++) if (frame.alpha(x, y) > 100) { if (a < 0) a = x; b = x; } return (a + b) / 2; };
  const owner = (x, y) => {
    if (y < neck && x > head.cx - 58) return 'head';
    if (y < waist + 10) return 'torso';
    const mid = rowMid(Math.min(y, 505));
    const front = x >= mid;
    return y < knee ? (front ? 'thighF' : 'thighB') : (front ? 'shinF' : 'shinB');
  };
  const names = ['head', 'torso', 'thighB', 'shinB', 'thighF', 'shinF'];
  const imgs = Object.fromEntries(names.map((n) => [n, new Img(frame.w, frame.h)]));
  for (let y = 0; y < frame.h; y++) for (let x = 0; x < frame.w; x++) { const p = frame.get(x, y); if (p[3]) imgs[owner(x, y)].set(x, y, ...p); }
  // joints (source px): neck, hips, knees
  const legs = (y) => { const mid = rowMid(y); return [mid - 14, mid + 14]; };
  const [hipB, hipF] = legs(waist + 6), [kneeB, kneeF] = legs(knee);
  const joints = { neck: [head.cx - 20, neck], hipB: [hipB, waist + 6], hipF: [hipF, waist + 6], kneeB: [kneeB, knee], kneeF: [kneeF, knee] };
  const S = OUT_SCALE, x0 = m.trimX, y0 = m.trimY;
  const out = [];
  let ax = 0; const strip = [];
  for (const n of names) {
    const b = imgs[n].bbox(20); if (!b) continue;
    const crop = imgs[n].crop(b.x, b.y, b.w, b.h);
    const w = Math.max(1, Math.round(b.w * S)), h = Math.max(1, Math.round(b.h * S));
    const sc = await crop.resized(w, h);
    strip.push([sc, ax]);
    out.push({ name: n, ax, aw: w, ah: h, x: Math.round((b.x - x0) * S), y: Math.round((b.y - y0) * S) });
    ax += w + 2;
  }
  const H = Math.max(...strip.map(([i]) => i.h));
  const sheet = new Img(ax, H);
  for (const [i, x] of strip) sheet.drawImage(i, x, 0);
  await sheet.save(`${outDir}/${id}_parts.webp`, { quality: 88 });
  if (preview) await sheet.save(`${preview}/${id}_parts.png`, { png: true });
  const J = Object.fromEntries(Object.entries(joints).map(([k, [jx, jy]]) => [k, [Math.round((jx - x0) * S), Math.round((jy - y0) * S)]]));
  return { file: `${id}_parts.webp`, w: ax, h: H, list: out, joints: J };
}

async function buildPortrait(id, frame, outDir) {
  const head = headInfo(frame);
  const size = 120, x = Math.round(head.front - size + 14), y = Math.max(0, head.top - 6);
  const crop = frame.crop(x, y, size, size);
  const bg = new Img(size, size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) { const g = 30 + (j / size) * 22; bg.set(i, j, g * 0.7, g * 0.85, g, 255); }
  bg.drawImage(crop, 0, 0);
  const small = await bg.resized(64, 64);
  await small.save(`${outDir}/${id}_portrait.webp`, { quality: 90 });
  return `${id}_portrait.webp`;
}

/** Scale frames, trim to a shared box, and pack in a grid atlas (WebP). */
async function packAtlas(id, anims, outDir, preview, muzzles = {}) {
  const all = Object.values(anims).flat();
  // common trim box across all frames keeps the baseline and pivot fixed
  let x0 = 1e9, y0 = 1e9, x1 = 0, y1 = 0;
  for (const f of all) { const b = f.bbox(8); if (!b) continue; x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
  x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2);
  const cw = Math.ceil((x1 - x0 + 2) * OUT_SCALE), ch = Math.ceil((FH - y0) * OUT_SCALE);   // keep feet baseline at frame bottom
  const cols = Math.max(...Object.values(anims).map((a) => a.length)), rows = Object.values(anims).filter((a) => a.length).length;
  const atlas = new Img(cols * cw, rows * ch);
  const animMeta = {};
  let row = 0;
  for (const [k, frames] of Object.entries(anims)) {
    if (!frames.length) continue;
    animMeta[k] = { row, count: frames.length };
    if (muzzles[k]) animMeta[k].muzzle = muzzles[k].map(([mx, my]) => [Math.round((mx - x0) * OUT_SCALE), Math.round((my - y0) * OUT_SCALE)]);
    for (let i = 0; i < frames.length; i++) {
      const crop = frames[i].crop(x0, y0, cw / OUT_SCALE | 0, FH - y0);
      const s = await crop.resized(cw, ch);
      atlas.drawImage(s, i * cw, row * ch);
    }
    row++;
  }
  await atlas.save(`${outDir}/${id}.webp`, { quality: 86 });
  if (preview) await atlas.save(`${preview}/${id}.png`, { png: true });
  // pivot (feet centre) in cell pixels: base sprite's feet sit around x≈160 in source space
  const footX = (162 - x0) * OUT_SCALE;
  return { file: `${id}.webp`, cellW: cw, cellH: ch, cols, rows, anims: animMeta, footX: Math.round(footX), figureH: Math.round(500 * OUT_SCALE), headTop: Math.round((13 - y0) * OUT_SCALE), trimX: x0, trimY: y0 };
}
