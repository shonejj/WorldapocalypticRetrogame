import { Painter, hex, shade, mix, type RGB } from '../painter';
import { DIMS, type PartName } from '../../game/rig';

/**
 * Procedural "skin" for the cut-out rig. Every part is painted from an Appearance
 * so survivors, infected and future hand-made art share one interface:
 * a Skin is just { part → texture + pivot }. To use real art later, build a Skin
 * from image files with the same pivots (see makeSkinFromImages TODO in docs).
 */
export const CHAR_PPU = 64;

export interface Appearance {
  skin: string; hair: string;
  hairStyle: 'short' | 'messy' | 'ponytail' | 'buzz' | 'patchy' | 'long';
  beard: 'none' | 'stubble' | 'full';
  headwear: 'none' | 'cap' | 'beanie' | 'headphones' | 'hood';
  top: string; topStyle: 'jacket' | 'hoodie' | 'vest' | 'coat' | 'tshirt' | 'overalls';
  shirt: string; pants: string; boots: string;
  gloves?: string; backpack?: string; scarf?: string;
  infected?: boolean; torn?: number; blood?: number; seed: number;
}

export interface PartArt { painter: Painter; pivot: [number, number]; wM: number; hM: number }
export type Skin = Record<PartName, PartArt>;

const P = CHAR_PPU;
const px = (m: number) => Math.round(m * P);

/** Cylinder shading across a limb: light from the front (+x side). */
function limb(p: Painter, x0: number, y0: number, w: number, h: number, c: RGB, round = true): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (round && (j < 2 || j > h - 3) && (i === 0 || i === w - 1)) continue;
    const t = i / Math.max(1, w - 1);
    const f = 0.72 + 0.42 * Math.sin(t * Math.PI * 0.85 + 0.35) + (p.rng.next() - 0.5) * 0.07;
    p.px(x0 + i, y0 + j, shade(c, f));
  }
}

function dirt(p: Painter, a: Appearance): void {
  const torn = a.torn ?? 0, blood = a.blood ?? 0;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    if (p.alphaAt(x, y) < 128) continue;
    if (p.rng.chance(0.03)) p.tint(x, y, 0.82);
    if (blood && p.rng.chance(blood * 0.05)) p.px(x, y, shade(hex('#4a0f0c'), p.rng.range(0.7, 1.2)));
    if (torn && p.rng.chance(torn * 0.012)) p.erase(x, y);
  }
}

function finish(p: Painter, a: Appearance): void {
  dirt(p, a);
  p.outline(0.5);
  p.rimLight(1, -1, 1.18);
}

function newPart(name: PartName, wM: number, hM: number, pivot: [number, number], a: Appearance): { p: Painter; art: PartArt } {
  const p = new Painter(px(wM), px(hM), a.seed * 31 + name.length * 7 + name.charCodeAt(0));
  return { p, art: { painter: p, pivot, wM: p.w / P, hM: p.h / P } };
}

