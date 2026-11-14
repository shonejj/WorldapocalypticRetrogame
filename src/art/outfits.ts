import * as THREE from 'three';
import { Rng } from '../core/math';
import { M } from './kit';
import { rimify, type Look } from './characters';

/**
 * Silhouette kits. The CC0 body pack has a single outfit per sex, so identity comes from rigid
 * garments and gear attached to bones in the bind pose: a hood, a vest with pouches, a long coat,
 * a medic bag with a cross, an antenna. At 360 art rows a character is ~90 px tall, so each kit is
 * built to read as a different SHAPE first and a different colour second.
 *
 * Infected get the opposite treatment: their skin shader adds veins, bruising and blood, and the
 * fungus grows out of them in plates (heads first), so no one mistakes them for survivors.
 */
export type Kit = 'scav' | 'medic' | 'mech' | 'signal';
type Put = (bone: string, mesh: THREE.Object3D, dx: number, dy: number, dz: number) => void;

const cloth = (c: number, rough = 0.92) => { const m = (M.cloth(c) as THREE.MeshStandardMaterial).clone(); m.roughness = rough; rimify(m); return m; };
const flat = (c: number) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }); rimify(m); return m; };
const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => { const o = new THREE.Mesh(g, m); o.castShadow = true; return o; };

/** A small canvas texture with a red cross (medic). */
let crossTex: THREE.CanvasTexture | null = null;
function cross(): THREE.CanvasTexture {
  if (crossTex) return crossTex;
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d')!;
  g.fillStyle = '#e8e2d4'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#b81e1e'; g.fillRect(12, 5, 8, 22); g.fillRect(5, 12, 22, 8);
  crossTex = new THREE.CanvasTexture(c); crossTex.colorSpace = THREE.SRGBColorSpace; crossTex.magFilter = THREE.NearestFilter; crossTex.userData.keep = true;
  return crossTex;
}

export function survivorKit(kit: Kit, L: Look, put: Put, blink: (o: THREE.Mesh) => void): void {
  if (kit === 'scav') {
    // Reed: hood down on the shoulders, chest rig with three mag pouches, bandana, knee pads
    const jacket = cloth(L.top), rig = cloth(0x2e3226), dark = cloth(0x1c1e1a);
    const hood = mesh(new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), jacket); hood.scale.set(1.15, 0.7, 0.9); hood.rotation.x = 2.3;
    put('neck_01', hood, 0, 0.0, -0.1);
    const plate = mesh(new THREE.BoxGeometry(0.3, 0.26, 0.07), rig); put('spine_03', plate, 0, -0.02, 0.13);
    for (const x of [-0.09, 0, 0.09]) put('spine_03', mesh(new THREE.BoxGeometry(0.07, 0.11, 0.05), dark), x, -0.07, 0.18);
    put('neck_01', mesh(new THREE.TorusGeometry(0.075, 0.03, 6, 12), cloth(0x6a2a22)), 0, -0.02, 0.01);
    for (const s of ['l', 'r']) put(`calf_${s}`, mesh(new THREE.BoxGeometry(0.11, 0.1, 0.06), dark), 0, 0.02, 0.07);
  } else if (kit === 'medic') {
    // Maya: white-and-red field vest, cross on the back, satchel on the hip, armband
    const vest = cloth(0xd8d2c4, 0.85), red = cloth(0x9a2222);
    const front = mesh(new THREE.BoxGeometry(0.3, 0.3, 0.05), vest); put('spine_03', front, 0, -0.04, 0.12);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshStandardMaterial({ map: cross(), roughness: 0.9 }));
    back.rotation.y = Math.PI; put('spine_03', back, 0, 0.0, -0.16);
    const bag = mesh(new THREE.BoxGeometry(0.22, 0.17, 0.09), red); put('pelvis', bag, 0.15, -0.08, 0.03);
    const cr = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), new THREE.MeshStandardMaterial({ map: cross(), roughness: 0.9 })); cr.rotation.y = Math.PI / 2; put('pelvis', cr, 0.2, -0.07, 0.03);
    const strap = mesh(new THREE.BoxGeometry(0.04, 0.55, 0.03), red); strap.rotation.z = 0.7; put('spine_03', strap, 0.02, -0.05, 0.15);
    put('upperarm_l', mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.06, 10), vest), 0, -0.1, 0);
  } else if (kit === 'mech') {
    // Miller: long heavy coat (skirt panels on the thighs), tool belt, welding goggles on the cap
    const coat = cloth(0x4a3e2c), belt = cloth(0x3a2a1a), metal = flat(0x8a8a80);
    for (const s of ['l', 'r'] as const) { const p = mesh(new THREE.BoxGeometry(0.17, 0.4, 0.2), coat); put(`thigh_${s}`, p, 0, -0.17, -0.01); }
    put('spine_02', mesh(new THREE.BoxGeometry(0.36, 0.3, 0.25), coat), 0, 0.02, -0.01);
    put('pelvis', mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 16), belt), 0, 0.06, 0);
    const wrench = mesh(new THREE.BoxGeometry(0.03, 0.22, 0.015), metal); put('pelvis', wrench, -0.2, -0.06, 0.04);
    const g = new THREE.Group(); for (const x of [-0.045, 0.045]) { const l = mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 10), flat(0x2a3a3a)); l.rotation.x = Math.PI / 2; l.position.x = x; g.add(l); }
    put('Head', g, 0, 0.15, 0.09);
  } else {
    // Iris: tall whip antenna on the pack with a blinking tip, long scarf tail, hood up-turned collar
    const scarf = cloth(L.scarf ?? 0x2f4a52), black = flat(0x1a1a1c);
    const ant = mesh(new THREE.CylinderGeometry(0.006, 0.01, 0.9, 5), black); ant.rotation.z = -0.18; put('spine_03', ant, 0.12, 0.5, -0.3);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), M.emissive(0xff3a2a, 5)); put('spine_03', tip, 0.2, 0.95, -0.3); blink(tip);
    put('spine_03', mesh(new THREE.BoxGeometry(0.16, 0.12, 0.08), black), 0.11, 0.1, -0.31);   // the radio set on the pack
    put('neck_01', mesh(new THREE.TorusGeometry(0.08, 0.04, 6, 12), scarf), 0, -0.02, 0.01);
    const tail = mesh(new THREE.BoxGeometry(0.08, 0.38, 0.025), scarf); tail.rotation.x = 0.2; put('spine_03', tail, -0.08, -0.12, 0.14);
  }
}

