import { Painter, PAL, hex, shade, mix, type RGB } from '../painter';

/** Everything here returns a Painter whose pixel size / PPU = world size in metres.
 *  Bottom row of the canvas sits on the ground line unless noted. */

// ------------------------------------------------------------------ sky & distance
export function paintSky(w: number, h: number, seed: number): Painter {
  const p = new Painter(w, h, seed);
  p.gradRect(0, 0, w, h * 0.55 | 0, PAL.skyTop, PAL.skyMid, 10);
  p.gradRect(0, h * 0.55 | 0, w, h - (h * 0.55 | 0), PAL.skyMid, PAL.skyLow, 10);
  // moon with halo
  const mx = w * 0.72, my = h * 0.18, r = h * 0.045;
  for (let k = 6; k > 0; k--) p.disc(mx, my, r * (1 + k * 0.55), mix(PAL.skyMid, PAL.moon, 0.05), 40);
  p.disc(mx, my, r, PAL.moon);
  for (let n = 0; n < 14; n++) p.disc(mx + p.rng.range(-r * .6, r * .6), my + p.rng.range(-r * .6, r * .6), p.rng.range(1, r * .25), shade(PAL.moon, 0.85));
  // stars (sparse, through cloud gaps)
  for (let n = 0; n < w * 0.05; n++) p.px(p.rng.int(0, w), p.rng.int(0, h * 0.45), shade(PAL.moon, p.rng.range(0.4, 0.9)));
  return p;
}

export function paintClouds(w: number, h: number, seed: number, dark = false): Painter {
  const p = new Painter(w, h, seed);
  const base = dark ? hex('#0b1622') : hex('#1a2c3b');
  for (let n = 0; n < w / 30; n++) {
    const cx = p.rng.range(0, w), cy = p.rng.range(h * 0.2, h * 0.8), rx = p.rng.range(40, 140), ry = p.rng.range(8, 22);
    for (let k = 0; k < 7; k++) p.ellipse(cx + p.rng.range(-rx, rx) * 0.6, cy + p.rng.range(-ry, ry) * 0.5, rx * p.rng.range(0.3, 0.7), ry * p.rng.range(0.5, 1), shade(base, p.rng.range(0.85, 1.25)), 150);
  }
  return p;
}

/** Far skyline silhouettes: towers, cranes, red aviation lights, few lit windows. */
export function paintSkyline(w: number, h: number, seed: number, tone: RGB, litChance: number): Painter {
  const p = new Painter(w, h, seed);
  let x = 0;
  while (x < w) {
    const bw = p.rng.int(18, 60), bh = p.rng.int(h * 0.25, h * 0.92);
    const c = shade(tone, p.rng.range(0.85, 1.1));
    p.rect(x, h - bh, bw, bh, c);
    if (p.rng.chance(0.3)) p.rect(x + bw / 3, h - bh - p.rng.int(6, 18), 2, 18, c);                   // antenna
    if (p.rng.chance(0.25)) p.px(x + bw / 3, h - bh - 18, hex('#ff3a2a'));                              // aviation light
    for (let wy = h - bh + 4; wy < h - 4; wy += 5) for (let wx = x + 3; wx < x + bw - 3; wx += 4)
      if (p.rng.chance(litChance)) p.rect(wx, wy, 2, 2, mix(c, PAL.glassLit, p.rng.range(0.35, 0.8)));
    if (p.rng.chance(0.12)) {                                                                            // crane
      const cx = x + bw / 2, top = h - bh - 40;
      p.rect(cx, top, 2, 40, c); p.line(cx - 30, top, cx + 50, top, c); p.line(cx + 40, top, cx + 40, top + 18, c);
    }
    x += bw + p.rng.int(-6, 10);
  }
  return p;
}

/** Elevated highway: deck + pillars, broken railings, hanging vines. */
export function paintOverpass(w: number, h: number, seed: number): Painter {
  const p = new Painter(w, h, seed);
  const deckY = h * 0.28 | 0, deckH = h * 0.12 | 0;
  for (let x = 30; x < w; x += 110) {
    p.texRect(x, deckY + deckH, 22, h - deckY - deckH, PAL.concreteDark, 0.06, 0.05);
    p.streaks(x, deckY + deckH, 22, h - deckY - deckH, shade(PAL.rust, 0.6), 4, 70);
  }
  p.texRect(0, deckY, w, deckH, PAL.concrete, 0.06, 0.2);
  p.rect(0, deckY + deckH - 3, w, 3, shade(PAL.concreteDark, 0.8));
  for (let x = 0; x < w; x += 6) { if (p.rng.chance(0.85)) p.rect(x, deckY - 8, 2, 8, PAL.metal); }
  p.rect(0, deckY - 9, w, 2, PAL.metal);
  for (let x = 0; x < w; x += p.rng.int(10, 40)) p.ivy(x, deckY + deckH, p.rng.int(6, 30), 1, PAL.leafDark as unknown as RGB[], 2);
  // a few dead cars on the deck
  for (let x = 40; x < w; x += p.rng.int(80, 200)) { p.rect(x, deckY - 12, 26, 8, shade(PAL.metal, 0.6)); p.rect(x + 5, deckY - 16, 14, 5, shade(PAL.metal, 0.5)); }
  // working streetlamps on the deck (glow added by renderer)
  return p;
}