// ---------------------------------------------------------------- parts
function paintHead(a: Appearance): PartArt {
  const { p, art } = newPart('head', 0.34, 0.38, [px(0.15), px(0.36)], a);
  const skin = hex(a.skin), hair = hex(a.hair);
  const cx = px(0.155), cy = px(0.2);            // skull centre (neck at pivot below)
  // neck
  p.rect(cx - 3, cy + 5, 7, px(0.36) - cy - 4, shade(skin, 0.8));
  // skull + jaw (profile facing +x)
  p.ellipse(cx, cy - 1, 8.5, 9, skin);
  p.poly([[cx - 2, cy + 3], [cx + 9, cy + 1], [cx + 8, cy + 8], [cx + 3, cy + 10], [cx - 3, cy + 8]], skin);
  // nose, brow, lips
  p.rect(cx + 8, cy - 1, 2, 3, shade(skin, 0.95)); p.px(cx + 10, cy + 1, shade(skin, 0.85));
  p.rect(cx + 4, cy - 4, 5, 1, shade(skin, 0.7));
  p.rect(cx + 6, cy + 5, 3, 1, shade(skin, a.infected ? 0.35 : 0.68));
  // face shading: darker towards back of head
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.alphaAt(x, y) > 0) p.tint(x, y, 0.82 + 0.25 * ((x - (cx - 9)) / 19));
  // eye
  if (a.infected) { p.rect(cx + 5, cy - 3, 3, 2, hex('#1a0c0a')); p.px(cx + 6, cy - 3, hex('#c8c2a0')); }
  else { p.rect(cx + 5, cy - 3, 2, 2, hex('#ece6da')); p.px(cx + 6, cy - 3, hex('#2a1e18')); }
  // ear
  p.rect(cx - 1, cy - 2, 3, 4, shade(skin, 0.75)); p.px(cx, cy - 1, shade(skin, 0.55));
  // beard
  if (a.beard !== 'none') {
    const bc = a.beard === 'full' ? hair : shade(hair, 1.15);
    for (let y = cy + 1; y <= cy + 10; y++) for (let x = cx - 2; x <= cx + 9; x++)
      if (p.alphaAt(x, y) > 0 && p.rng.chance(a.beard === 'full' ? 0.9 : 0.45) && !(y === cy + 5 && x >= cx + 6)) p.px(x, y, shade(bc, p.rng.range(0.75, 1.1)));
  }
  // hair
  const hairPix = (x: number, y: number) => p.px(x, y, shade(hair, p.rng.range(0.7, 1.2)));
  {
    for (let y = cy - 11; y <= cy + 4; y++) for (let x = cx - 10; x <= cx + 8; x++) {
      const inSkull = ((x - cx) / 9.5) ** 2 + ((y - cy + 1) / 10) ** 2 <= 1;
      if (!inSkull) continue;
      const topCap = y < cy - 4 + (x > cx + 3 ? 2 : 0);
      const back = x < cx - 1 && y < cy + (a.hairStyle === 'long' || a.hairStyle === 'ponytail' ? 5 : 2);
      if (a.hairStyle === 'buzz' && !(topCap && p.rng.chance(0.6))) continue;
      if (a.hairStyle === 'patchy' && p.rng.chance(0.45)) continue;
      if (topCap || back) hairPix(x, y);
    }
    if (a.hairStyle === 'messy') for (let k = 0; k < 10; k++) hairPix(cx + p.rng.int(-8, 6), cy - 10 - p.rng.int(0, 2));
    if (a.hairStyle === 'ponytail') { for (let k = 0; k < 9; k++) { p.rect(cx - 11 - (k > 4 ? 1 : 0), cy - 4 + k, 3, 1, shade(hair, p.rng.range(0.7, 1.1))); } }
    if (a.hairStyle === 'long') for (let y = cy; y < cy + 10; y++) p.rect(cx - 10, y, 5, 1, shade(hair, p.rng.range(0.7, 1.1)));
  }
  // headwear
  if (a.headwear === 'cap') {
    p.ellipse(cx - 1, cy - 6, 9.5, 5, hex('#4a5a3a')); p.rect(cx + 2, cy - 5, 11, 2, shade(hex('#4a5a3a'), 0.7));
    p.rect(cx - 9, cy - 4, 18, 1, shade(hex('#4a5a3a'), 0.6));
  } else if (a.headwear === 'beanie') {
    p.ellipse(cx - 1, cy - 6, 10, 6.5, hex('#3a3f48')); p.rect(cx - 10, cy - 3, 19, 2, shade(hex('#3a3f48'), 0.8));
  } else if (a.headwear === 'headphones') {
    p.rect(cx - 3, cy - 12, 3, 9, hex('#22262a')); p.ellipse(cx - 1, cy - 1, 3.5, 4.5, hex('#2d3238')); p.px(cx - 1, cy - 1, hex('#5ad1e6'));
  } else if (a.headwear === 'hood') {
    for (let y = cy - 12; y <= cy + 9; y++) for (let x = cx - 12; x <= cx + 6; x++)
      if (((x - cx + 2) / 11) ** 2 + ((y - cy) / 11.5) ** 2 <= 1 && !(x > cx + 1 && y > cy - 6)) p.px(x, y, shade(hex(a.top), p.rng.range(0.6, 0.9)));
  }
  if (a.infected) {             // veins, sunken cheek, bite marks
    for (let k = 0; k < 4; k++) p.line(cx + p.rng.int(-5, 6), cy + p.rng.int(-6, 6), cx + p.rng.int(-5, 6), cy + p.rng.int(-6, 8), hex('#3a2a3a'), 150);
    p.rect(cx + 3, cy + 2, 3, 2, shade(skin, 0.6));
  }
  finish(p, { ...a, torn: 0 });
  return art;
}

