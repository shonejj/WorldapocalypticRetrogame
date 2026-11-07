import * as THREE from 'three';
import { Rng } from '../core/math';
import { Batch, M, box, cyl, glowSprite, lightCone, plane, type LightSpot } from './kit';
import { FACADE_Z } from './buildings';
import { wetMaterial } from '../render/wet';

/** Depth bands (z, metres). Characters walk on the lane at z = 0. */
export const Z = {
  facade: FACADE_Z, lot: [-12, FACADE_Z] as const, walk: [FACADE_Z, 1.25] as const, gutter: [1.25, 1.9] as const,
  road: [1.9, 16] as const, lamps: FACADE_Z + 0.55, poles: FACADE_Z + 0.35,
};

/** Long ground strips spanning the level: lots → sidewalk (the lane) → gutter → wet road in the foreground. */
export function ground(x0: number, x1: number): THREE.Group {
  const B = new Batch(), w = x1 - x0, cx = (x0 + x1) / 2;
  const walk = wetMaterial(M.paving(), 0.45), road = wetMaterial(M.asphalt(), 1), gut = wetMaterial(M.asphalt(), 1.4);
  const strip = (z0: number, z1: number, top: number, mat: THREE.Material, tile = 2.5) =>
    B.add(mat, box(w, 0.6, z1 - z0, cx, top - 0.3, (z0 + z1) / 2, { tile }));
  strip(Z.lot[0], Z.lot[1], -0.01, M.concrete('#3a3d36', 6), 3);
  strip(Z.walk[0], Z.walk[1], 0.0, walk, 2);
  strip(Z.gutter[0], Z.gutter[1], -0.16, gut, 3);
  strip(Z.road[0], Z.road[1], -0.14, road, 4);
  const curb = M.concrete('#7b7d78', 2);
  B.add(curb, box(w, 0.2, 0.2, cx, -0.04, Z.walk[1], { tile: 1.5 }));
  return B.build({ castShadow: false });
}

export function streetLamp(x: number, z = Z.lamps, lit = true, flicker = false): { group: THREE.Group; light?: LightSpot } {
  const B = new Batch(), metal = M.metal('#3b4246');
  B.add(metal, cyl(0.07, 0.11, 6.2, x, 3.1, z, 10), cyl(0.18, 0.2, 0.4, x, 0.2, z, 10));
  B.add(metal, box(1.6, 0.08, 0.08, x + 0.75, 6.15, z, { rotZ: -0.08 }));
  B.add(metal, box(0.7, 0.14, 0.34, x + 1.5, 6.05, z));
  B.add(lit ? M.emissive(0xffd9a0, 6) : M.dark(), box(0.55, 0.03, 0.26, x + 1.5, 5.97, z));
  const g = B.build();
  if (!lit) return { group: g };
  const cone = lightCone(5.8, 2.2, 0xffc887, 0.022); cone.position.set(x + 1.5, 5.95, z); g.add(cone);
  const glow = glowSprite(1.6, 0xffd9a0, 0.85); glow.position.set(x + 1.5, 5.9, z + 0.1); g.add(glow);
  cone.name = 'cone'; glow.name = 'glow';
  return { group: g, light: { x: x + 1.5, y: 5.6, z: z + 0.6, color: 0xffbf7a, intensity: 26, distance: 15, flicker, cone: true } };
}

export function powerLine(xs: number[], z = Z.poles, seed = 3): THREE.Group {
  const B = new Batch(), wood = M.wood('#3d2c1f'), dark = M.dark(), R = new Rng(seed);
  for (const x of xs) {
    B.add(wood, cyl(0.12, 0.15, 9, x, 4.5, z, 8, { tile: 2 }), box(2.2, 0.14, 0.14, x, 8.4, z));
    B.add(M.metal('#6a6e66'), box(0.5, 0.7, 0.4, x + 0.25, 7.2, z + 0.25));
  }
  for (let i = 0; i + 1 < xs.length; i++) for (const off of [-0.9, 0.2, 0.9]) {
    const a = new THREE.Vector3(xs[i] + off, 8.45, z), b = new THREE.Vector3(xs[i + 1] + off, 8.45, z);
    const sag = 0.9 + R.next() * 0.6, pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector3().lerpVectors(a, b, t).setY(8.45 - Math.sin(t * Math.PI) * sag)); }
    B.add(dark, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.018, 4));
  }
  return B.build({ castShadow: false });
}

export function chainFence(x0: number, x1: number, z: number, h = 2.4): THREE.Group {
  const B = new Batch(), metal = M.metal('#596064');
  for (let x = x0; x <= x1 + 0.01; x += 2.5) B.add(metal, cyl(0.04, 0.04, h, x, h / 2, z, 6));
  B.add(metal, cyl(0.03, 0.03, x1 - x0, (x0 + x1) / 2, h - 0.05, z, 6, { rotZ: Math.PI / 2 }));
  const g = B.build();
  // chain-link mesh: one transparent plane with a procedural diamond alpha
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d')!;
  c.strokeStyle = 'rgba(160,170,175,1)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 32); c.lineTo(32, 0); c.lineTo(64, 32); c.lineTo(32, 64); c.closePath(); c.stroke();
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set((x1 - x0) / 0.12, h / 0.12);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, h - 0.1).translate((x0 + x1) / 2, h / 2, z), new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.4, metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide }));
  g.add(mesh);
  return g;
}