export function paintIndustrial(w: number, h: number, seed: number): Painter {
  const p = new Painter(w, h, seed);
  const tone = hex('#1d2e3a');
  let x = 0;
  while (x < w) {
    const kind = p.rng.int(0, 3);
    if (kind === 0) {           // storage tank
      const tw = p.rng.int(40, 70), th = p.rng.int(40, 80);
      p.rect(x, h - th, tw, th, tone); p.ellipse(x + tw / 2, h - th, tw / 2, 5, shade(tone, 1.2));
      for (let k = 0; k < 4; k++) p.rect(x, h - th + 10 + k * 14, tw, 1, shade(tone, 0.8));
      x += tw + 8;
    } else if (kind === 1) {    // chimney
      const ch = p.rng.int(80, h - 10); p.rect(x, h - ch, 10, ch, shade(tone, 0.9)); p.rect(x - 1, h - ch, 12, 3, shade(tone, 1.2));
      p.px(x + 5, h - ch - 2, hex('#ff3a2a')); x += 22;
    } else if (kind === 2) {    // water tower
      const legs = 50; p.rect(x + 4, h - legs, 2, legs, tone); p.rect(x + 30, h - legs, 2, legs, tone); p.line(x + 4, h - legs, x + 32, h - 4, tone);
      p.rect(x, h - legs - 30, 36, 30, shade(tone, 1.1)); p.poly([[x - 2, h - legs - 30], [x + 18, h - legs - 44], [x + 38, h - legs - 30]], shade(tone, 1.2)); x += 50;
    } else {                    // factory hall with lattice
      const fw = p.rng.int(70, 130), fh = p.rng.int(35, 60); p.rect(x, h - fh, fw, fh, shade(tone, 0.95));
      for (let k = 0; k < fw; k += 12) p.poly([[x + k, h - fh], [x + k + 6, h - fh - 8], [x + k + 12, h - fh]], shade(tone, 0.95));
      for (let k = 6; k < fw - 6; k += 9) if (p.rng.chance(0.15)) p.rect(x + k, h - fh + 12, 4, 6, mix(tone, PAL.glassLit, 0.5));
      x += fw + 6;
    }
  }
  return p;
}

// ------------------------------------------------------------------ street buildings
export interface BuildingSpec {
  kind: 'apartment' | 'store' | 'pharmacy' | 'garage' | 'ruin';
  wPx: number; hPx: number; seed: number;
  sign?: string; signColor?: string; litWindows?: number;
}

const wallMaterials = [PAL.plaster, PAL.brick, PAL.concrete, hex('#6d6a58'), hex('#58625a')];

function paintWall(p: Painter, x: number, y: number, w: number, h: number, base: RGB, brick: boolean): void {
  p.texRect(x, y, w, h, base, 0.05, 0.08);
  if (brick) {
    for (let j = y; j < y + h; j += 4) {
      p.rect(x, j, w, 1, shade(base, 0.78));
      for (let i = x + ((j / 4) % 2 ? 0 : 4); i < x + w; i += 8) p.rect(i, j, 1, 4, shade(base, 0.82));
    }
  } else {
    for (let j = y + 30; j < y + h; j += p.rng.int(30, 60)) p.rect(x, j, w, 1, shade(base, 0.85));
  }
  p.streaks(x, y, w, h, shade(base, 0.55), Math.ceil(w / 12), 80);
  p.streaks(x, y, w, h, shade(PAL.rust, 0.9), Math.ceil(w / 40), 60);
  p.grime(x, y + h - 30, w, 30, 0.25, 0.75);
}

function paintWindow(p: Painter, x: number, y: number, w: number, h: number, lit: boolean, broken: boolean): void {
  p.rect(x - 2, y - 2, w + 4, h + 4, shade(PAL.concreteDark, 0.8));
  p.rect(x, y, w, h, lit ? PAL.glassLit : PAL.glassDark);
  if (lit) { p.gradRect(x, y, w, h, shade(PAL.glassLit, 1.1), shade(PAL.glassLit, 0.65), 4); p.rect(x + w / 2, y, 1, h, shade(PAL.glassLit, 0.5)); }
  else {
    p.px(x + 2, y + 2, PAL.glassCold); p.line(x + 1, y + h - 2, x + w - 3, y + 1, mix(PAL.glassDark, PAL.glassCold, 0.4));
    p.rect(x + w / 2, y, 1, h, shade(PAL.concreteDark, 0.7)); p.rect(x, y + h / 2, w, 1, shade(PAL.concreteDark, 0.7));
  }
  if (broken) for (let k = 0; k < 8; k++) p.px(x + p.rng.int(0, w), y + p.rng.int(0, h), hex('#05080b'));
  p.rect(x - 3, y + h + 2, w + 6, 2, shade(PAL.concrete, 1.1));    // sill
  if (p.rng.chance(0.3)) p.rect(x - 1, y - 1, w + 2, h * 0.4, shade(hex('#5a3a2a'), 0.9));   // half-drawn blind
}

