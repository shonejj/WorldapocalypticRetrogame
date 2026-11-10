import * as THREE from 'three';
import { SkinnedView, characterAssetReady } from './skinned';
import { LOOKS, RIM, type Look } from './characters';

/**
 * Speaker portraits (story presentation): each survivor's real in-game head, rendered once to a
 * small pixel-art tile — so the face in the conversation box is the person you are playing, at a
 * size where you can finally see them. Rendered off-screen with a three-point light rig, read back,
 * gamma-encoded and quantised to a short palette; cached as data URLs for the UI.
 */
const SIZE = 72;
const cache = new Map<string, string>();
const WREN: Look = { seed: 77, sex: 'f', skin: 0xd8a888, hair: 0x5a3a22, hairStyle: 'long', top: 0xc9a23a, topStyle: 'hoodie', shirt: 0xd8d0c0, pants: 0x4a5a6a, boots: 0x3a2a22, build: 0.8 };
const CAST: Record<string, Look> = { REED: LOOKS.reed, MAYA: LOOKS.maya, MILLER: LOOKS.miller, IRIS: LOOKS.iris, WREN };
const BG: Record<string, [string, string]> = { REED: ['#3a4a3a', '#141c18'], MAYA: ['#5a2c28', '#1c1012'], MILLER: ['#5a4c30', '#1c1810'], IRIS: ['#44386a', '#14121e'], WREN: ['#6a5a2a', '#1c180e'], RADIO: ['#12303a', '#081216'] };

export function portrait(name: string): string | null { return cache.get(name) ?? null; }

export function makePortraits(renderer: THREE.WebGLRenderer): void {
  if (cache.size) return;
  cache.set('RADIO', radio());
  if (!characterAssetReady()) return;
  const rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { depthBuffer: true });
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(10.5, 1, 0.1, 20);
  scene.add(new THREE.HemisphereLight(0xb8c8d8, 0x3a3028, 1.5));
  const key = new THREE.DirectionalLight(0xffe2c0, 3.2); key.position.set(-1.5, 1.4, 2.5); scene.add(key);
  const back = new THREE.DirectionalLight(0x8fc8e8, 2.6); back.position.set(2, 1.2, -2.2); scene.add(back);
  const rim0 = RIM.uRimColor.value.clone(), fill0 = RIM.uFill.value;
  RIM.uRimColor.value.setHex(0x9fc8e0); RIM.uFill.value = 0.12;
  const prevTarget = renderer.getRenderTarget(), prevClear = renderer.getClearAlpha();
  const px = new Uint8Array(SIZE * SIZE * 4);
  for (const [name, look] of Object.entries(CAST)) {
    const v = new SkinnedView(look, 1); v.setWeapon(null);
    v.root.rotation.y = 0.5; scene.add(v.root); v.root.updateMatrixWorld(true);
    const h = v.head();
    cam.position.set(h.x + 0.1, h.y + 0.12, h.z + 2.5); cam.lookAt(h.x + 0.02, h.y + 0.045, h.z);
    renderer.setRenderTarget(rt); renderer.setClearAlpha(0); renderer.clear(); renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, SIZE, SIZE, px);
    cache.set(name, encode(px, BG[name]));
    scene.remove(v.root); v.dispose();
  }
  renderer.setRenderTarget(prevTarget); renderer.setClearAlpha(prevClear);
  RIM.uRimColor.value.copy(rim0); RIM.uFill.value = fill0;
  rt.dispose();
}

/** Linear RGBA (bottom-up) → gamma-encoded, posterised canvas over a two-tone backdrop. */
function encode(px: Uint8Array, bg: [string, string]): string {
  const cv = document.createElement('canvas'); cv.width = cv.height = SIZE; const g = cv.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, SIZE); grd.addColorStop(0, bg[0]); grd.addColorStop(1, bg[1]); g.fillStyle = grd; g.fillRect(0, 0, SIZE, SIZE);
  const base = g.getImageData(0, 0, SIZE, SIZE), out = base.data, q = (v: number) => Math.round(v / 20) * 20;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const s = ((SIZE - 1 - y) * SIZE + x) * 4, d = (y * SIZE + x) * 4, a = px[s + 3] / 255;
    if (a < 0.5) continue;
    for (let c = 0; c < 3; c++) out[d + c] = q(Math.min(255, Math.pow(Math.min(1, (px[s + c] / 255) * 1.25), 1 / 2.2) * 255));
  }
  // one-pixel dark outline around the figure (pixel-art readability)
  const edge: number[] = [];
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && px[((SIZE - 1 - y) * SIZE + x) * 4 + 3] > 127;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (!op(x, y) && (op(x + 1, y) || op(x - 1, y) || op(x, y + 1) || op(x, y - 1))) edge.push((y * SIZE + x) * 4);
  for (const d of edge) { out[d] = 10; out[d + 1] = 12; out[d + 2] = 16; }
  g.putImageData(base, 0, 0);
  return cv.toDataURL();
}

function radio(): string {
  const cv = document.createElement('canvas'); cv.width = cv.height = SIZE; const g = cv.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, SIZE); grd.addColorStop(0, BG.RADIO[0]); grd.addColorStop(1, BG.RADIO[1]); g.fillStyle = grd; g.fillRect(0, 0, SIZE, SIZE);
  g.fillStyle = '#5ad1e6';
  for (let x = 6; x < SIZE - 6; x += 3) { const u = (x - 6) / (SIZE - 12), h = Math.round((Math.sin(u * 19) * Math.sin(u * 7 + 1) * 0.6 + Math.sin(u * 31) * 0.25) * Math.sin(u * Math.PI) * 22); g.fillRect(x, SIZE / 2 - Math.abs(h), 2, Math.abs(h) * 2 + 2); }
  g.fillStyle = 'rgba(90,209,230,.35)'; for (let y = 4; y < SIZE; y += 4) g.fillRect(0, y, SIZE, 1);
  return cv.toDataURL();
}
