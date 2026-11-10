import { Rng, fbm } from '../core/math';

/**
 * Storyboard panels (create-game-assets: authored in code, no image files). Each panel is a small
 * pixel-art painting — 384×216, drawn back-to-front as flat silhouette layers under fog, then
 * posterised with an ordered dither so gradients become hand-placed-looking colour bands. The UI
 * scales them up nearest-neighbour and drifts the camera across them (cutscene.ts).
 * One visual rule, same as the game: luminous fog, dark shapes stepping back into it, one warm light.
 */
export type PanelId = 'lab_night' | 'city_fall' | 'hosts' | 'radio_room' | 'four_walk' | 'relay' | 'safehouse' | 'road' | 'gate' | 'facility' | 'end_cost' | 'end_silence' | 'end_true';
export const PW = 384, PH = 216;
type G = CanvasRenderingContext2D;

// ---------------------------------------------------------------- brushes
const px = (g: G, x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function sky(g: G, stops: [number, string][]): void { const s = g.createLinearGradient(0, 0, 0, PH); for (const [t, c] of stops) s.addColorStop(t, c); g.fillStyle = s; g.fillRect(0, 0, PW, PH); }
function glow(g: G, x: number, y: number, r: number, c: string, a = 0.5): void {
  const s = g.createRadialGradient(x, y, 0, x, y, r); s.addColorStop(0, c); s.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = a; g.globalCompositeOperation = 'lighter'; g.fillStyle = s; g.fillRect(x - r, y - r, r * 2, r * 2); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
/** A veil of fog: denser toward `y1`, broken up by noise. */
function fog(g: G, y0: number, y1: number, c: [number, number, number], a: number, seed = 1): void {
  const img = g.getImageData(0, Math.floor(y0), PW, Math.ceil(y1 - y0)), d = img.data, h = img.height;
  for (let y = 0; y < h; y++) for (let x = 0; x < PW; x++) {
    const k = Math.min(1, (y / h) * (0.55 + fbm(x / 60, y / 18, 3, seed) * 0.9)) * a, i = (y * PW + x) * 4;
    d[i] += (c[0] - d[i]) * k; d[i + 1] += (c[1] - d[i + 1]) * k; d[i + 2] += (c[2] - d[i + 2]) * k;
  }
  g.putImageData(img, 0, Math.floor(y0));
}
function skyline(g: G, R: Rng, base: number, c: string, minH: number, maxH: number, win?: string, lit = 0.05): void {
  for (let x = -6; x < PW;) {
    const w = R.int(10, 26), h = R.int(minH, maxH); px(g, x, base - h, w, h + 40, c);
    if (R.chance(0.3)) px(g, x + R.int(2, w - 4), base - h - R.int(3, 9), 2, 10, c);
    if (win) for (let wy = base - h + 3; wy < base - 2; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (R.chance(lit)) px(g, wx, wy, 2, 2, win);
    x += w + R.int(0, 3);
  }
}
function ridge(g: G, base: number, amp: number, c: string, seed: number, scale = 70): void { g.fillStyle = c; for (let x = 0; x < PW; x++) { const h = fbm(x / scale, seed, 3, seed) * amp; g.fillRect(x, Math.round(base - h), 1, PH); } }
function ground(g: G, y: number, c: string): void { px(g, 0, y, PW, PH - y, c); }
function tree(g: G, R: Rng, x: number, base: number, h: number, c: string): void {
  g.strokeStyle = c; g.lineCap = 'butt';
  const limb = (x0: number, y0: number, ang: number, len: number, w: number, d: number) => {
    const x1 = x0 + Math.cos(ang) * len, y1 = y0 - Math.sin(ang) * len;
    g.lineWidth = Math.max(1, w); g.beginPath(); g.moveTo(Math.round(x0), Math.round(y0)); g.lineTo(Math.round(x1), Math.round(y1)); g.stroke();
    if (d <= 0) return;
    for (let k = 0, n = R.int(2, 3); k < n; k++) limb(x0 + (x1 - x0) * (k ? R.range(0.5, 0.95) : 1), y0 + (y1 - y0) * (k ? R.range(0.5, 0.95) : 1), ang + R.range(-0.9, 0.9), len * R.range(0.5, 0.75), w * 0.6, d - 1);
  };
  limb(x, base, Math.PI / 2 + R.range(-0.1, 0.1), h * 0.4, h / 22, 4);
}
function pole(g: G, x: number, base: number, h: number, c: string): void { px(g, x, base - h, 2, h, c); px(g, x - 7, base - h + 3, 16, 1, c); px(g, x - 5, base - h + 8, 12, 1, c); }
function wire(g: G, x0: number, y0: number, x1: number, y1: number, sag: number, c: string): void {
  g.fillStyle = c; for (let x = x0; x <= x1; x++) { const t = (x - x0) / (x1 - x0); g.fillRect(x, Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag), 1, 1); }
}
function mast(g: G, x: number, base: number, h: number, c: string, beacon = true): void {
  for (let y = 0; y < h; y++) { const w = 1 + Math.round((1 - y / h) * 5); px(g, x - w, base - y, 1, 1, c); px(g, x + w, base - y, 1, 1, c); if (y % 6 === 0) px(g, x - w, base - y, w * 2 + 1, 1, c); if (y % 6 === 3) for (let k = -w; k <= w; k++) px(g, x + k, base - y - Math.round((k + w) / 2) % 3, 1, 1, c); }
  px(g, x, base - h - 8, 1, 8, c);
  if (beacon) { px(g, x - 1, base - h - 10, 3, 3, '#ff5a3a'); glow(g, x, base - h - 9, 14, '#ff3a20', 0.8); }
}
function rings(g: G, x: number, y: number, n: number, c: string): void { g.strokeStyle = c; g.lineWidth = 1; for (let k = 1; k <= n; k++) { g.globalAlpha = 0.6 - k * (0.5 / n); g.beginPath(); g.arc(x, y, k * 13, -Math.PI * 0.92, -Math.PI * 0.08); g.stroke(); } g.globalAlpha = 1; }
interface Fig { pack?: boolean; gun?: boolean; long?: boolean; cap?: boolean; phones?: boolean; child?: boolean; hunch?: boolean; lean?: number; coat?: boolean; rim?: string }
/** A person as a silhouette, `h` pixels tall, feet at (x, base), facing `dir`. */
function figure(g: G, x: number, base: number, h: number, c: string, dir: 1 | -1 = 1, o: Fig = {}): void {
  const u = h / 16, hd = Math.max(2, Math.round(u * 2.6)), lean = (o.lean ?? 0) + (o.hunch ? 3 * u : 0);
  const R = (ax: number, ay: number, w: number, hh: number) => px(g, x + (dir > 0 ? ax : -ax - w), base - ay - hh, w, hh, c);
  R(-1.4 * u, 0, 1.4 * u, 6.4 * u); R(0.5 * u, 0, 1.4 * u, 6.4 * u);                       // legs
  R(-1.6 * u + lean * 0.3, 6 * u, 3.6 * u, (o.coat ? 6.5 : 5.6) * u);                       // torso
  if (o.coat) R(-1.9 * u, 4.2 * u, 4.2 * u, 2.4 * u);
  R(-0.9 * u + lean, 11.4 * u, hd, hd + 0.6 * u);                                           // head
  if (o.long) R(-1.3 * u + lean, 9.6 * u, 1.2 * u, 3.4 * u);
  if (o.cap) R(-0.9 * u + lean, 11.4 * u + hd, hd + 1.4 * u, 0.8 * u);
  if (o.phones) R(-1.2 * u + lean, 11.9 * u, 0.9 * u, 1.6 * u);
  if (o.pack) R(-3.3 * u + lean * 0.3, 7.2 * u, 2 * u, 4 * u);
  if (o.gun) { R(1.2 * u, 8.6 * u, 4.6 * u, 0.8 * u); R(1.4 * u, 7.4 * u, 0.9 * u, 1.4 * u); }
  else if (o.hunch) { R(1.6 * u + lean * 0.4, 5.6 * u, 0.9 * u, 4.6 * u); }                  // slack arm
  else R(1.4 * u, 6.6 * u, 0.9 * u, 4.4 * u);
  if (o.rim) { g.fillStyle = o.rim; const rx = x + (dir > 0 ? -1.7 * u : 1.7 * u - 1); g.fillRect(Math.round(rx), Math.round(base - 11.4 * u), 1, Math.round(5 * u)); g.fillRect(Math.round(x + (dir > 0 ? -1 : 1) * 0.9 * u + lean * dir), Math.round(base - 11.4 * u - hd - 0.6 * u), hd, 1); }
}
function squad(g: G, x: number, base: number, h: number, c: string, dir: 1 | -1 = 1, rim?: string): void {
  figure(g, x, base, h, c, dir, { pack: true, gun: true, rim });                              // Reed
  figure(g, x - dir * h * 0.7, base, h * 0.94, c, dir, { pack: true, rim });                  // Maya
  figure(g, x - dir * h * 1.45, base, h * 1.04, c, dir, { pack: true, cap: true, coat: true, gun: true, rim });   // Miller
  figure(g, x - dir * h * 2.15, base, h * 0.9, c, dir, { pack: true, long: true, phones: true, rim });             // Iris
}
function rain(g: G, R: Rng, n: number, c: string): void { g.fillStyle = c; for (let i = 0; i < n; i++) { const x = R.int(0, PW), y = R.int(0, PH), l = R.int(3, 7); for (let k = 0; k < l; k++) g.fillRect(x - Math.round(k * 0.3), y + k, 1, 1); } }
function candle(g: G, x: number, y: number, h: number): void { px(g, x, y - h, 2, h, '#e8dcc0'); px(g, x, y - h - 2, 2, 2, '#ffd27a'); px(g, x, y - h - 3, 1, 1, '#fff2c0'); glow(g, x + 1, y - h - 2, 16, '#ff9a3a', 0.55); }
function building(g: G, x: number, base: number, w: number, h: number, c: string, win: string, R: Rng, lit = 0.1): void {
  px(g, x, base - h, w, h, c);
  for (let wy = base - h + 6; wy < base - 6; wy += 9) for (let wx = x + 4; wx < x + w - 5; wx += 8) px(g, wx, wy, 4, 5, R.chance(lit) ? win : 'rgba(0,0,0,.35)');
}
/** Ordered-dither posterise: the pixel-art finish. */
function finish(g: G, levels = 14): void {
  const img = g.getImageData(0, 0, PW, PH), d = img.data, B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const t = (B[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * (255 / levels), i = (y * PW + x) * 4;
    for (let c = 0; c < 3; c++) d[i + c] = Math.max(0, Math.min(255, Math.round((d[i + c] + t) / (255 / levels)) * (255 / levels)));
  }
  g.putImageData(img, 0, 0);
  const v = g.createRadialGradient(PW / 2, PH / 2, PH * 0.45, PW / 2, PH / 2, PW * 0.72); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = v; g.fillRect(0, 0, PW, PH);
}

// ---------------------------------------------------------------- the panels
const PAINT: Record<PanelId, (g: G, R: Rng) => void> = {
  lab_night(g, R) {
    sky(g, [[0, '#0a1420'], [0.6, '#1c3444'], [1, '#34586a']]);
    for (let i = 0; i < 60; i++) px(g, R.int(0, PW), R.int(0, 90), 1, 1, R.chance(0.3) ? '#cfe6f0' : '#5a7a8a');
    skyline(g, R, 150, '#16283a', 20, 60); fog(g, 90, 160, [70, 110, 130], 0.7, 2);
    building(g, 96, 176, 150, 86, '#0e1a24', '#5ad1e6', R, 0.06); building(g, 60, 176, 44, 54, '#0c1820', '#5ad1e6', R, 0.05); building(g, 240, 176, 70, 62, '#0c1820', '#5ad1e6', R, 0.05);
    px(g, 150, 118, 14, 9, '#ffd27a'); glow(g, 157, 122, 40, '#ffb050', 0.8); px(g, 120, 96, 60, 8, '#16303c'); px(g, 124, 98, 2, 4, '#5ad1e6'); px(g, 130, 98, 30, 4, '#3a8a9a');
    mast(g, 214, 90, 40, '#0e1a24');
    ground(g, 176, '#0a1218'); px(g, 0, 176, PW, 1, '#2a4a5a'); for (let x = 10; x < PW; x += 26) { px(g, x, 160, 1, 16, '#0a1218'); px(g, x - 12, 164, 26, 1, '#0a1218'); }
    pole(g, 40, 176, 70, '#070d12'); pole(g, 330, 176, 74, '#070d12'); wire(g, 41, 108, 331, 104, 14, '#070d12');
    fog(g, 150, 216, [40, 70, 86], 0.6, 5);
  },
  city_fall(g, R) {
    sky(g, [[0, '#1a0f14'], [0.45, '#5a2a22'], [0.8, '#c8683a'], [1, '#e8a45a']]);
    skyline(g, R, 150, '#5a2e28', 30, 80); fog(g, 60, 150, [200, 110, 70], 0.55, 3);
    skyline(g, R, 168, '#2c1618', 30, 96, '#ffb45a', 0.03);
    for (const [x, y] of [[70, 80], [190, 60], [300, 90]]) { for (let k = 0; k < 26; k++) { const r = 5 + k * 0.9; g.fillStyle = `rgba(20,14,16,${0.5 - k * 0.016})`; g.beginPath(); g.arc(x + k * 2.2 + R.range(-3, 3), y - k * 3.2, r, 0, 7); g.fill(); } glow(g, x, y + 16, 34, '#ff7a2a', 0.9); px(g, x - 4, y + 12, 9, 6, '#ffc060'); }
    skyline(g, R, 190, '#120a0c', 20, 60);
    ground(g, 190, '#0c0708'); for (let x = 0; x < PW; x += 30) px(g, x + 8, 200, 12, 1, '#3a1e18');
    for (let i = 0; i < 9; i++) figure(g, 40 + i * 36 + R.int(-6, 6), 192 + R.int(0, 6), 9 + R.int(0, 2), '#0a0607', R.chance(0.5) ? 1 : -1, { hunch: R.chance(0.4) });
    fog(g, 170, 216, [90, 40, 30], 0.5, 7);
  },
  hosts(g, R) {
    sky(g, [[0, '#101c26'], [0.5, '#2a4452'], [1, '#4a6a78']]);
    skyline(g, R, 140, '#243a48', 20, 70); fog(g, 60, 150, [90, 126, 140], 0.75, 4);
    skyline(g, R, 160, '#14222c', 30, 90, '#ffcf86', 0.012);
    ground(g, 172, '#0c151b'); px(g, 0, 172, PW, 1, '#3a5a6a');
    px(g, 250, 60, 2, 112, '#0a1116'); px(g, 250, 60, 26, 2, '#0a1116'); px(g, 270, 62, 8, 2, '#ffe2b0');
    g.fillStyle = 'rgba(255,200,130,.16)'; g.beginPath(); g.moveTo(274, 64); g.lineTo(226, 172); g.lineTo(322, 172); g.closePath(); g.fill(); glow(g, 274, 64, 26, '#ffc27a', 0.9);
    for (let i = 0; i < 14; i++) { const x = 30 + i * 25 + R.int(-8, 8), far = R.chance(0.4); figure(g, x, far ? 170 : 176 + R.int(0, 8), far ? 16 : 22 + R.int(0, 5), far ? '#1c2c36' : '#070c10', R.chance(0.5) ? 1 : -1, { hunch: true, lean: R.range(-2, 2), rim: far ? undefined : '#6a8a9a' }); }
    rain(g, R, 260, 'rgba(160,190,205,.28)'); fog(g, 160, 216, [40, 62, 74], 0.55, 9);
  },
  radio_room(g, R) {
    sky(g, [[0, '#120c0a'], [1, '#1c120c']]);
    px(g, 0, 0, PW, 150, '#2a1c14'); for (let x = 0; x < PW; x += 24) px(g, x, 0, 1, 150, '#21160f');
    px(g, 220, 24, 110, 80, '#6f96a6'); g.save(); g.beginPath(); g.rect(220, 24, 110, 80); g.clip(); skyline(g, R, 104, '#3f6272', 10, 40); g.restore(); px(g, 220, 104, 110, 4, '#3a281c'); px(g, 216, 20, 118, 4, '#3a281c'); px(g, 216, 20, 4, 88, '#3a281c'); px(g, 330, 20, 4, 88, '#3a281c'); px(g, 274, 24, 2, 80, '#3a281c');
    px(g, 0, 0, 220, 20, '#2a1c14'); px(g, 334, 0, 60, 150, '#2a1c14');
    for (let y = 30; y < 100; y += 22) { px(g, 20, y + 16, 90, 3, '#1a110b'); for (let x = 22; x < 108;) { const w = R.int(3, 6), h = R.int(10, 15); px(g, x, y + 16 - h, w, h, R.pick(['#5a2e22', '#2a4250', '#6a5a2e', '#3a4a34', '#7a7060'])); x += w + 1; } }
    px(g, 0, 150, PW, 66, '#1a110b'); px(g, 96, 128, 170, 6, '#4a3222'); px(g, 104, 134, 4, 40, '#3a2618'); px(g, 254, 134, 4, 40, '#3a2618');
    px(g, 150, 100, 56, 28, '#1c2a2e'); px(g, 154, 104, 30, 10, '#0c1c20'); for (let x = 156; x < 182; x += 3) px(g, x, 109 - Math.round(Math.abs(Math.sin(x * 0.7)) * 4), 2, Math.round(Math.abs(Math.sin(x * 0.7)) * 4) * 2 + 1, '#5ad1e6'); px(g, 190, 106, 4, 4, '#ffb45a'); px(g, 190, 116, 4, 4, '#3a4a4e'); px(g, 204, 72, 1, 30, '#1c2a2e');
    glow(g, 170, 108, 46, '#3ac0e0', 0.6);
    candle(g, 118, 128, 9); candle(g, 232, 128, 6); candle(g, 240, 128, 11);
    figure(g, 196, 174, 64, '#0c0806', -1, { long: true, phones: true, rim: '#5ad1e6' });
    px(g, 170, 150, 50, 30, '#0c0806');
    fog(g, 150, 216, [20, 12, 8], 0.6, 2);
  },
  four_walk(g, R) {
    sky(g, [[0, '#7fa2b0'], [0.55, '#b4ccd2'], [1, '#d0dee0']]);
    ridge(g, 150, 26, '#a4bec6', 3); for (let i = 0; i < 14; i++) tree(g, R, R.int(0, PW), 152, R.int(30, 50), '#93b0b9');
    fog(g, 70, 158, [196, 214, 218], 0.6, 6);
    mast(g, 300, 150, 92, '#6f8e9a'); rings(g, 300, 48, 4, '#e8f4f6');
    for (let i = 0; i < 9; i++) tree(g, R, R.int(0, PW), 166, R.int(46, 76), '#5f7c88');
    for (const x of [30, 150, 270]) pole(g, x, 168, 70, '#4a6470'); wire(g, 31, 100, 151, 100, 10, '#4a6470'); wire(g, 151, 100, 271, 100, 10, '#4a6470'); wire(g, 271, 100, 384, 96, 9, '#4a6470');
    fog(g, 110, 176, [188, 208, 212], 0.55, 8);
    ground(g, 172, '#2c3a40'); px(g, 0, 172, PW, 2, '#5a7480'); for (let x = 6; x < PW; x += 34) px(g, x, 190, 16, 2, '#6a848e');
    squad(g, 190, 180, 30, '#141c20', 1, '#9ab6c0');
    for (let i = 0; i < 26; i++) { const x = R.int(0, PW); px(g, x, 206 - R.int(0, 12), 1, R.int(6, 16), '#10181c'); }
    fog(g, 176, 216, [120, 146, 154], 0.4, 4);
  },
  relay(g, R) {
    sky(g, [[0, '#0c1822'], [0.6, '#22404e'], [1, '#3e6272']]);
    skyline(g, R, 150, '#1c3440', 20, 70, '#ffcf86', 0.01); fog(g, 70, 156, [70, 108, 124], 0.7, 3);
    mast(g, 200, 150, 120, '#0a141a'); rings(g, 200, 22, 5, '#5ad1e6'); glow(g, 200, 22, 50, '#3ac0e0', 0.5);
    px(g, 164, 136, 74, 36, '#101c22'); px(g, 160, 132, 82, 5, '#0a1318'); px(g, 196, 150, 16, 10, '#5ad1e6'); glow(g, 204, 155, 26, '#3ac0e0', 0.8); px(g, 172, 148, 12, 24, '#1a2c34');
    ground(g, 172, '#091116'); px(g, 0, 172, PW, 1, '#2a4a58');
    squad(g, 150, 178, 24, '#05090c', 1, '#5a9ab0');
    rain(g, R, 240, 'rgba(150,190,210,.26)'); fog(g, 160, 216, [30, 54, 66], 0.55, 6);
  },
  safehouse(g, R) {
    sky(g, [[0, '#1a120c'], [1, '#22160e']]);
    px(g, 0, 0, PW, 160, '#3a2a1e'); for (let i = 0; i < 40; i++) px(g, R.int(0, PW), R.int(0, 160), R.int(4, 20), 1, '#33241a');
    px(g, 122, 26, 140, 100, '#c8dadc'); g.save(); g.beginPath(); g.rect(122, 26, 140, 100); g.clip(); ridge(g, 118, 16, '#9db8be', 4, 40); px(g, 122, 118, 140, 8, '#7f9ea6'); for (let i = 0; i < 5; i++) tree(g, R, 132 + i * 28, 122, R.int(22, 38), '#7896a0'); g.restore();
    px(g, 118, 22, 148, 5, '#2a1c12'); px(g, 118, 126, 148, 6, '#2a1c12'); px(g, 118, 22, 5, 108, '#2a1c12'); px(g, 261, 22, 5, 108, '#2a1c12'); px(g, 190, 26, 3, 100, '#2a1c12');
    g.fillStyle = 'rgba(236,230,214,.8)'; g.beginPath(); g.moveTo(126, 26); g.lineTo(160, 26); g.lineTo(150, 124); g.lineTo(124, 118); g.fill(); g.beginPath(); g.moveTo(258, 26); g.lineTo(226, 26); g.lineTo(240, 120); g.lineTo(260, 124); g.fill();
    for (let i = 0; i < 26; i++) px(g, R.int(110, 270), R.int(14, 60), R.int(2, 5), R.int(2, 6), R.pick(['#3f5a34', '#2f4a28', '#55702c']));
    glow(g, 192, 76, 120, '#cfe4e8', 0.3);
    for (let y = 40; y < 130; y += 24) { px(g, 14, y + 18, 80, 3, '#1c120c'); for (let x = 16; x < 92;) { const w = R.int(3, 6), h = R.int(10, 16); px(g, x, y + 18 - h, w, h, R.pick(['#5a2e22', '#2a4250', '#6a5a2e', '#3a4a34', '#7a7060'])); x += w + 1; } }
    px(g, 0, 160, PW, 56, '#20150e'); px(g, 60, 168, 230, 30, '#5a2e22'); px(g, 70, 172, 210, 22, '#3a1e18');
    px(g, 280, 138, 96, 26, '#2a1c12'); px(g, 284, 126, 88, 14, '#d8cfbc'); px(g, 300, 122, 70, 12, '#8a5a3a'); px(g, 318, 120, 20, 8, '#6a7a5a'); px(g, 340, 121, 22, 8, '#b08a5a'); px(g, 352, 114, 18, 10, '#e8e0cc'); px(g, 356, 108, 10, 8, '#1c120c');
    for (const [x, y, h] of [[30, 160, 10], [40, 160, 6], [48, 160, 13], [300, 196, 9], [310, 198, 14], [322, 197, 7], [104, 160, 8]]) candle(g, x, y, h);
    px(g, 20, 20, 8, 12, '#1c120c'); px(g, 21, 22, 6, 8, '#ffc27a'); glow(g, 24, 26, 30, '#ff9a3a', 0.8); px(g, 366, 30, 8, 12, '#1c120c'); px(g, 367, 32, 6, 8, '#ffc27a'); glow(g, 370, 36, 30, '#ff9a3a', 0.8);
    figure(g, 170, 178, 30, '#0e0a08', 1, { pack: false, rim: '#ffc27a' }); figure(g, 214, 180, 28, '#0e0a08', -1, { long: true, rim: '#ffc27a' });
  },
  road(g, R) {
    sky(g, [[0, '#86a8b6'], [0.5, '#b6cfd5'], [1, '#cfdee0']]);
    glow(g, 210, 66, 90, '#f4fbfb', 0.5);
    for (let i = 0; i < 18; i++) tree(g, R, R.int(0, PW), 150, R.int(30, 56), '#a2bcc4'); fog(g, 60, 156, [200, 216, 220], 0.6, 2);
    px(g, 130, 120, 36, 28, '#8aa6b0'); px(g, 126, 116, 44, 5, '#8aa6b0');
    for (let i = 0; i < 12; i++) tree(g, R, R.int(0, PW), 164, R.int(50, 84), '#6c8a96');
    pole(g, 96, 168, 84, '#4e6874'); wire(g, 0, 70, 97, 86, 6, '#4e6874'); wire(g, 97, 86, 250, 150, 8, '#4e6874');
    px(g, 216, 96, 78, 46, '#3c5460'); px(g, 220, 100, 70, 38, '#e8b45a'); px(g, 224, 104, 62, 8, '#f4d68a'); px(g, 228, 118, 40, 4, '#c8683a'); px(g, 228, 126, 52, 4, '#d88a4a'); glow(g, 255, 118, 60, '#ffb850', 0.55);
    for (const x of [224, 250, 282]) px(g, x, 142, 2, 26, '#3c5460'); for (const x of [230, 252, 270]) { px(g, x, 92, 3, 3, '#2c404a'); px(g, x - 1, 90, 5, 1, '#2c404a'); }
    fog(g, 110, 172, [186, 206, 210], 0.5, 5);
    px(g, 0, 160, 50, 2, '#3c5460'); px(g, 0, 164, 50, 2, '#3c5460'); px(g, 334, 160, 50, 2, '#3c5460'); px(g, 334, 164, 50, 2, '#3c5460'); for (const x of [8, 40, 342, 374]) px(g, x, 158, 2, 12, '#3c5460');
    ground(g, 170, '#1c262b'); px(g, 0, 170, PW, 1, '#4a626c'); px(g, 0, 178, PW, 1, '#8a7a3a');
    figure(g, 70, 178, 26, '#0e1518', 1, { pack: true, long: true, rim: '#a0bcc6' }); figure(g, 204, 178, 26, '#2a1416', -1, { coat: true, hunch: true, lean: 2 }); px(g, 180, 166, 18, 12, '#10181c'); px(g, 182, 160, 14, 6, '#c8683a');
    for (let i = 0; i < 40; i++) { const x = R.int(0, PW), h = R.int(4, 12); px(g, x, 176 - h, 1, h, '#2c3c42'); }
    for (let i = 0; i < 70; i++) px(g, R.int(0, PW), R.int(184, 214), R.int(1, 4), 1, R.chance(0.2) ? '#7ab0e8' : '#3a4a52');
    fog(g, 178, 216, [130, 156, 164], 0.35, 4);
  },
  gate(g, R) {
    sky(g, [[0, '#7c9eac'], [0.6, '#aec8ce'], [1, '#c8d8dc']]);
    for (let i = 0; i < 14; i++) tree(g, R, R.int(0, PW), 150, R.int(30, 60), '#98b4bc'); fog(g, 60, 156, [196, 212, 216], 0.6, 3);
    for (const x of [90, 290]) { px(g, x, 60, 6, 112, '#2c3e46'); px(g, x - 8, 56, 22, 6, '#2c3e46'); px(g, x - 4, 62, 14, 3, '#fff2c8'); glow(g, x + 3, 64, 40, '#fff0c0', 0.8); }
    px(g, 96, 96, 194, 6, '#2c3e46'); for (let x = 100; x < 290; x += 8) px(g, x, 102, 2, 70, '#3c525c'); for (let y = 112; y < 170; y += 14) px(g, 96, y, 194, 2, '#3c525c');
    px(g, 150, 76, 90, 20, '#c8b23a'); px(g, 154, 80, 82, 12, '#1c262b'); for (let x = 158; x < 232; x += 6) px(g, x, 84, 4, 4, '#c8b23a');
    px(g, 300, 124, 60, 48, '#34484f'); px(g, 296, 120, 68, 5, '#2c3e46'); px(g, 312, 134, 22, 14, '#ff5a3a'); glow(g, 323, 140, 26, '#ff3a20', 0.6);
    ground(g, 172, '#1a2428'); px(g, 0, 172, PW, 1, '#48606a');
    figure(g, 200, 176, 44, '#0c1215', -1, { coat: true, hunch: true, lean: 3, rim: '#a0bcc6' });
    squad(g, 90, 180, 24, '#0c1215', 1, '#a0bcc6');
    for (const x of [30, 62, 334]) { px(g, x, 166, 22, 3, '#c8b23a'); px(g, x + 2, 169, 2, 5, '#2c3e46'); px(g, x + 18, 169, 2, 5, '#2c3e46'); }
    fog(g, 170, 216, [130, 156, 164], 0.4, 6);
  },
  facility(g, R) {
    sky(g, [[0, '#1e2540'], [0.45, '#7c5058'], [0.78, '#de9460'], [1, '#f0c080']]);
    glow(g, 120, 150, 110, '#ffcf8a', 0.6);
    ridge(g, 150, 22, '#8a5e60', 5); for (let i = 0; i < 12; i++) tree(g, R, R.int(0, PW), 152, R.int(28, 50), '#7a525a');
    fog(g, 80, 160, [214, 150, 110], 0.4, 2);
    building(g, 150, 170, 120, 84, '#2c2434', '#ffc27a', R, 0.08); building(g, 110, 170, 46, 50, '#261e2e', '#8fe0f0', R, 0.08); building(g, 266, 170, 70, 62, '#261e2e', '#ffc27a', R, 0.05);
    px(g, 170, 74, 80, 8, '#1c1624'); px(g, 174, 76, 70, 4, '#5ad1e6');
    mast(g, 236, 86, 70, '#1c1624'); rings(g, 236, 8, 4, '#f6e2c4');
    ground(g, 170, '#140f16'); px(g, 0, 170, PW, 1, '#6a4a50');
    for (let x = 0; x < PW; x += 14) px(g, x, 150, 1, 20, '#1c1620'); px(g, 0, 152, 140, 1, '#1c1620'); px(g, 0, 160, 140, 1, '#1c1620'); px(g, 300, 152, 90, 1, '#1c1620'); px(g, 300, 160, 90, 1, '#1c1620');
    squad(g, 90, 178, 26, '#0a070c', 1, '#ffb080');
    for (let i = 0; i < 6; i++) tree(g, R, R.pick([10, 30, 330, 356, 376, 60]), 176, R.int(60, 100), '#0e0a10');
    fog(g, 168, 216, [70, 48, 56], 0.45, 4);
  },
  end_cost(g, R) {
    sky(g, [[0, '#0c1418'], [1, '#14201f']]);
    px(g, 0, 0, PW, 156, '#22343a'); for (let x = 0; x < PW; x += 48) px(g, x, 0, 2, 156, '#1c2c32');
    for (const x of [60, 300]) { px(g, x - 16, 60, 32, 100, '#16262a'); px(g, x - 11, 68, 22, 78, '#3fe0a0'); px(g, x - 11, 68, 22, 78, 'rgba(10,30,30,.45)'); glow(g, x, 108, 46, '#3fe0a0', 0.5); px(g, x - 18, 54, 36, 8, '#101c20'); px(g, x - 18, 146, 36, 10, '#101c20'); }
    px(g, 150, 10, 84, 4, '#d4f2ff'); glow(g, 192, 14, 110, '#bfe8ff', 0.45);
    px(g, 0, 156, PW, 60, '#101a1c'); px(g, 126, 140, 132, 8, '#c8d4d6'); px(g, 132, 148, 4, 26, '#6a7a7e'); px(g, 250, 148, 4, 26, '#6a7a7e');
    px(g, 140, 132, 96, 9, '#2a3a3a'); px(g, 232, 130, 14, 10, '#1a2224'); px(g, 150, 128, 70, 6, '#3a4a44');
    px(g, 270, 96, 2, 60, '#8a9a9e'); px(g, 264, 96, 14, 16, '#7a2a24'); wire(g, 240, 136, 270, 112, 10, '#7a2a24');
    figure(g, 104, 176, 50, '#060a0b', 1, { rim: '#bfe8ff' }); figure(g, 296, 178, 44, '#060a0b', -1, { long: true, phones: true, rim: '#3fe0a0' }); figure(g, 330, 178, 52, '#060a0b', -1, { cap: true, coat: true, rim: '#3fe0a0' });
    void R;
  },
  end_silence(g, R) {
    sky(g, [[0, '#2a3440'], [0.6, '#5a6a72'], [1, '#8a989c']]);
    ridge(g, 150, 24, '#4e5e66', 6); skyline(g, R, 156, '#3c4a52', 16, 50); fog(g, 70, 160, [150, 164, 170], 0.6, 2);
    mast(g, 250, 156, 110, '#1c262c', false);
    for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(24,28,32,${0.55 - k * 0.016})`; g.beginPath(); g.arc(250 + k * 3, 40 - k * 1.6 + R.range(-3, 3), 6 + k, 0, 7); g.fill(); }
    px(g, 214, 140, 74, 32, '#1c262c'); px(g, 244, 152, 16, 20, '#10181c');
    ground(g, 172, '#141c20'); px(g, 0, 172, PW, 1, '#5a6a72');
    squad(g, 130, 180, 26, '#080c0e', -1, '#aab8bc'); figure(g, 54, 180, 16, '#080c0e', -1, { long: true, child: true, rim: '#aab8bc' });
    for (let i = 0; i < 8; i++) tree(g, R, R.int(0, PW), 178, R.int(50, 90), '#0c1215');
    fog(g, 172, 216, [90, 104, 110], 0.4, 3);
  },
  end_true(g, R) {
    sky(g, [[0, '#3a5a7a'], [0.4, '#e8a070'], [0.7, '#ffd890'], [1, '#fff0c0']]);
    glow(g, 192, 150, 150, '#fff4c8', 0.9); px(g, 176, 134, 32, 16, '#fff8dc');
    skyline(g, R, 150, '#c88a6a', 20, 60); fog(g, 80, 156, [255, 214, 160], 0.5, 2);
    skyline(g, R, 166, '#6a4a48', 20, 70, '#ffe8b0', 0.04);
    mast(g, 300, 160, 120, '#3a2a30'); rings(g, 300, 30, 6, '#fff4dc');
    for (let i = 0; i < 30; i++) px(g, R.int(0, PW), R.int(150, 168), R.int(2, 6), R.int(1, 3), R.pick(['#5a7a3a', '#6a8a44']));
    px(g, 0, 172, PW, 44, '#2a1e22'); px(g, 0, 172, PW, 2, '#8a5a50'); px(g, 20, 160, 2, 12, '#2a1e22'); px(g, 362, 160, 2, 12, '#2a1e22'); px(g, 20, 160, 344, 1, '#2a1e22');
    squad(g, 200, 174, 30, '#140c10', 1, '#ffd890'); figure(g, 226, 174, 18, '#140c10', 1, { long: true, rim: '#ffd890' });
    for (let i = 0; i < 9; i++) { const x = R.int(0, PW), y = R.int(20, 90); px(g, x, y, 3, 1, '#3a2a30'); px(g, x + 1, y - 1, 1, 1, '#3a2a30'); }
  },
};

const cache = new Map<PanelId, HTMLCanvasElement>();
export function panel(id: PanelId): HTMLCanvasElement {
  let cv = cache.get(id);
  if (!cv) {
    cv = document.createElement('canvas'); cv.width = PW; cv.height = PH;
    const g = cv.getContext('2d', { willReadFrequently: true })!; g.imageSmoothingEnabled = false;
    PAINT[id](g, new Rng(id.length * 977 + id.charCodeAt(0) * 31 + id.charCodeAt(2)));
    finish(g); cache.set(id, cv);
  }
  return cv;
}