/** Store front shared by store/pharmacy: awning, sign board, glowing display, shutter, door. */
function paintShopfront(p: Painter, x: number, groundY: number, w: number, spec: BuildingSpec): { doorX: number } {
  const fh = 120, y = groundY - fh;
  p.texRect(x, y, w, fh, shade(PAL.concreteDark, 0.9), 0.05, 0);
  // display window (warm interior with shelves)
  const wx = x + 12, ww = Math.floor(w * 0.42), wy = y + 34, wh = 70;
  p.gradRect(wx, wy, ww, wh, hex('#f2c071'), hex('#7a4f27'), 6);
  for (let s = 0; s < 3; s++) {
    const sy = wy + 16 + s * 20; p.rect(wx, sy, ww, 2, hex('#4a2f1a'));
    for (let i = wx + 2; i < wx + ww - 4; i += 4) {
      const produce = spec.kind === 'store'
        ? p.rng.pick([hex('#7a8a2a'), hex('#a5462a'), hex('#c7782a'), hex('#5c6e24'), hex('#6b4a2a')])
        : p.rng.pick([hex('#d8d8d0'), hex('#5f8fb0'), hex('#c04a3a'), hex('#e0c060')]);
      p.rect(i, sy - 4, 3, 4, shade(produce, p.rng.range(0.6, 1)));
    }
  }
  p.rect(wx - 3, wy - 3, ww + 6, 3, PAL.metal); p.rect(wx - 3, wy + wh, ww + 6, 4, PAL.metal);
  for (let k = 0; k < 18; k++) p.px(wx + p.rng.int(0, ww), wy + p.rng.int(0, wh), hex('#fff1c8'), 120);     // dust glints
  // crack in glass
  p.line(wx + ww * 0.6, wy, wx + ww * 0.75, wy + wh * 0.5, hex('#fff6dd')); p.line(wx + ww * 0.75, wy + wh * 0.5, wx + ww * 0.68, wy + wh, hex('#fff6dd'));
  // door
  const doorX = wx + ww + 14, dw = 34;
  p.rect(doorX, y + 30, dw, fh - 30, hex('#14100c')); p.rect(doorX + 3, y + 34, dw - 6, 40, shade(hex('#f2c071'), 0.55));
  p.rect(doorX - 2, y + 28, dw + 4, 3, PAL.metal);
  // rolling shutter (half down) over remaining frontage
  const sx = doorX + dw + 10, sw = x + w - sx - 10;
  if (sw > 20) {
    p.texRect(sx, y + 30, sw, fh - 30, PAL.metal, 0.05, 0.1);
    for (let j = y + 32; j < groundY; j += 3) p.rect(sx, j, sw, 1, shade(PAL.metal, 0.7));
    p.streaks(sx, y + 30, sw, fh - 30, PAL.rust, Math.ceil(sw / 6), 120);
    p.text('NO ENTRY', sx + sw / 2, y + 60, 9, hex('#c8cfc7'), { align: 'center', font: 'monospace', bold: true, worn: 0.3 });
  }
  // awning stripes
  const ay = y + 6, ah = 22;
  const stripeA = spec.kind === 'store' ? hex('#3f6b39') : hex('#2e5c7c'), stripeB = hex('#c9c2a6');
  for (let i = 0; i < w + 8; i++) {
    const c = Math.floor(i / 9) % 2 ? stripeA : stripeB;
    for (let j = 0; j < ah; j++) {
      if (j > ah - 6 && (i % 9 === 0 || p.rng.chance(0.04))) continue;   // scalloped/torn edge
      p.px(x - 4 + i, ay + j + Math.floor(j * 0.12), shade(c, 0.95 - j * 0.012 + (p.rng.next() - 0.5) * 0.08));
    }
  }
  p.streaks(x - 4, ay, w + 8, ah, shade(hex('#3a2a1a'), 1), Math.ceil(w / 8), 90);
  // sign board
  if (spec.sign) {
    const sbY = y - 44, sbH = 36, sbX = x + 6, sbW = w - 12;
    p.texRect(sbX, sbY, sbW, sbH, hex(spec.signColor ?? '#2b4a2a'), 0.06, 0.15);
    p.rect(sbX, sbY, sbW, 2, shade(PAL.metal, 1.2)); p.rect(sbX, sbY + sbH - 2, sbW, 2, shade(PAL.metal, 0.7));
    const size = Math.min(26, Math.floor((sbW - 16) / (spec.sign.length * 0.72)));
    p.text(spec.sign, sbX + sbW / 2 + 1, sbY + (sbH - size) / 2 + 2, size, hex('#0d0b08'), { align: 'center', bold: true });
    p.text(spec.sign, sbX + sbW / 2, sbY + (sbH - size) / 2, size, hex('#eadfb8'), { align: 'center', bold: true, worn: 0.07 });
    p.streaks(sbX, sbY, sbW, sbH, shade(PAL.rust, 0.8), Math.ceil(sbW / 10), 110);
    // two hooded sign lamps
    for (const lx of [sbX + 20, sbX + sbW - 26]) { p.rect(lx, sbY - 10, 8, 4, PAL.metal); p.rect(lx + 3, sbY - 6, 2, 6, PAL.metal); }
  }
  return { doorX };
}

