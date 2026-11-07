import { NO_REFLECT } from '../art/kit';
import * as THREE from 'three';

/**
 * Rain in every depth layer (production bible §Art, gaps #12/#13):
 *  - far/mid streaks from the city haze to the lane (thin, faint)
 *  - near streaks between the camera and the lane (longer, brighter, fewer) — the foreground rain
 *  - impact rings on the road and sidewalk: a GPU-only instanced ripple field that re-seeds each ring
 *    from its instance id and cycle, so thousands of splashes cost one draw call and no CPU
 * Drops are removed under cover (awnings): `cover` boxes are set by the game from the level.
 */
interface Layer { lines: THREE.LineSegments; drops: Float32Array; n: number; z0: number; z1: number; len: number }
export interface Cover { x0: number; x1: number; z0: number; z1: number; y: number }

const RING_VS = `
  attribute float aId;
  uniform float uTime; uniform float uCamX; uniform vec2 uZ; uniform float uSpan;
  varying float vA; varying vec2 vUv;
  float h(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    float life = 0.55, t = uTime / life + h(aId * 7.1);
    float cyc = floor(t), k = fract(t);
    float x = uCamX + (h(aId * 13.7 + cyc * 3.1) - 0.5) * uSpan;
    float z = mix(uZ.x, uZ.y, h(aId * 5.3 + cyc * 1.7));
    float y = z > 1.25 ? -0.135 : 0.006;                     // road (lower) vs sidewalk
    float r = 0.04 + k * 0.22;
    vA = (1.0 - k) * (1.0 - k);
    vUv = uv;
    vec3 p = vec3(x + position.x * r, y, z + position.y * r * 0.9);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }`;
const RING_FS = `
  varying float vA; varying vec2 vUv; uniform float uAlpha;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float ring = smoothstep(0.62, 0.8, d) * (1.0 - smoothstep(0.86, 1.0, d));
    gl_FragColor = vec4(vec3(0.72, 0.82, 0.9), ring * vA * uAlpha);
  }`;

export class Rain {
  private layers: Layer[] = [];
  private rings: THREE.Mesh;
  private ringMat: THREE.ShaderMaterial;
  enabled = true;
  splashes: { x: number; z: number }[] = [];
  cover: Cover[] = [];
  private camX = 0; private time = 0;

  constructor(scene: THREE.Scene, count = 1700) {
    this.addLayer(scene, count, -14, 2, 0.022, 0x9fb8c8, 0.17);        // haze → lane
    this.addLayer(scene, Math.round(count * 0.16), 2, 8.6, 0.05, 0xc4d6e2, 0.22);   // between the lens and the lane
    // impact rings: one instanced quad field
    const n = 700, g = new THREE.InstancedBufferGeometry();
    g.copy(new THREE.PlaneGeometry(2, 2) as unknown as THREE.InstancedBufferGeometry);
    const ids = new Float32Array(n); for (let i = 0; i < n; i++) ids[i] = i;
    g.setAttribute('aId', new THREE.InstancedBufferAttribute(ids, 1)); g.instanceCount = n;
    this.ringMat = new THREE.ShaderMaterial({
      vertexShader: RING_VS, fragmentShader: RING_FS, transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uCamX: { value: 0 }, uZ: { value: new THREE.Vector2(-4.0, 8.5) }, uSpan: { value: 30 }, uAlpha: { value: 0.55 } },
    });
    this.rings = new THREE.Mesh(g, this.ringMat); this.rings.frustumCulled = false; this.rings.renderOrder = 2;
    scene.add(this.rings); NO_REFLECT.add(this.rings);
  }

  private addLayer(scene: THREE.Scene, n: number, z0: number, z1: number, len: number, color: number, opacity: number): void {
    const L: Layer = { lines: null as unknown as THREE.LineSegments, drops: new Float32Array(n * 3), n, z0, z1, len };
    for (let i = 0; i < n; i++) this.respawn(L, i, true);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    L.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    L.lines.frustumCulled = false; scene.add(L.lines); NO_REFLECT.add(L.lines);
    this.layers.push(L);
  }

  private respawn(L: Layer, i: number, anywhere: boolean): void {
    const d = L.drops;
    d[i * 3] = this.camX + (Math.random() - 0.5) * 34;
    d[i * 3 + 1] = anywhere ? Math.random() * 14 : 12 + Math.random() * 3;
    d[i * 3 + 2] = L.z0 + Math.random() * (L.z1 - L.z0);
  }

  private covered(x: number, y: number, z: number): boolean {
    for (const c of this.cover) if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && y < c.y) return true;
    return false;
  }

  update(dt: number, camX: number): void {
    this.splashes.length = 0; this.camX = camX; this.time += dt;
    this.rings.visible = this.enabled;
    for (const L of this.layers) L.lines.visible = this.enabled;
    if (!this.enabled) return;
    this.ringMat.uniforms.uTime.value = this.time; this.ringMat.uniforms.uCamX.value = camX;
    const vy = -16, vx = -2.4;
    for (const L of this.layers) {
      const d = L.drops, pos = L.lines.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < L.n; i++) {
        d[i * 3] += vx * dt; d[i * 3 + 1] += vy * dt;
        const x = d[i * 3], y = d[i * 3 + 1], z = d[i * 3 + 2];
        if (y < 0 || Math.abs(x - camX) > 18 || (y < 3.6 && this.covered(x, y, z))) {
          if (y < 0 && i % 6 === 0) this.splashes.push({ x, z });
          this.respawn(L, i, false);
        }
        pos.setXYZ(i * 2, d[i * 3], d[i * 3 + 1], d[i * 3 + 2]);
        pos.setXYZ(i * 2 + 1, d[i * 3] - vx * L.len, d[i * 3 + 1] - vy * L.len, d[i * 3 + 2]);
      }
      pos.needsUpdate = true;
    }
  }
}
