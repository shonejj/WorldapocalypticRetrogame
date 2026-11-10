import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/** pixel: 0 = HD (no pixel filter), -1 = auto (≈360 art rows, the pixel-art default), n = fixed block size. */
export interface Quality { dpr: number; pixel: number; bloom: boolean; shadows: boolean; reflections: boolean }
export const QUALITY_PRESETS: Record<'high' | 'medium' | 'low', Quality> = {
  high: { dpr: 1.5, pixel: -1, bloom: true, shadows: true, reflections: true },
  medium: { dpr: 1.0, pixel: -1, bloom: true, shadows: false, reflections: true },   // phones
  low: { dpr: 1.0, pixel: -1, bloom: false, shadows: false, reflections: false },
};

/**
 * Depth of field (production bible gap #14): blur grows with distance from the focal plane — the
 * lane at z = 0 — so the near foreground and the far city soften while the street stays sharp.
 * 12-tap disc at the low pixel-art resolution: cheap enough for phones.
 */
const DofShader = {
  uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uNear: { value: 0.3 }, uFar: { value: 900 }, uFocus: { value: 10 }, uTexel: { value: new THREE.Vector2(1 / 640, 1 / 360) }, uStrength: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform float uNear; uniform float uFar; uniform float uFocus; uniform vec2 uTexel; uniform float uStrength; varying vec2 vUv;
    float viewZ(vec2 uv){ float d = texture2D(tDepth, uv).x; return (uNear * uFar) / ((uFar - uNear) * d - uFar); }
    void main(){
      float z = -viewZ(vUv);
      float nearB = smoothstep(uFocus - 3.2, uFocus - 7.5, z);            // between lens and lane
      float farB = smoothstep(uFocus + 14.0, uFocus + 45.0, z) * 0.75;    // the city behind the gaps
      float coc = max(nearB, farB) * 2.6 * uStrength;
      vec4 c = texture2D(tDiffuse, vUv);
      if (coc < 0.15) { gl_FragColor = c; return; }
      vec4 acc = c; float n = 1.0;
      for (int i = 0; i < 12; i++) { float a = float(i) * 2.39996; float r = coc * sqrt((float(i) + 0.5) / 12.0);
        acc += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * r * uTexel); n += 1.0; }
      gl_FragColor = acc / n;
    }`,
};

/**
 * Colour grade, applied before OutputPass (linear space): split-tone (shadow / highlight tints per
 * mood), saturation, a fog-coloured lift so blacks never go dead, vignette, damage tint, and an
 * ordered-dither posterise that turns smooth gradients into pixel-art colour bands. No film grain:
 * at 360 art rows per-pixel noise reads as dirt, not texture.
 */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uHurt: { value: 0 }, uVignette: { value: 0.5 }, uShadow: { value: new THREE.Vector3(0.86, 1, 1.12) }, uHigh: { value: new THREE.Vector3(1.1, 1, 0.86) },
    uSat: { value: 1 }, uLift: { value: new THREE.Color(0) }, uBands: { value: 34 }, uRes: { value: new THREE.Vector2(640, 360) }, uFade: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uHurt; uniform float uVignette; uniform vec3 uShadow; uniform vec3 uHigh; uniform float uSat; uniform vec3 uLift; uniform float uBands; uniform vec2 uRes; uniform float uFade; varying vec2 vUv;
    float bayer(vec2 p){ vec2 q = floor(mod(p, 4.0)); float i = q.x + q.y * 4.0;
      float m = i < 1.0 ? 0.0 : i < 2.0 ? 8.0 : i < 3.0 ? 2.0 : i < 4.0 ? 10.0 : i < 5.0 ? 12.0 : i < 6.0 ? 4.0 : i < 7.0 ? 14.0 : i < 8.0 ? 6.0 : i < 9.0 ? 3.0 : i < 10.0 ? 11.0 : i < 11.0 ? 1.0 : i < 12.0 ? 9.0 : i < 13.0 ? 15.0 : i < 14.0 ? 7.0 : i < 15.0 ? 13.0 : 5.0;
      return (m / 16.0 - 0.47) * 0.7; }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126,0.7152,0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      c.rgb *= mix(uShadow, uHigh, smoothstep(0.02, 0.6, l));
      c.rgb += uLift * (1.0 - smoothstep(0.0, 0.35, l));
      vec2 d = vUv - 0.5; float vig = smoothstep(0.85, 0.25, length(d * vec2(1.3, 1.0)));
      c.rgb *= mix(1.0, vig, uVignette);
      c.rgb = mix(c.rgb, c.rgb * vec3(1.8,0.35,0.3), uHurt * (1.0 - vig * 0.6));
      if (uBands > 0.0) { vec3 g = sqrt(max(c.rgb, 0.0)); g = floor(g * uBands + 0.5 + bayer(vUv * uRes)) / uBands; c.rgb = g * g; }
      c.rgb *= 1.0 - uFade;
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
  readonly camera = new THREE.PerspectiveCamera(43, 16 / 9, 0.3, 900);
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  readonly grade = new ShaderPass(GradeShader);
  readonly dof = new ShaderPass(DofShader);
  quality: Quality = QUALITY_PRESETS.high;
  /** Camera target and additive shake offset (camera-systems: shake rides on top of follow). */
  focus = new THREE.Vector3(0, 1.9, 0);
  shakeOffset = new THREE.Vector3();
  /** Close, low, fairly wide camera: characters ≈ ¼ of screen height and strong parallax between
   *  the foreground, the lane, the facades and the far city (2.5D). zoom/lift/swing are eased by
   *  the game per level beat (camera "moments") and by movement (the camera trails, so it yaws). */
  readonly baseDistance = 10;
  zoom = 1; lift = 0; swing = 0;
  /** interiors: isometric camera around this target (null = side-scrolling street camera) */
  iso: THREE.Vector3 | null = null;
  get distance(): number { return this.baseDistance * this.zoom; }

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
    // the scene target carries a depth texture for the depth-of-field pass
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(1, 1) });
    this.composer = new EffectComposer(this.renderer, rt);
    // Pixel art = render the scene at ~360 rows and let CSS scale it up with nearest-neighbour
    // (style.css: image-rendering: pixelated). One scene render at a fraction of the pixels — the
    // cheapest path on phones — instead of RenderPixelatedPass (full-res beauty + normals pass).
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(this.dof);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 256), 0.32, 0.35, 0.92)   // subtle: glow on real light sources only, no flare blobs;
    this.bloom.enabled = this.quality.bloom;
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  /** Render pixel ratio: pixel-art modes render ≈360 art rows (auto) or 1/n of the screen; HD uses the quality dpr. */
  private renderRatio(): number {
    const hd = Math.min(devicePixelRatio || 1, this.quality.dpr);
    if (this.quality.pixel === 0) return hd;
    const rows = this.quality.pixel > 0 ? (innerHeight * hd) / this.quality.pixel : 360;
    return Math.min(hd, rows / innerHeight);
  }

  setQuality(q: Quality): void {
    const shadowsChanged = q.shadows !== this.quality.shadows;
    this.quality = q;
    this.renderer.shadowMap.enabled = q.shadows;
    if (shadowsChanged) this.scene.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) m.needsUpdate = true; });
    this.bloom.enabled = q.bloom;
    this.resize();
  }

  resize(): void {
    const w = innerWidth, h = innerHeight;
    const dpr = this.renderRatio();
    this.renderer.setPixelRatio(dpr); this.renderer.setSize(w, h);
    this.composer.setPixelRatio(dpr); this.composer.setSize(w, h);
    this.canvas.classList.toggle('pixelated', this.quality.pixel !== 0);
    this.camera.aspect = w / h;
    // keep enough horizontal coverage on tall/narrow screens (tablets, portrait phones)
    this.camera.fov = w / h < 1.4 ? 54 : w / h < 1.7 ? 48 : 43;
    this.camera.updateProjectionMatrix();
  }

  /** Visible half-width of the gameplay plane (z = 0) at the current camera distance. */
  get halfWidth(): number { return Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.distance * this.camera.aspect; }

  render(time: number): void {
    const f = this.focus, s = this.shakeOffset;
    if (this.iso) { const t = this.iso; this.camera.position.set(t.x + 5.0 + s.x, t.y + 7.6 + s.y, t.z + 6.3); this.camera.lookAt(t); }
    else {
      this.camera.position.set(f.x + s.x - this.swing, f.y - 0.45 + this.lift + s.y, this.distance);
      this.camera.lookAt(f.x + s.x * 0.5, f.y + this.lift * 0.35 + s.y * 0.5, 0);
    }
    this.camera.rotation.z += s.z;
    this.grade.uniforms.uTime.value = time % 100;
    const u = this.dof.uniforms, rb = this.composer.readBuffer;
    u.tDepth.value = rb.depthTexture; u.uNear.value = this.camera.near; u.uFar.value = this.camera.far;
    u.uFocus.value = this.iso ? this.camera.position.distanceTo(this.iso) : this.camera.position.z; u.uTexel.value.set(1 / rb.width, 1 / rb.height);
    this.grade.uniforms.uRes.value.set(rb.width, rb.height); this.grade.uniforms.uBands.value = this.quality.pixel === 0 ? 0 : 34;
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