export function paintBuilding(spec: BuildingSpec): Painter {
  const { wPx: w, hPx: h } = spec;
  const p = new Painter(w, h, spec.seed);
  const base = spec.kind === 'pharmacy' ? hex('#6f7a74') : spec.kind === 'store' ? hex('#7d6a52') : p.rng.pick(wallMaterials);
  const brick = spec.kind !== 'pharmacy' && p.rng.chance(0.5);
  const roofY = spec.kind === 'ruin' ? 0 : 10;
  paintWall(p, 0, roofY, w, h - roofY, base, brick);
  // roof line, parapet, water tank / AC units
  p.rect(0, roofY, w, 5, shade(base, 1.2)); p.rect(0, roofY + 5, w, 2, shade(base, 0.6));
  if (spec.kind !== 'ruin' && p.rng.chance(0.6)) { const tx = p.rng.int(10, w - 50); p.rect(tx, 0, 34, roofY + 2, PAL.metal); p.rect(tx + 4, 2, 26, 2, shade(PAL.metal, 1.3)); }
  // windows grid (upper floors)
  const ground = spec.kind === 'store' || spec.kind === 'pharmacy' ? 160 : spec.kind === 'garage' ? 110 : 30;
  const floors = Math.max(0, Math.floor((h - roofY - ground - 20) / 64));
  const cols = Math.max(1, Math.floor((w - 20) / 52));
  const lit = spec.litWindows ?? 0.12;
  for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
    const wx = 16 + c * ((w - 32) / cols) + ((w - 32) / cols - 26) / 2, wy = roofY + 26 + f * 64;
    paintWindow(p, wx | 0, wy, 26, 34, p.rng.chance(lit), p.rng.chance(0.2));
    if (p.rng.chance(0.25)) {                                    // AC unit / laundry line
      p.texRect(wx + 30, wy + 10, 14, 10, hex('#b3b3a8'), 0.05, 0.1); p.rect(wx + 31, wy + 12, 12, 1, hex('#77776f'));
    }
  }
  // ground floor
  if (spec.kind === 'store' || spec.kind === 'pharmacy') {
    paintShopfront(p, 0, h, w, spec);
    if (spec.kind === 'pharmacy') {                              // green cross sign
      const cx = w - 30, cy = h - 220; p.rect(cx - 12, cy - 4, 24, 8, hex('#2fb35a')); p.rect(cx - 4, cy - 12, 8, 24, hex('#2fb35a'));
    }
  } else if (spec.kind === 'garage') {
    const gx = 20, gw = w - 40, gy = h - 100;
    p.texRect(gx, gy, gw, 100, PAL.metal, 0.05, 0.1);
    for (let j = gy; j < h; j += 4) p.rect(gx, j, gw, 1, shade(PAL.metal, 0.7));
    p.streaks(gx, gy, gw, 100, PAL.rust, gw / 4, 120);
    p.text('AUTO REPAIR', w / 2, gy - 26, 16, hex('#c7b37a'), { align: 'center', bold: true, worn: 0.15 });
  } else {
    const dx = w / 2 - 16; p.rect(dx, h - 70, 32, 70, hex('#1a1411')); p.rect(dx - 3, h - 73, 38, 3, shade(base, 1.2));
    p.rect(dx + 24, h - 38, 3, 3, PAL.metal);
  }
  // graffiti tag + posters
  if (p.rng.chance(0.6)) p.text(p.rng.pick(['NO CURE', 'GOD HELP US', 'QUARANTINE', 'HELP', '←SAFE?']), p.rng.int(20, w - 120), h - p.rng.int(150, 230), 14, p.rng.pick([hex('#b23a2a'), hex('#d8d8d0'), hex('#4fa3b8')]), { worn: 0.35 });
  for (let n = 0; n < 3; n++) { const px = p.rng.int(5, w - 25); const py = h - p.rng.int(40, 140); p.texRect(px, py, 14, 18, hex('#c2b89a'), 0.1, 0); p.rect(px + 2, py + 3, 10, 2, hex('#a03a2a')); }
  // ruin: broken top, rebar
  if (spec.kind === 'ruin') {
    for (let x = 0; x < w; x++) { const cut = Math.floor(30 + Math.sin(x * 0.05) * 20 + p.rng.range(0, 25)); for (let y = 0; y < cut; y++) p.erase(x, y); }
    for (let n = 0; n < 8; n++) { const rx = p.rng.int(5, w - 5); p.line(rx, 40, rx + p.rng.int(-6, 6), 20, PAL.rust); }
    for (let x = 0; x < w; x++) for (let y = 0; y < 80; y++) if (p.alphaAt(x, y) > 0 && p.rng.chance(0.002)) p.ivy(x, y, 30, 1, PAL.leaf as unknown as RGB[]);
  }
  // overgrowth: ivy from ground and roof
  const ivyN = Math.ceil(w / 45);
  for (let n = 0; n < ivyN; n++) p.ivy(p.rng.int(0, w), h - 1, p.rng.int(40, h * 0.7), -1, PAL.leaf as unknown as RGB[], 3);
  for (let n = 0; n < ivyN; n++) p.ivy(p.rng.int(0, w), roofY + 6, p.rng.int(20, 90), 1, PAL.leaf as unknown as RGB[], 3);
  p.grass(0, w, h - 1, 12, 0.5, PAL.grass as unknown as RGB[]);
  p.rimLight(0, -1, 1.15);
  return p;
}

