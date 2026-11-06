import * as THREE from 'three';
import type { Painter } from './painter';

/** World view: 1 unit = 1 metre. Orthographic camera looking down -Z. */
export const VIEW_HEIGHT = 6.6;
export const CAMERA_Z = 60;

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  /** Move the rig to follow; shake offsets go on `shake`. */
  readonly rig = new THREE.Group();
  readonly shake = new THREE.Group();
  renderScale = 1;
  aspect = 16 / 9;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x05090d);
    this.renderer.sortObjects = true;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    this.camera.position.z = CAMERA_Z;
    this.scene.add(this.rig); this.rig.add(this.shake); this.shake.add(this.camera);
    this.scene.fog = new THREE.Fog(0x1b2f3d, 70, 560);
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  setRenderScale(s: number): void { this.renderScale = s; this.resize(); }

  resize(): void {
    const w = innerWidth, h = innerHeight;
    this.aspect = w / h;
    const dpr = Math.min(devicePixelRatio || 1, 2) * this.renderScale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, true);
    const half = VIEW_HEIGHT / 2;
    this.camera.left = -half * this.aspect; this.camera.right = half * this.aspect;
    this.camera.top = half; this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
  }

  get viewWidth(): number { return VIEW_HEIGHT * this.aspect; }
  get cameraX(): number { return this.rig.position.x + this.shake.position.x; }

  render(): void { this.renderer.render(this.scene, this.camera); }
}

export interface SpriteOpts {
  ppu: number;
  /** anchor in 0..1 of the sprite: (0.5, 0) = bottom centre (default) */
  anchorX?: number; anchorY?: number;
  transparent?: boolean;
  additive?: boolean;
  opacity?: number;
  fog?: boolean;
  tint?: number;
  depthWrite?: boolean;
  alphaTest?: number;
}

const geoCache = new Map<string, THREE.PlaneGeometry>();
/** Plane geometry with its origin at the given anchor (cached by size+anchor). */
export function anchoredPlane(w: number, h: number, ax: number, ay: number): THREE.PlaneGeometry {
  const key = `${w.toFixed(4)}:${h.toFixed(4)}:${ax}:${ay}`;
  let g = geoCache.get(key);
  if (!g) { g = new THREE.PlaneGeometry(w, h); g.translate(w * (0.5 - ax), h * (0.5 - ay), 0); geoCache.set(key, g); }
  return g;
}

/** Make a textured quad from a Painter (pixel size / ppu = metres). */
export function spriteFrom(p: Painter | THREE.Texture, opts: SpriteOpts, size?: { w: number; h: number }): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const tex = (p as THREE.Texture).isTexture ? (p as THREE.Texture) : (p as Painter).texture();
  const w = size?.w ?? (p as Painter).w / opts.ppu, h = size?.h ?? (p as Painter).h / opts.ppu;
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, alphaTest: opts.alphaTest ?? (opts.additive ? 0 : 0.5),
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: opts.depthWrite ?? !opts.additive, opacity: opts.opacity ?? 1, fog: opts.fog ?? !opts.additive,
    color: opts.tint ?? 0xffffff,
  });
  return new THREE.Mesh(anchoredPlane(w, h, opts.anchorX ?? 0.5, opts.anchorY ?? 0), mat);
}
