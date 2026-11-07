import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/** World view: 1 unit = 1 metre. Orthographic camera looking down -Z. */
export const VIEW_HEIGHT = 6.9;
export const CAMERA_Y = 2.62;
export const CAMERA_Z = 60;

/** Final grade: teal shadows / warm highlights, vignette, film grain. */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.42 }, uGrain: { value: 0.045 }, uHurt: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uVignette; uniform float uGrain; uniform float uHurt; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      vec3 shadowTint = vec3(0.86, 0.98, 1.08), highTint = vec3(1.08, 1.0, 0.9);
      c.rgb *= mix(shadowTint, highTint, smoothstep(0.15, 0.75, l));
      c.rgb = mix(vec3(l), c.rgb, 1.08);                                   // a touch more saturation
      vec2 d = vUv - 0.5; float v = smoothstep(0.85, 0.2, length(d * vec2(1.25, 1.0)));
      c.rgb *= mix(1.0, v, uVignette);
      c.rgb = mix(c.rgb, c.rgb * vec3(1.6, 0.35, 0.3), uHurt * (1.0 - v));   // damage vignette
      c.rgb += (hash(vUv * 900.0 + uTime) - 0.5) * uGrain;
      gl_FragColor = c;
    }`,
};

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  /** Move the rig to follow; shake offsets go on `shake`. */
  readonly rig = new THREE.Group();
  readonly shake = new THREE.Group();
  renderScale = 1;
  aspect = 16 / 9;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  readonly grade: ShaderPass;
  quality: 'high' | 'low' = 'high';
  viewH = VIEW_HEIGHT;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x070d14);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    this.camera.position.z = CAMERA_Z;
    this.scene.add(this.rig); this.rig.add(this.shake); this.shake.add(this.camera);
    this.scene.fog = new THREE.Fog(0x22384a, 90, 640);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 256), 0.6, 0.55, 0.78);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  setRenderScale(s: number): void { this.renderScale = s; this.resize(); }
  setQuality(q: 'high' | 'low'): void { this.quality = q; this.bloom.enabled = q === 'high'; this.resize(); }

  resize(): void {
    const w = innerWidth, h = innerHeight;
    this.aspect = w / h;
    const dpr = Math.min(devicePixelRatio || 1, this.quality === 'high' ? 2 : 1.25) * this.renderScale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, true);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w * dpr * 0.5, h * dpr * 0.5);
    // extra-wide screens (phones in landscape) zoom in a little so characters stay readable
    this.viewH = VIEW_HEIGHT * Math.min(1, Math.max(0.82, 1.9 / this.aspect));
    const half = this.viewH / 2;
    this.camera.left = -half * this.aspect; this.camera.right = half * this.aspect;
    this.camera.top = half; this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
  }

  get viewWidth(): number { return this.viewH * this.aspect; }

  /** World → CSS pixel position (for name tags / prompts). */
  toScreen(x: number, y: number, z = 0): { x: number; y: number } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
  }

  render(time: number): void {
    this.grade.uniforms.uTime.value = time % 100;
    this.composer.render();
  }
}

/** Anchored plane geometry (origin at anchor). */
export function anchoredPlane(w: number, h: number, ax: number, ay: number): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(w, h); g.translate(w * (0.5 - ax), h * (0.5 - ay), 0); return g;
}