// ------------------------------------------------------------------ vehicles
export type VehicleKind = 'sedan' | 'hatch' | 'suv' | 'bus' | 'truck';
export function paintVehicle(kind: VehicleKind, seed: number): Painter {
  const dims: Record<VehicleKind, [number, number]> = { sedan: [290, 95], hatch: [250, 95], suv: [300, 120], bus: [720, 205], truck: [520, 210] };
  const [w, h] = dims[kind];
  const p = new Painter(w, h, seed);
  const paint = p.rng.pick([hex('#7a6f4a'), hex('#5a6a6a'), hex('#8a3a2a'), hex('#c9c2a6'), hex('#3a4a5a'), hex('#6d7a52')]);
  const wheelR = kind === 'bus' || kind === 'truck' ? 22 : 15;
  const groundY = h - 1;
  const body = (pts: [number, number][], c: RGB) => p.poly(pts, c);
  if (kind === 'bus') {
    body([[4, 20], [w - 10, 20], [w - 2, 40], [w - 2, groundY - 18], [4, groundY - 18]], hex('#8c7a4a'));
    p.rect(4, 90, w - 6, 10, hex('#7a2a22'));                                  // livery stripe
    for (let x = 20; x < w - 70; x += 46) paintWindow(p, x, 32, 38, 44, false, p.rng.chance(0.5));
    p.rect(w - 50, 30, 40, 70, PAL.glassDark);
    p.rect(30, 108, 40, groundY - 18 - 108, hex('#2a2a24'));                    // door
  } else if (kind === 'truck') {
    p.texRect(4, 10, w - 150, groundY - 40, hex('#b8b0a0'), 0.04, 0.1);                       // container
    for (let x = 10; x < w - 150; x += 10) p.rect(x, 12, 2, groundY - 44, hex('#8f897c'));
    for (let k = 0; k < 6; k++) p.poly([[40 + k * 50, 120], [60 + k * 50, 120], [40 + k * 50 + 40, 60], [20 + k * 50 + 40, 60]], hex('#a8322a'));
    body([[w - 140, 60], [w - 50, 60], [w - 6, 110], [w - 4, groundY - 18], [w - 140, groundY - 18]], shade(paint, 1.1));
    p.rect(w - 95, 70, 40, 34, PAL.glassDark);
  } else {
    const roof = kind === 'suv' ? 12 : 22, cabinL = kind === 'hatch' ? 0.3 : 0.28, cabinR = kind === 'hatch' ? 0.82 : 0.7;
    body([[6, h * 0.45], [w * 0.2, h * 0.42], [w * cabinL, roof], [w * cabinR, roof], [w * 0.82, h * 0.42], [w - 4, h * 0.48], [w - 2, groundY - 12], [4, groundY - 12]], paint);
    p.poly([[w * cabinL + 6, roof + 5], [w * 0.5 - 3, roof + 5], [w * 0.5 - 3, h * 0.42], [w * 0.24, h * 0.42]], PAL.glassDark);
    p.poly([[w * 0.5 + 3, roof + 5], [w * cabinR - 4, roof + 5], [w * 0.78, h * 0.42], [w * 0.5 + 3, h * 0.42]], PAL.glassDark);
    p.rect(w * 0.5 - 2, h * 0.45, 1, h * 0.35, shade(paint, 0.6));
    p.rect(w - 14, h * 0.5, 8, 6, hex('#d9cfa0')); p.rect(6, h * 0.5, 6, 6, hex('#8a1d16'));
  }
  // shading/rust/dirt/moss, flat tyres
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (p.alphaAt(x, y) === 0) continue;
    if (y > h * 0.62) p.tint(x, y, 0.8);
    if (p.rng.chance(0.012)) p.px(x, y, shade(PAL.rust, p.rng.range(0.7, 1.2)));
  }
  p.streaks(0, 0, w, h, PAL.rust, w / 6, 110);
  p.grime(0, h * 0.6, w, h * 0.4, 0.3, 0.7);
  const wheels = kind === 'bus' ? [90, w - 120] : kind === 'truck' ? [80, 220, w - 70] : [w * 0.2, w * 0.8];
  for (const wx of wheels) {
    p.disc(wx, groundY - wheelR + 4, wheelR + 3, shade(paint, 0.4));
    p.ellipse(wx, groundY - wheelR + 6, wheelR, wheelR - 3, hex('#141414'));
    p.disc(wx, groundY - wheelR + 6, wheelR * 0.45, hex('#3a3a36'));
  }
  // moss & weeds on roof and wheel arches
  for (let n = 0; n < w / 20; n++) p.ivy(p.rng.int(0, w), p.rng.int(0, h * 0.4), p.rng.int(3, 12), 1, PAL.leaf as unknown as RGB[], 2);
  p.grass(0, w, groundY, 14, 0.35, PAL.grass as unknown as RGB[]);
  p.outline(0.55);
  p.rimLight(0, -1, 1.25);
  return p;
}