// ------------------------------------------------------------------ infected
/** Fungal plates: layered, slightly cupped discs that sprout from a point (heads, shoulders, backs). */
export function fungus(R: Rng, n: number, size: number): THREE.Group {
  const g = new THREE.Group(), cap = new THREE.MeshStandardMaterial({ color: 0xd8c49a, roughness: 0.55, emissive: 0x2a1c0a }), gill = new THREE.MeshStandardMaterial({ color: 0x6a3a2a, roughness: 0.8 });
  rimify(cap); rimify(gill);
  for (let k = 0; k < n; k++) {
    const r = size * R.range(0.55, 1), geo = new THREE.CylinderGeometry(r, r * 0.8, r * 0.18, 9);
    const p = new THREE.Mesh(geo, R.chance(0.7) ? cap : gill);
    p.position.set(R.range(-1, 1) * size * 0.7, R.range(-0.3, 1) * size * 0.8, R.range(-1, 1) * size * 0.6);
    p.rotation.set(R.range(-0.9, 0.9), R.range(0, 6.28), R.range(-0.9, 0.9));
    p.scale.set(1, 1, R.range(0.6, 1.1)); p.castShadow = true; g.add(p);
  }
  return g;
}

/** Infected skin and rags: veins, bruising, blood around the mouth and hands, wet sheen. Object space, so it sticks to the body. */
export function infectedFx(sh: THREE.WebGLProgramParametersWithUniforms, seed: number, skin: boolean): void {
  sh.uniforms.uSeedInf = { value: (seed % 97) * 1.37 };
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vInfP;')
    .replace('#include <skinning_vertex>', '#include <skinning_vertex>\nvInfP = transformed;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
    varying vec3 vInfP; uniform float uSeedInf;
    float ih(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
    float in3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(ih(i), ih(i + vec3(1,0,0)), f.x), mix(ih(i + vec3(0,1,0)), ih(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(ih(i + vec3(0,0,1)), ih(i + vec3(1,0,1)), f.x), mix(ih(i + vec3(0,1,1)), ih(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
    .replace('#include <map_fragment>', `#include <map_fragment>
    {
      vec3 q = vInfP * 9.0 + uSeedInf;
      float blotch = in3(q * 0.35);
      ${skin ? `float vein = 1.0 - smoothstep(0.0, 0.07, abs(in3(q * 1.3) - 0.5));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.34, 0.26), smoothstep(0.45, 0.8, blotch) * 0.55);   // necrotic green-grey
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.08, 0.14), vein * 0.75);                          // dark veins
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.03, 0.02), smoothstep(0.62, 0.75, in3(q * 0.6 + 4.0)) * 0.85);   // blood` :
      `diffuseColor.rgb *= 0.75 + 0.35 * blotch;                                                                // filth
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.26, 0.03, 0.02), smoothstep(0.6, 0.72, in3(q * 0.5 + 9.0)) * 0.8);   // old blood
      diffuseColor.rgb *= 1.0 - smoothstep(0.7, 0.8, in3(q * 2.2 + 3.0)) * 0.6;                                // rips and grime`}
    }`);
}