function paintTorso(a: Appearance): PartArt {
  // texture: backpack (behind, -x) + torso column; pivot at hip centre
  const packW = a.backpack ? 0.17 : 0.02;
  const W = packW + DIMS.torso.width + 0.05, H = DIMS.torso.len + 0.16;
  const pivot: [number, number] = [px(packW + DIMS.torso.width / 2 + 0.01), px(0.06 + DIMS.torso.len)];
  const { p, art } = newPart('torso', W, H, pivot, a);
  const top = hex(a.top), shirt = hex(a.shirt);
  const x0 = px(packW), w = px(DIMS.torso.width), yTop = px(0.06), h = px(DIMS.torso.len);
  // backpack (behind)
  if (a.backpack) {
    const bp = hex(a.backpack);
    p.texRect(1, yTop + 6, x0 + 4, h - 12, bp, 0.08, 0.2);
    p.rect(2, yTop + 14, x0 - 1, 2, shade(bp, 0.65)); p.rect(3, yTop + h * 0.55, x0 - 2, 7, shade(bp, 0.85));
    p.rect(1, yTop + 2, x0 + 2, 5, shade(hex('#5a5a48'), 1));                         // bedroll
    for (let i = 1; i < x0 + 3; i += 3) p.px(i, yTop + 4, shade(hex('#5a5a48'), 0.7));
  }
  // torso column (slight taper to waist)
  for (let j = 0; j < h; j++) {
    const taper = Math.round((j / h) * 2);
    const c = a.topStyle === 'tshirt' ? shirt : top;
    for (let i = taper; i < w - taper; i++) {
      const t = i / (w - 1);
      p.px(x0 + i, yTop + j, shade(c, 0.74 + 0.38 * Math.sin(t * Math.PI * 0.9 + 0.3) + (p.rng.next() - 0.5) * 0.07));
    }
  }
  const front = x0 + w - 1;
  // collar / shirt peek / zipper / pockets
  if (a.topStyle === 'jacket' || a.topStyle === 'coat' || a.topStyle === 'hoodie') {
    p.rect(front - 5, yTop, 4, 6, shirt);
    p.line(front - 3, yTop + 6, front - 2, yTop + h - 6, shade(top, 0.6));
    p.rect(front - 9, yTop + h * 0.5, 7, 6, shade(top, 0.82)); p.rect(front - 9, yTop + h * 0.5, 7, 1, shade(top, 0.6));
    p.rect(x0 + 2, yTop, w - 4, 3, shade(top, 1.12));                                  // collar
    if (a.topStyle === 'hoodie') p.ellipse(x0 + w / 2 - 3, yTop + 2, w / 2, 4, shade(top, 0.9));
    if (a.topStyle === 'coat') p.rect(x0, yTop + h - 4, w, 8, shade(top, 0.9));
  } else if (a.topStyle === 'vest') {
    p.clearRect(x0, yTop, w, h);
    limb(p, x0, yTop, w, h, shirt, false);
    p.texRect(x0 + 2, yTop + 2, w - 4, h * 0.7, top, 0.08, 0.15);
    for (let k = 0; k < 3; k++) p.rect(x0 + 4 + k * 6, yTop + h * 0.35, 5, 6, shade(top, 0.75));
  } else if (a.topStyle === 'overalls') {
    p.rect(x0 + 4, yTop + h * 0.35, w - 8, h * 0.65, hex(a.pants)); p.rect(x0 + 5, yTop, 3, h * 0.4, hex(a.pants)); p.rect(front - 7, yTop, 3, h * 0.4, hex(a.pants));
    p.rect(front - 10, yTop + h * 0.45, 7, 5, shade(hex(a.pants), 0.8));
  }
  if (a.scarf) { const s = hex(a.scarf); p.rect(x0 + 1, yTop - 2, w - 2, 6, s); p.rect(front - 6, yTop + 3, 4, 10, shade(s, 0.85)); }
  // backpack straps over chest
  if (a.backpack) { p.rect(x0 + w * 0.45, yTop + 2, 3, h * 0.55, shade(hex(a.backpack), 0.6)); p.px(x0 + w * 0.45 + 1, yTop + h * 0.3, hex('#b0a070')); }
  // belt + hips
  const pants = hex(a.pants);
  p.texRect(x0 + 1, yTop + h, w - 2, px(0.09), pants, 0.06, 0.1);
  p.rect(x0, yTop + h - 2, w, 3, hex('#2a2018')); p.rect(front - 6, yTop + h - 2, 3, 3, hex('#a89a6a'));
  if (a.infected) {             // exposed ribs / wounds
    for (let k = 0; k < 4; k++) p.rect(x0 + 6, yTop + 12 + k * 4, w * 0.4, 1, shade(hex(a.skin), 0.55));
  }
  finish(p, a);
  return art;
}