// ------------------------------------------------------------------ props (gameplay plane, near PPU)
export function paintBarrel(seed: number, color = PAL.rust): Painter {
  const p = new Painter(38, 56, seed);
  p.texRect(2, 2, 34, 54, color, 0.1, 0.15);
  for (let x = 2; x < 36; x++) { const f = 0.7 + 0.5 * Math.sin(((x - 2) / 34) * Math.PI); for (let y = 2; y < 56; y++) p.tint(x, y, f); }
  for (const y of [4, 20, 38, 53]) p.rect(1, y, 36, 3, shade(color, 0.7));
  p.ellipse(19, 4, 17, 3, shade(color, 1.2));
  p.streaks(2, 2, 34, 54, shade(PAL.rust, 0.6), 10, 140);
  if (p.rng.chance(0.5)) { p.rect(9, 26, 20, 9, PAL.hazardYellow); p.text('☣', 19, 25, 10, hex('#111'), { align: 'center', font: 'sans-serif' }); }
  p.outline(0.5);
  return p;
}

export function paintCrate(seed: number, w = 52, h = 46): Painter {
  const p = new Painter(w, h, seed);
  p.texRect(0, 0, w, h, PAL.wood, 0.12, 0.15);
  for (let y = 0; y < h; y += 9) p.rect(0, y, w, 1, PAL.woodDark);
  p.rect(0, 0, 4, h, PAL.woodDark); p.rect(w - 4, 0, 4, h, PAL.woodDark); p.rect(0, 0, w, 4, PAL.woodDark); p.rect(0, h - 4, w, 4, PAL.woodDark);
  p.thickLine(3, 3, w - 4, h - 4, 4, shade(PAL.wood, 0.85));
  p.grime(0, 0, w, h, 0.15, 0.7);
  p.outline(0.55);
  return p;
}

export function paintCone(seed: number): Painter {
  const p = new Painter(22, 34, seed);
  p.poly([[11, 0], [16, 28], [6, 28]], hex('#d4602a'));
  p.rect(8, 10, 6, 4, PAL.white); p.rect(7, 18, 8, 4, PAL.white);
  p.rect(1, 28, 20, 6, hex('#2a2a26'));
  p.grime(0, 0, 22, 34, 0.2, 0.7); p.outline(0.5);
  return p;
}

export function paintBarrier(seed: number): Painter {
  const p = new Painter(110, 52, seed);
  p.poly([[8, 6], [102, 6], [110, 52], [0, 52]], hex('#a9a69a'));
  for (let x = -40; x < 120; x += 22) p.poly([[x, 52], [x + 10, 52], [x + 40, 6], [x + 30, 6]], hex('#b2342a'));
  for (let y = 0; y < 52; y++) for (let x = 0; x < 110; x++) if (p.alphaAt(x, y) && !(y >= 6 && x >= 8 - (y - 6) * 8 / 46 && x <= 102 + (y - 6) * 8 / 46)) p.erase(x, y);
  p.grime(0, 0, 110, 52, 0.25, 0.7); p.streaks(0, 6, 110, 46, shade(PAL.rust, 0.6), 12, 120);
  p.outline(0.55);
  return p;
}

export function paintDumpster(seed: number): Painter {
  const p = new Painter(140, 90, seed);
  p.poly([[6, 14], [134, 14], [128, 82], [12, 82]], hex('#2d5a3a'));
  p.rect(2, 8, 136, 8, shade(hex('#2d5a3a'), 0.8));
  for (let x = 20; x < 130; x += 24) p.rect(x, 18, 3, 60, shade(hex('#2d5a3a'), 0.75));
  p.disc(22, 84, 6, hex('#151515')); p.disc(118, 84, 6, hex('#151515'));
  p.streaks(6, 14, 128, 68, PAL.rust, 20, 140); p.grime(0, 0, 140, 90, 0.2, 0.7);
  for (let n = 0; n < 5; n++) p.ellipse(p.rng.int(20, 120), 8, p.rng.int(8, 14), 6, hex('#141618'));   // trash bags
  p.outline(0.55);
  return p;
}

export function paintStreetLamp(seed: number, h = 340): Painter {
  const p = new Painter(80, h, seed);
  p.texRect(14, 20, 6, h - 20, PAL.metal, 0.08, 0);
  p.rect(10, h - 14, 14, 14, shade(PAL.metal, 0.7));
  p.thickLine(17, 22, 30, 8, 4, PAL.metal); p.rect(30, 6, 44, 5, PAL.metal);
  p.poly([[44, 11], [74, 11], [70, 18], [48, 18]], shade(PAL.metal, 0.75));
  p.rect(50, 17, 18, 2, PAL.lamp);
  p.streaks(14, 20, 6, h, PAL.rust, 4, 120);
  p.ivy(17, h - 1, 120, -1, PAL.leaf as unknown as RGB[], 3);
  p.outline(0.6);
  return p;
}

