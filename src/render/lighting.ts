import * as THREE from 'three';

/**
 * 2D scene lighting for painted sprites. Every "lit" material samples up to
 * MAX_LIGHTS point lights in world XY (lamps, shop glow, muzzle flashes,
 * lightning ambient) and multiplies them onto the painted albedo. Uniforms are
 * shared by reference, so updating LIGHTS once per frame updates every sprite.
 */
export const MAX_LIGHTS = 16;

export const LIGHTS = {
  uLightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4(0, 0, 1, 0)) },   // x, y, radius, intensity
  uLightCol: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Color(0, 0, 0)) },
  uAmbient: { value: new THREE.Color(0.7, 0.76, 0.86) },
  uTime: { value: 0 },
};

export interface Light { x: number; y: number; radius: number; intensity: number; color: THREE.Color; on?: boolean }

/** Upload the strongest lights near the camera. */
export function uploadLights(lights: Light[], camX: number): void {
  const near = lights.filter((l) => l.on !== false && l.intensity > 0.01 && Math.abs(l.x - camX) < 14 + l.radius)
    .sort((a, b) => Math.abs(a.x - camX) - Math.abs(b.x - camX)).slice(0, MAX_LIGHTS);
  for (let i = 0; i < MAX_LIGHTS; i++) {
    const l = near[i];
    if (l) { LIGHTS.uLightPos.value[i].set(l.x, l.y, l.radius, l.intensity); LIGHTS.uLightCol.value[i].copy(l.color); }
    else LIGHTS.uLightPos.value[i].set(0, -999, 1, 0);
  }
}

const vertexHead = /* glsl */ `varying vec2 vWorldXY;\n`;
const vertexBody = /* glsl */ `vWorldXY = (modelMatrix * vec4(transformed, 1.0)).xy;\n`;
const fragmentHead = /* glsl */ `
varying vec2 vWorldXY;
uniform vec4 uLightPos[${MAX_LIGHTS}];
uniform vec3 uLightCol[${MAX_LIGHTS}];
uniform vec3 uAmbient;
uniform float uTime;
uniform float uLitAmount;
uniform float uReflect;
vec3 sceneLight(vec2 p) {
  vec3 acc = uAmbient;
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    vec4 L = uLightPos[i];
    float d = length((p - L.xy) * vec2(1.0, 1.35)) / max(L.z, 0.001);
    float a = clamp(1.0 - d, 0.0, 1.0);
    acc += uLightCol[i] * (a * a) * L.w;
  }
  return acc;
}
`;

export interface LitOptions { lit?: number; reflect?: boolean; opacity?: number; tint?: number; fog?: boolean; alphaTest?: number; depthWrite?: boolean }

/** MeshBasicMaterial + scene lighting (and optional wet-street reflection mode). */
export function litMaterial(map: THREE.Texture, o: LitOptions = {}): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({
    map, transparent: true, alphaTest: o.alphaTest ?? (o.reflect ? 0.02 : 0.35), opacity: o.opacity ?? 1,
    color: o.tint ?? 0xffffff, fog: o.fog ?? true, depthWrite: o.depthWrite ?? !o.reflect,
  });
  const lit = o.lit ?? 1, reflect = o.reflect ? 1 : 0;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, LIGHTS, { uLitAmount: { value: lit }, uReflect: { value: reflect } });
    sh.vertexShader = vertexHead + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\n${vertexBody}`);
    sh.fragmentShader = fragmentHead + sh.fragmentShader
      .replace('#include <map_fragment>', /* glsl */ `
        vec2 rUv = vMapUv;
        if (uReflect > 0.5) rUv.x += sin(vWorldXY.y * 38.0 + uTime * 3.0) * 0.004 * (1.0 + -vWorldXY.y);
        vec4 sampledDiffuseColor = texture2D(map, rUv);
        diffuseColor *= sampledDiffuseColor;
        vec3 light = mix(vec3(1.0), sceneLight(vWorldXY), uLitAmount);
        diffuseColor.rgb *= light;
        if (uReflect > 0.5) { diffuseColor.a *= smoothstep(-1.05, -0.02, vWorldXY.y) * 0.32; diffuseColor.rgb *= vec3(0.55, 0.65, 0.8); }
      `);
  };
  m.customProgramCacheKey = () => `lit${lit}${reflect}`;
  return m;
}