function paintArm(name: PartName, a: Appearance, lower: boolean): PartArt {
  const d = DIMS[name];
  const W = d.width + 0.04, cap = d.width / 2 + 0.01, H = d.len + cap + (lower ? 0.04 : 0.02);
  const { p, art } = newPart(name, W, H, [px(W / 2), px(cap)], a);
  const sleeve = hex(a.topStyle === 'tshirt' || a.topStyle === 'vest' || a.topStyle === 'overalls' ? (lower ? a.skin : a.shirt) : a.top);
  const w = px(d.width), x0 = (p.w - w) >> 1, len = px(d.len);
  if (!lower) {
    limb(p, x0, 1, w, len + px(cap) - 1, sleeve);
    p.rect(x0, px(cap) + len * 0.35, w, 1, shade(sleeve, 0.7));                           // fold
    if (a.topStyle === 'tshirt') { p.clearRect(x0, px(cap) + len * 0.55, w, len * 0.45); limb(p, x0, px(cap) + len * 0.55, w, len * 0.45, hex(a.skin)); }
  } else {
    const handLen = 8, armLen = len + px(cap) - handLen;
    limb(p, x0, 1, w, armLen, sleeve);
    if (sleeve !== hex(a.skin)) p.rect(x0 - 1, armLen - 2, w + 2, 2, shade(sleeve, 0.75));  // cuff
    const hand = a.gloves ? hex(a.gloves) : hex(a.skin);
    limb(p, x0, armLen, w, handLen - 1, hand);
    p.rect(x0 + w - 1, armLen + 2, 2, 4, shade(hand, 0.85));                               // thumb
    if (a.infected) for (let k = 0; k < 3; k++) p.px(x0 + k * 2, armLen + handLen - 1, hex('#2a1a14'));  // claws/nails
  }
  finish(p, a);
  return art;
}

function paintLeg(name: PartName, a: Appearance, lower: boolean): PartArt {
  const d = DIMS[name];
  const toe = lower ? 0.11 : 0;
  const W = d.width + 0.04 + toe, cap = d.width / 2 + 0.01, H = d.len + cap + 0.04;
  const { p, art } = newPart(name, W, H, [px((d.width + 0.04) / 2), px(cap)], a);
  const pants = hex(a.pants), boots = hex(a.boots);
  const w = px(d.width), x0 = 2, len = px(d.len);
  if (!lower) {
    limb(p, x0, 1, w, len + px(cap), pants);
    p.texRect(x0 + 1, px(cap) + len * 0.35, w - 3, 8, shade(pants, 0.9), 0.05, 0.2);     // cargo pocket
    p.rect(x0 + 1, px(cap) + len * 0.35, w - 3, 1, shade(pants, 0.65));
  } else {
    const bootH = 10, shin = len + px(cap) - bootH + 2;
    limb(p, x0, 1, w, shin, pants);
    if ((a.torn ?? 0) < 0.3) p.texRect(x0 + 2, 2, w - 4, 5, shade(pants, 0.8), 0.1, 0);    // knee patch
    // boot: shaft + foot extending forward (+x)
    p.texRect(x0 - 1, shin - 2, w + 2, bootH, boots, 0.08, 0.2);
    p.texRect(x0 + w - 1, shin + 2, px(toe) + 1, bootH - 4, boots, 0.08, 0.2);
    p.rect(x0 - 1, shin + bootH - 3, w + px(toe) + 2, 3, shade(boots, 0.45));             // sole
    for (let k = 0; k < 3; k++) p.px(x0 + w - 3, shin + 1 + k * 2, hex('#a8a090'));     // laces
  }
  finish(p, a);
  return art;
}