export function paintPowerPole(seed: number, h = 520): Painter {
  const p = new Painter(70, h, seed);
  p.texRect(31, 0, 8, h, PAL.woodDark, 0.12, 0);
  p.rect(5, 26, 60, 5, PAL.woodDark); p.rect(10, 60, 50, 4, PAL.woodDark);
  for (const x of [8, 22, 48, 62]) p.rect(x, 21, 3, 5, hex('#8a9a9a'));
  p.texRect(40, 110, 18, 26, hex('#6a6a62'), 0.06, 0.15);                                        // transformer
  p.texRect(24, 200, 22, 30, hex('#b9b1a0'), 0.1, 0); p.text('LOST', 35, 206, 7, hex('#222'), { align: 'center', font: 'monospace' });
  p.ivy(35, h - 1, 260, -1, PAL.leaf as unknown as RGB[], 4);
  p.outline(0.6);
  return p;
}

export function paintFence(seed: number, w = 320, h = 150): Painter {
  const p = new Painter(w, h, seed);
  for (let x = 0; x < w; x += 80) p.texRect(x, 0, 5, h, PAL.metal, 0.08, 0);
  p.rect(0, 4, w, 3, PAL.metal);
  for (let y = 8; y < h; y++) for (let x = 0; x < w; x++) if ((x + y) % 7 === 0 || (x - y + 700) % 7 === 0) if (!(x > w * 0.55 && x < w * 0.7 && y > h * 0.4)) p.px(x, y, shade(PAL.metal, 0.9), 200);
  for (let x = 0; x < w; x += 3) p.px(x, 2 + (x % 6 < 3 ? 0 : 1), shade(PAL.metal, 1.2));          // barbed wire
  for (let n = 0; n < w / 18; n++) p.ivy(p.rng.int(0, w), h - 1, p.rng.int(20, h), -1, PAL.leaf as unknown as RGB[], 4);
  p.grass(0, w, h - 1, 22, 0.8, PAL.grass as unknown as RGB[]);
  return p;
}

export function paintBillboard(seed: number, text: string): Painter {
  const p = new Painter(300, 260, seed);
  p.texRect(140, 140, 10, 120, PAL.metal, 0.08, 0); p.texRect(60, 160, 8, 100, PAL.metal, 0.08, 0);
  p.texRect(0, 0, 300, 150, hex('#c9c2a6'), 0.06, 0.1);
  p.gradRect(8, 8, 284, 134, hex('#7aa2b8'), hex('#d6c79a'), 6);
  p.text(text, 150, 40, 30, hex('#a8322a'), { align: 'center', bold: true, worn: 0.12 });
  p.text('A HEALTHIER TOMORROW', 150, 86, 12, hex('#2a3a4a'), { align: 'center', bold: true, worn: 0.2 });
  for (let n = 0; n < 40; n++) { const x = p.rng.int(8, 280), y = p.rng.int(8, 120); p.rect(x, y, p.rng.int(6, 30), p.rng.int(4, 18), hex('#4a4a42')); }   // torn paper
  p.streaks(0, 0, 300, 150, shade(PAL.rust, 0.7), 30, 120);
  p.ivy(145, 259, 200, -1, PAL.leaf as unknown as RGB[], 4);
  p.outline(0.6);
  return p;
}

/** Radio relay shack with lattice mast (chapter 1 goal). */
export function paintRelay(seed: number): Painter {
  const p = new Painter(300, 760, seed);
  const mastX = 210;
  for (let y = 40; y < 640; y++) { const half = 6 + (y - 40) * 0.025; p.px(mastX - half, y, PAL.metal); p.px(mastX + half, y, PAL.metal); }
  for (let y = 40; y < 640; y += 18) { const half = 6 + (y - 40) * 0.025; p.line(mastX - half, y, mastX + half + 0.45, y + 18, shade(PAL.metal, 0.8)); p.line(mastX + half, y, mastX - half - 0.45, y + 18, shade(PAL.metal, 0.8)); }
  p.rect(mastX - 14, 70, 28, 6, PAL.metal); p.disc(mastX - 20, 120, 10, hex('#9aa2a2')); p.disc(mastX + 22, 160, 8, hex('#9aa2a2'));
  p.texRect(10, 610, 210, 150, hex('#6d6a58'), 0.06, 0.12);
  p.rect(4, 600, 222, 12, shade(PAL.metal, 0.8));
  p.rect(30, 660, 40, 100, hex('#2a2a24')); p.rect(100, 650, 60, 34, PAL.glassDark);
  p.text('RELAY 7', 130, 690, 16, hex('#c9a227'), { align: 'center', bold: true, worn: 0.1 });
  p.rect(150, 620, 30, 8, PAL.hazardYellow);
  p.streaks(10, 610, 210, 150, PAL.rust, 30, 120); p.grime(10, 700, 210, 60, 0.3, 0.7);
  p.ivy(20, 759, 140, -1, PAL.leaf as unknown as RGB[], 4);
  p.grass(0, 300, 759, 16, 0.7, PAL.grass as unknown as RGB[]);
  p.outline(0.6);
  return p;
}

