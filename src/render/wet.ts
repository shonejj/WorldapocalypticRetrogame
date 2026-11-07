import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { NO_REFLECT } from '../art/kit';

/**
 * Wet street (threejs-materials-lighting + shader-programming): a planar Reflector renders the
 * mirrored scene once per frame into a half-res target; ground materials sample it in puddles
 * picked by a world-space noise mask, with rain-ripple distortion and a grazing-angle Fresnel.
 * The ground stays a lit MeshStandardMaterial (lamp pools, shadows) — the reflection is added in
 * `onBeforeCompile`, so there is one material path whether reflections are on or off.
 */
const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blank.needsUpdate = true;
export const WET = {
  uRefl: { value: blank as THREE.Texture }, uReflMat: { value: new THREE.Matrix4() },
  uTime: { value: 0 }, uOn: { value: 0 },
};

export function wetMaterial(base: THREE.MeshStandardMaterial, amount: number): THREE.MeshStandardMaterial {
  const m = base.clone();
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, WET, { uWetAmt: { value: amount } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWetPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWetPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWetPos; uniform sampler2D uRefl; uniform mat4 uReflMat; uniform float uTime; uniform float uOn; uniform float uWetAmt;
      float wh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(wh(i), wh(i + vec2(1.0, 0.0)), f.x), mix(wh(i + vec2(0.0, 1.0)), wh(i + vec2(1.0, 1.0)), f.x), f.y); }
      float wetMask(){ vec2 p = vWetPos.xz; float n = wn(p * 0.32) * 0.6 + wn(p * 1.1 + 7.0) * 0.3 + wn(p * 3.7) * 0.1;
        float lo = 0.6 - 0.2 * uWetAmt; return smoothstep(lo, lo + 0.07, n); }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nfloat wetP = wetMask(); roughnessFactor = mix(roughnessFactor, 0.05, wetP);')
      .replace('#include <opaque_fragment>', `{
        vec2 rp = vWetPos.xz * 5.0;
        vec2 rip = (vec2(wn(rp + uTime * 3.1), wn(rp * 1.3 - uTime * 2.7 + 17.0)) - 0.5) * 0.014;
        vec4 rc = uReflMat * vec4(vWetPos, 1.0);
        vec3 refl = texture2D(uRefl, rc.xy / rc.w + rip).rgb;
        vec3 V = normalize(cameraPosition - vWetPos);
        float fr = 0.35 + 0.65 * pow(1.0 - max(V.y, 0.0), 3.0);
        outgoingLight = mix(outgoingLight, outgoingLight * 0.45 + refl * fr, wetP * uOn);
      }
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `wet${amount}`;
  return m;
}

export class WetReflections {
  private reflector: Reflector;
  private inv = new THREE.Matrix4();
  enabled = false;

  constructor(private scene: THREE.Scene, y = -0.14) {
    // the scene renders at ≈360 rows in pixel-art mode; a 480×270 mirror is plenty and cheap on phones
    this.reflector = new Reflector(new THREE.PlaneGeometry(400, 80), { textureWidth: 480, textureHeight: 270, clipBias: 0.01, multisample: 0 });
    this.reflector.rotation.x = -Math.PI / 2; this.reflector.position.y = y;
    // draw nothing ourselves; we only need its onBeforeRender pass, before the ground draws
    const texMat = (this.reflector.material as THREE.ShaderMaterial).uniforms.textureMatrix.value as THREE.Matrix4;
    (this.reflector.material as THREE.Material).dispose();
    this.reflector.material = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    this.reflector.renderOrder = -1000;
    const orig = this.reflector.onBeforeRender.bind(this.reflector);
    this.reflector.onBeforeRender = (r, sc, cam, geo, mat, grp) => {
      if (sc.overrideMaterial) return;                         // skip the pixel pass's normal render
      const hidden: THREE.Object3D[] = [];
      for (const o of NO_REFLECT) if (o.visible) { o.visible = false; hidden.push(o); }   // no halos/rain mirrored as floating flares
      WET.uRefl.value = blank;                                   // never sample the target we are drawing into (feedback loop)
      orig(r, sc, cam, geo, mat, grp);
      for (const o of hidden) o.visible = true;
      const tm = (this.reflector as unknown as { getRenderTarget(): THREE.WebGLRenderTarget }).getRenderTarget();
      WET.uRefl.value = tm.texture;
      WET.uReflMat.value.copy(texMat).multiply(this.inv.copy(this.reflector.matrixWorld).invert());   // world → reflection UV
    };
    this.reflector.visible = false;
    scene.add(this.reflector);
  }

  setEnabled(on: boolean): void { this.enabled = on; this.reflector.visible = on; WET.uOn.value = on ? 1 : 0; }

  /** Follow the camera and publish the world→reflection-UV matrix for the ground shader. */
  update(camX: number, time: number): void {
    WET.uTime.value = time;
    if (!this.enabled) return;
    this.reflector.position.x = camX;
    this.reflector.updateMatrixWorld();
  }

  dispose(): void { this.scene.remove(this.reflector); this.reflector.dispose(); WET.uOn.value = 0; WET.uRefl.value = blank; }
}