export function buildSkin(a: Appearance): Skin {
  return {
    head: paintHead(a), torso: paintTorso(a),
    uArmF: paintArm('uArmF', a, false), lArmF: paintArm('lArmF', a, true),
    uArmB: paintArm('uArmB', a, false), lArmB: paintArm('lArmB', a, true),
    uLegF: paintLeg('uLegF', a, false), lLegF: paintLeg('lLegF', a, true),
    uLegB: paintLeg('uLegB', a, false), lLegB: paintLeg('lLegB', a, true),
  };
}

/** Square portrait for the HUD (head + shoulders), drawn larger via CSS pixelation. */
export function portraitDataURL(skin: Skin, bg = '#1a2630'): string {
  const head = skin.head.painter, torso = skin.torso.painter;
  const S = 32, c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d')!; g.imageSmoothingEnabled = false;
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  head.flush(); torso.flush();
  g.drawImage(torso.canvas, skin.torso.pivot[0] - 14, 0, 28, 14, 2, 22, 28, 14);
  g.drawImage(head.canvas, 0, 0, head.w, head.h, 5, 1, head.w, head.h);
  return c.toDataURL();
}

// ---------------------------------------------------------------- weapons
export type WeaponArt = 'pistol' | 'shotgun' | 'rifle' | 'pipe' | 'radio';
/** Returns painter + grip pivot (pixels). Weapons point to +x. */
export function paintWeapon(kind: WeaponArt): PartArt {
  const metal = hex('#2b2f33'), wood = hex('#5a3a22'), dark = hex('#16181a');
  let p: Painter, pivot: [number, number];
  if (kind === 'pistol') {
    p = new Painter(20, 12, 5); p.rect(2, 1, 17, 4, metal); p.rect(3, 5, 5, 7, dark); p.rect(8, 5, 4, 2, dark); p.rect(16, 2, 3, 2, shade(metal, 1.4));
    pivot = [5, 6];
  } else if (kind === 'shotgun') {
    p = new Painter(64, 12, 6); p.rect(18, 2, 45, 3, metal); p.rect(22, 5, 26, 3, hex('#3a2a1c')); p.poly([[0, 4], [20, 2], [20, 8], [4, 11], [0, 9]], wood); p.rect(14, 6, 6, 5, dark);
    pivot = [17, 8];
  } else if (kind === 'rifle') {
    p = new Painter(74, 13, 7); p.rect(20, 3, 53, 3, metal); p.poly([[0, 5], [26, 3], [44, 4], [44, 8], [26, 8], [4, 12], [0, 10]], wood); p.rect(28, 0, 14, 3, dark); p.rect(30, 8, 4, 5, dark);
    pivot = [27, 9];
  } else if (kind === 'pipe') {
    p = new Painter(56, 7, 8); p.texRect(0, 1, 52, 5, hex('#6a6e6e'), 0.1, 0.3); p.rect(50, 0, 6, 7, hex('#4a4e4e')); p.rect(0, 1, 12, 5, hex('#2a2018'));
    p.streaks(0, 1, 52, 5, hex('#7a4426'), 6, 150); pivot = [5, 3];
  } else {
    p = new Painter(14, 20, 9); p.texRect(2, 6, 10, 14, hex('#3d4a3a'), 0.06, 0.2); p.rect(4, 0, 1, 7, metal); p.rect(4, 9, 6, 3, hex('#7ad1a0')); pivot = [7, 15];
  }
  p.outline(0.6);
  return { painter: p, pivot, wM: p.w / P, hM: p.h / P };
}

/** Recolour helper for variety (used for infected crowds). */
export const jitterColor = (c: string, f: number) => `#${shade(hex(c), f).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
export const mixColor = (a: string, b: string, t: number) => `#${mix(hex(a), hex(b), t).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