// ------------------------------------------------------------------ vegetation / foreground
export function paintBush(seed: number, w = 160, h = 90, dark = false): Painter {
  const p = new Painter(w, h, seed);
  const pal = (dark ? PAL.leafDark : PAL.leaf) as unknown as RGB[];
  for (let n = 0; n < (w * h) / 60; n++) {
    const x = p.rng.range(6, w - 6), y = p.rng.range(h * 0.25, h - 2);
    const r = p.rng.range(3, 10) * (1 - (h - y) / h * 0.4);
    p.disc(x, y, r, shade(p.rng.pick(pal), 0.7 + (1 - y / h) * 0.5));
  }
  p.grass(0, w, h - 1, h * 0.6, 0.6, pal);
  p.rimLight(0, -1, 1.3);
  return p;
}

export function paintTree(seed: number, w = 360, h = 620): Painter {
  const p = new Painter(w, h, seed);
  const trunkX = w * 0.45;
  p.poly([[trunkX - 14, h], [trunkX + 16, h], [trunkX + 8, h * 0.3], [trunkX - 4, h * 0.3]], hex('#2a2018'));
  for (let k = 0; k < 6; k++) { const by = h * (0.3 + k * 0.08); p.thickLine(trunkX, by, trunkX + p.rng.range(-120, 120), by - p.rng.range(40, 120), 5, hex('#2a2018')); }
  for (let n = 0; n < 180; n++) {
    const x = trunkX + p.rng.range(-w * 0.45, w * 0.45), y = p.rng.range(10, h * 0.55), r = p.rng.range(8, 22);
    p.disc(x, y, r, shade(p.rng.pick(PAL.leafDark as unknown as RGB[]), 0.8 + (1 - y / h) * 0.4));
  }
  for (let n = 0; n < 60; n++) p.disc(trunkX + p.rng.range(-w * 0.4, w * 0.4), p.rng.range(10, h * 0.45), p.rng.range(3, 7), p.rng.pick(PAL.leaf as unknown as RGB[]));
  p.rimLight(1, -1, 1.25);
  return p;
}

/** Hanging vines / leaf canopy for the top edge of the extreme foreground. */
export function paintCanopy(seed: number, w = 900, h = 260): Painter {
  const p = new Painter(w, h, seed);
  for (let n = 0; n < w / 4; n++) p.disc(p.rng.range(0, w), p.rng.range(0, h * 0.3), p.rng.range(6, 22), p.rng.pick(PAL.leafDark as unknown as RGB[]));
  for (let n = 0; n < w / 22; n++) p.ivy(p.rng.int(0, w), h * 0.25, p.rng.int(20, h * 0.75), 1, PAL.leafDark as unknown as RGB[], 4);
  p.thickLine(0, h * 0.18, w, h * 0.26, 3, hex('#1a1612'));        // sagging cable
  return p;
}

/** Ground cross-section strip: sidewalk top surface, curb, wet street below. Tileable horizontally. */
export function paintGround(w: number, h: number, seed: number): Painter {
  const p = new Painter(w, h, seed);
  const top = 10;
  p.texRect(0, 0, w, top, shade(PAL.concrete, 0.9), 0.08, 0.25);                       // walkable surface (seen at a grazing angle)
  for (let x = 0; x < w; x += 64) p.rect(x, 0, 1, top, shade(PAL.concreteDark, 0.8));
  p.texRect(0, top, w, 8, PAL.curb, 0.06, 0.1);                                         // curb face
  p.gradRect(0, top + 8, w, h - top - 8, PAL.asphaltWet, hex('#0c1014'), 6);           // wet road below / dark
  for (let n = 0; n < w / 30; n++) {                                                    // puddles catching sky
    const px = p.rng.int(0, w), pw = p.rng.int(20, 80);
    p.ellipse(px, top + 22 + p.rng.int(0, 20), pw, 4, mix(PAL.asphaltWet, PAL.skyLow, 0.7), 200);
  }
  for (let n = 0; n < w / 4; n++) p.px(p.rng.int(0, w), p.rng.int(0, top), shade(PAL.concrete, p.rng.range(0.5, 1.3)));
  for (let n = 0; n < w / 40; n++) { const cx = p.rng.int(0, w); p.line(cx, 0, cx + p.rng.int(-8, 8), top, shade(PAL.concreteDark, 0.6)); }
  p.grass(0, w, top, 9, 0.12, PAL.grass as unknown as RGB[]);
  // seamless wrap: copy left edge columns onto the right
  return p;
}

/** Soft radial glow (used additively for lamps, windows, fires, muzzle flashes). */
export function paintGlow(size: number, c: RGB, falloff = 2): Painter {
  const p = new Painter(size, size, 1);
  const r = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x + 0.5 - r, y + 0.5 - r) / r;
    if (d < 1) p.px(x, y, c, Math.pow(1 - d, falloff) * 255);
  }
  return p;
}

/** Light cone (top apex) for street lamps / flashlights. */
export function paintCone2(w: number, h: number, c: RGB): Painter {
  const p = new Painter(w, h, 1);
  for (let y = 0; y < h; y++) {
    const half = (w / 2) * (0.08 + 0.92 * (y / h));
    for (let x = 0; x < w; x++) {
      const dx = Math.abs(x + 0.5 - w / 2) / half;
      if (dx < 1) p.px(x, y, c, (1 - dx) ** 1.5 * (1 - y / h) ** 0.8 * 140);
    }
  }
  return p;
}
