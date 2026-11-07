import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/** pixel: 0 = HD (no pixel filter), -1 = auto (≈360 art rows, the pixel-art default), n = fixed block size. */
export interface Quality { dpr: number; pixel: number; bloom: boolean; shadows: boolean; reflections: boolean }
export const QUALITY_PRESETS: Record<'high' | 'medium' | 'low', Quality> = {
  high: { dpr: 1.5, pixel: -1, bloom: true, shadows: true, reflections: true },
  medium: { dpr: 1.0, pixel: -1, bloom: true, shadows: true, reflections: true },
  low: { dpr: 1.0, pixel: -1, bloom: false, shadows: false, reflections: false },
};

/** Colour grade + vignette + grain + damage tint, applied before OutputPass (linear space). */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uHurt: { value: 0 }, uVignette: { value: 0.5 }, uGrain: { value: 0.035 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uHurt; uniform float uVignette; uniform float uGrain; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126,0.7152,0.0722));
      c.rgb *= mix(vec3(0.86,1.0,1.12), vec3(1.1,1.0,0.86), smoothstep(0.02, 0.6, l));   // teal shadows / amber highlights
      vec2 d = vUv - 0.5; float vig = smoothstep(0.85, 0.25, length(d * vec2(1.3, 1.0)));
      c.rgb *= mix(1.0, vig, uVignette);
      c.rgb = mix(c.rgb, c.rgb * vec3(1.8,0.35,0.3), uHurt * (1.0 - vig * 0.6));
      c.rgb += (hash(vUv * 1000.0 + uTime) - 0.5) * uGrain * (0.4 + l);
      gl_FragColor = c;
    }`,
};

/**
 * Renderer + post chain (threejs-scene-setup / threejs-materials-lighting):
 * ACES tone mapping, soft shadows, a PMREM environment baked from a street-like scene for
 * wet reflections, fog, and EffectComposer → [pixel pass | render] → bloom → grade → OutputPass.
 */
export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.5, 900);
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  readonly grade = new ShaderPass(GradeShader);
  quality: Quality = QUALITY_PRESETS.high;
  /** Camera target and additive shake offset (camera-systems: shake rides on top of follow). */
  focus = new THREE.Vector3(0, 1.9, 0);
  shakeOffset = new THREE.Vector3();
  /** Close, low camera (art direction: characters ≈ ¼ of screen height, slight upward look). */
  distance = 12.5;
  private px: RenderPixelatedPass | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.5;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.fog = new THREE.FogExp2(0x2c3f4f, 0.019);       // atmospheric depth: far layers dissolve into blue haze
    this.scene.background = new THREE.Color(0x1c2a35);
    this.bakeEnvironment();
    this.buildComposer();
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  /** IBL without an HDR file: render a dark street-like room with warm lamp panels into PMREM. */
  private bakeEnvironment(): void {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 16, 12), new THREE.MeshBasicMaterial({ color: 0x0e1820, side: THREE.BackSide })));
    const panel = (c: number, x: number, y: number, z: number, s: number) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s * 0.5), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
    panel(0xffb066, -8, 6, -10, 5); panel(0xffd8a0, 9, 7, -6, 3); panel(0xff9a4a, 2, 3, -14, 6); panel(0x6fa0c0, 0, 15, 0, 12); panel(0x2a4458, -12, 2, 8, 8);
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(env, 0.04).texture;
    this.scene.environmentIntensity = 0.85;
    pm.dispose();
  }

  private buildComposer(): void {
    this.composer?.dispose();
    this.composer = new EffectComposer(this.renderer);
    this.px = null;
    if (this.quality.pixel) {
      const px = (this.px = new RenderPixelatedPass(this.pixelSize(), this.scene, this.camera));
      px.normalEdgeStrength = 0.18; px.depthEdgeStrength = 0.45;          // dark outlines on silhouettes, soft inner edges
      this.composer.addPass(px);
    } else this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 256), 0.55, 0.6, 0.82);
    this.bloom.enabled = this.quality.bloom;
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  /** Block size: fixed, or auto so the art resolution stays ≈360 rows on any screen. */
  private pixelSize(): number {
    if (this.quality.pixel > 0) return this.quality.pixel;
    const rows = innerHeight * Math.min(devicePixelRatio || 1, this.quality.dpr);
    return Math.max(2, Math.round(rows / 360));
  }

  setQuality(q: Quality): void {
    const rebuild = (q.pixel !== 0) !== (this.quality.pixel !== 0);
    this.quality = q;
    this.renderer.shadowMap.enabled = q.shadows;
    this.scene.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) m.needsUpdate = true; });
    if (rebuild) this.buildComposer(); else this.bloom.enabled = q.bloom;
    this.resize();
  }

  resize(): void {
    const w = innerWidth, h = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, this.quality.dpr);
    this.renderer.setPixelRatio(dpr); this.renderer.setSize(w, h);
    this.composer.setPixelRatio(dpr); this.composer.setSize(w, h);
    this.px?.setPixelSize(this.pixelSize());
    this.camera.aspect = w / h;
    // keep enough horizontal coverage on tall/narrow screens (tablets, portrait phones)
    this.camera.fov = w / h < 1.4 ? 46 : w / h < 1.7 ? 40 : 36;
    this.camera.updateProjectionMatrix();
  }

  /** Visible half-width of the gameplay plane (z = 0) at the current camera distance. */
  get halfWidth(): number { return Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.distance * this.camera.aspect; }

  render(time: number): void {
    const f = this.focus, s = this.shakeOffset;
    this.camera.position.set(f.x + s.x, f.y - 0.45 + s.y, this.distance);
    this.camera.lookAt(f.x + s.x * 0.5, f.y + s.y * 0.5, 0);
    this.camera.rotation.z += s.z;
    this.grade.uniforms.uTime.value = time % 100;
    this.composer.render();
  }

  /** CSS pixels → world x on the gameplay plane (z = 0): mouse aiming. */
  toWorldX(cx: number, cy: number): number {
    const v = new THREE.Vector3((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1, 0.5).unproject(this.camera).sub(this.camera.position);
    const t = -this.camera.position.z / v.z;
    return this.camera.position.x + v.x * t;
  }

  /** World → CSS pixels (HUD name tags, prompts). */
  toScreen(x: number, y: number, z = 0): { x: number; y: number; visible: boolean } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, visible: v.z < 1 && Math.abs(v.x) < 1.2 };
  }
}