export function billboard(x: number, z: number, text: string): { group: THREE.Group; lights: LightSpot[] } {
  const B = new Batch(), metal = M.metal('#4a5052');
  for (const dx of [-1.8, 1.8]) B.add(metal, box(0.25, 6, 0.25, x + dx, 3, z));
  B.add(metal, box(6.4, 3.2, 0.2, x, 7.4, z - 0.12));
  B.add(M.sign(text, '#b9b39a', '#9e2c22', 0.12), plane(6.2, 3.0, x, 7.4, z));
  B.add(metal, box(6.4, 0.08, 0.6, x, 5.75, z + 0.25));
  const lights: LightSpot[] = [];
  for (const dx of [-1.6, 1.6]) {
    B.add(metal, box(0.06, 0.06, 0.8, x + dx, 9.1, z + 0.35), box(0.4, 0.12, 0.25, x + dx, 9.05, z + 0.75));
    lights.push({ x: x + dx, y: 8.6, z: z + 1.2, color: 0xfff0c8, intensity: 6, distance: 6, flicker: dx > 0 });
  }
  return { group: B.build(), lights };
}

/** Elevated highway running behind the street (seen through gaps between buildings). */
export function overpass(x0: number, x1: number, z = -17, seed = 4): { group: THREE.Group; lights: LightSpot[] } {
  const B = new Batch(), conc = M.concrete('#5d615f', 3), metal = M.metal('#4d5458'), R = new Rng(seed), lights: LightSpot[] = [];
  const w = x1 - x0, cx = (x0 + x1) / 2;
  B.add(conc, box(w, 1.2, 9, cx, 7.4, z, { tile: 3 }), box(w, 0.6, 0.3, cx, 8.3, z + 4.4, { tile: 3 }));
  for (let x = x0 + 4; x < x1; x += 14) B.add(conc, box(1.6, 6.8, 2.2, x, 3.4, z, { tile: 3 }), box(3.2, 0.7, 4, x, 6.6, z, { tile: 3 }));
  for (let x = x0; x < x1; x += 1.2) B.add(metal, box(0.05, 0.9, 0.05, x, 9.05, z + 4.4));
  B.add(metal, box(w, 0.06, 0.06, cx, 9.5, z + 4.4));
  for (let x = x0 + 6; x < x1; x += R.range(14, 26)) { B.add(M.paint(0x4a5254, 0.6), box(3.6, 1.1, 1.7, x, 8.55, z + 2)); }
  for (let x = x0 + 9; x < x1; x += 18) {
    B.add(metal, cyl(0.05, 0.07, 3, x, 9.5, z + 4.3, 6), box(0.6, 0.1, 0.25, x + 0.3, 11, z + 4.3));
    lights.push({ x: x + 0.3, y: 10.8, z: z + 4.6, color: 0xffc68a, intensity: 10, distance: 10, cone: false });
  }
  for (let i = 0; i < w / 6; i++) B.add(M.leaves(false, 9 + (i % 3)), plane(R.range(0.8, 1.6), R.range(1.2, 3.2), R.range(x0, x1), 6.2, z + 4.52 + i * 0.001));
  return { group: B.build({ castShadow: false }), lights };
}

/** Distant skyline: instanced silhouette blocks with sparse lit windows, deep in the fog. */
export function skyline(x0: number, x1: number, seed = 5): THREE.Group {
  const R = new Rng(seed), g = new THREE.Group();
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const c = cv.getContext('2d')!;
  c.fillStyle = '#0c141b'; c.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 124; y += 8) for (let x = 4; x < 60; x += 8) if (R.chance(0.08)) { c.fillStyle = R.chance(0.7) ? '#ffcf86' : '#9fd3e6'; c.fillRect(x, y, 4, 4); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.6, roughness: 1 });
  const n = Math.ceil((x1 - x0) / 7);
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, n * 2);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < n * 2; i++) {
    const w = R.range(5, 12), h = R.range(10, 42), d = R.range(5, 10);
    m4.compose(new THREE.Vector3(x0 + (i / 2) * 7 + R.range(-2, 2), h / 2 - 1, -70 - (i % 2) * 28 - R.range(0, 12)), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
    inst.setMatrixAt(i, m4);
  }
  g.add(inst);
  // red aviation lights
  for (let i = 0; i < n / 3; i++) { const s = glowSprite(1.2, 0xff3020, 0.9); s.position.set(x0 + R.range(0, x1 - x0), R.range(20, 40), -95); g.add(s); }
  return g;
}

/** Sky dome: night gradient, moon and drifting cloud bands. */
export function sky(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x0d161d) }, mid: { value: new THREE.Color(0x1f303c) }, low: { value: new THREE.Color(0x3a4f5e) }, flash: { value: 0 } },
    vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform float flash; varying vec3 vp;
      void main(){ float h = vp.y; vec3 c = h > 0.15 ? mix(mid, top, smoothstep(0.15, 0.7, h)) : mix(low, mid, smoothstep(-0.05, 0.15, h));
        gl_FragColor = vec4(c + flash * vec3(0.55, 0.62, 0.75) * smoothstep(-0.1, 0.5, h), 1.0); }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), mat); dome.name = 'sky';
  g.add(dome);
    return g;
}
