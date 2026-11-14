import * as THREE from 'three';
import type { Renderer } from './renderer';
import type { LightPool } from './lighting';
import { RIM } from '../art/characters';

/**
 * Mood (art direction): one palette per place — fog, sky, light, grade and weather — so every
 * location has its own identity while sharing the same rule: the world dissolves into luminous
 * fog and the cast reads as rim-lit silhouettes against it (reference: fog-bound side-scrollers).
 * Applied on level load and when the squad walks through a door (street ↔ room).
 */
export interface Mood {
  fog: number; density: number; sky: [number, number, number];
  hemi: [number, number, number]; moon: [number, number]; key: [number, number];
  exposure: number; shadow: [number, number, number]; high: [number, number, number]; sat: number; lift: number; vignette: number;
  rain: boolean; wet: boolean; haze: number; rim: [number, number]; env: number;
}
export type MoodId = 'rainNight' | 'fogDawn' | 'dusk' | 'lab' | 'room' | 'camp' | 'house';

export const MOODS: Record<MoodId, Mood> = {
  // Chapter 1: rain at night. Blue fog glows behind the street; sodium lamps are the only warmth.
  rainNight: { fog: 0x3b5868, density: 0.022, sky: [0x14222d, 0x2f4959, 0x56788a], hemi: [0x7396b0, 0x2a241c, 1.55], moon: [0xb6d0e6, 1.35], key: [0xd2deea, 1.0],
    exposure: 1.5, shadow: [0.84, 1.0, 1.14], high: [1.12, 1.0, 0.85], sat: 0.92, lift: 0.012, vignette: 0.55, rain: true, wet: true, haze: 0.5, rim: [0x8fb4cc, 0.2], env: 0.85 },
  // Chapter 2: dawn fog on the highway. Pale, cold, quiet — the reference frame.
  fogDawn: { fog: 0x9db7c0, density: 0.03, sky: [0x88aab8, 0xb2ccd3, 0xcddde0], hemi: [0xbdd6df, 0x4c4c44, 1.7], moon: [0xe6eef2, 0.85], key: [0xdfe8ee, 0.45],
    exposure: 1.12, shadow: [0.9, 1.02, 1.1], high: [1.03, 1.0, 0.95], sat: 0.72, lift: 0.03, vignette: 0.4, rain: false, wet: false, haze: 1, rim: [0xd6e6ee, 0.1], env: 0.55 },
  // Chapter 3 exterior: the last light behind the facility.
  dusk: { fog: 0x6e5a66, density: 0.022, sky: [0x232a44, 0x8c5a5a, 0xe6a06a], hemi: [0xa07e86, 0x2a2420, 1.35], moon: [0xffae7a, 1.5], key: [0xd8c8d0, 0.7],
    exposure: 1.35, shadow: [0.92, 0.96, 1.14], high: [1.16, 0.98, 0.82], sat: 0.95, lift: 0.015, vignette: 0.55, rain: false, wet: false, haze: 0.7, rim: [0xffb890, 0.16], env: 0.7 },
  // Chapter 3 interior: emergency power, cold tubes, deep blacks.
  lab: { fog: 0x0d171b, density: 0.03, sky: [0x05080a, 0x05080a, 0x05080a], hemi: [0x6f9299, 0x101616, 0.6], moon: [0x9fc4cc, 0], key: [0xb4d4da, 0.55],
    exposure: 1.35, shadow: [0.82, 1.02, 1.1], high: [0.98, 1.04, 1.0], sat: 0.85, lift: 0.006, vignette: 0.7, rain: false, wet: false, haze: 0, rim: [0x9fd0d8, 0.16], env: 0.5 },
  // Searchable rooms: a torch-lit pocket of the old world. Warm where a lamp still burns, black elsewhere.
  room: { fog: 0x120d0a, density: 0.016, sky: [0x040506, 0x040506, 0x040506], hemi: [0x8a6e58, 0x1a130d, 0.6], moon: [0xffd0a0, 0], key: [0xffd8b0, 0.5],
    exposure: 1.4, shadow: [0.95, 0.98, 1.08], high: [1.14, 1.0, 0.82], sat: 1.0, lift: 0.006, vignette: 0.7, rain: false, wet: false, haze: 0, rim: [0xffc890, 0.18], env: 0.5 },
  // 3D houses: dust in cold window light, a candle somebody left burning, your flashlight
  house: { fog: 0x14100c, density: 0.035, sky: [0x040506, 0x040506, 0x040506], hemi: [0x8a8478, 0x2a1e14, 0.75], moon: [0xa0b8d0, 0], key: [0xffe0c0, 0.3],
    exposure: 1.6, shadow: [0.9, 0.98, 1.12], high: [1.12, 1.02, 0.88], sat: 0.95, lift: 0.004, vignette: 0.85, rain: false, wet: false, haze: 0, rim: [0x9fb8d0, 0.12], env: 0.35 },
  // Safehouse: candles, lanterns, blankets. The one place that is safe.
  camp: { fog: 0x2a1c12, density: 0.012, sky: [0x060607, 0x060607, 0x060607], hemi: [0xb08a64, 0x2a1c12, 0.95], moon: [0xffd0a0, 0], key: [0xffdcb4, 0.65],
    exposure: 1.5, shadow: [1.0, 0.97, 1.02], high: [1.18, 1.0, 0.78], sat: 1.08, lift: 0.01, vignette: 0.6, rain: false, wet: false, haze: 0, rim: [0xffc480, 0.24], env: 0.6 },
};

/** Push a mood into the renderer, the light rig, the sky dome and the character rim uniforms. */
export function applyMood(m: Mood, r: Renderer, lights: LightPool, sky: THREE.Object3D | null): void {
  const fog = r.scene.fog as THREE.FogExp2;
  fog.color.setHex(m.fog); fog.density = m.density;
  (r.scene.background as THREE.Color).setHex(m.sky[2] === m.sky[0] ? m.sky[0] : m.fog);
  r.renderer.toneMappingExposure = m.exposure; r.scene.environmentIntensity = m.env;
  const u = r.grade.uniforms;
  u.uShadow.value.set(...m.shadow); u.uHigh.value.set(...m.high); u.uSat.value = m.sat; u.uVignette.value = m.vignette;
  u.uLift.value.setHex(m.fog).multiplyScalar(m.lift * 6);
  lights.hemi.color.setHex(m.hemi[0]); lights.hemi.groundColor.setHex(m.hemi[1]); lights.base.hemi = m.hemi[2];
  lights.moon.color.setHex(m.moon[0]); lights.base.moon = m.moon[1];
  lights.key.color.setHex(m.key[0]); lights.key.intensity = m.key[1];
  RIM.uRimColor.value.setHex(m.rim[0]); RIM.uFill.value = m.rim[1];
  const dome = sky?.getObjectByName('sky') as THREE.Mesh | undefined;
  if (dome) { const su = (dome.material as THREE.ShaderMaterial).uniforms; su.top.value.setHex(m.sky[0]); su.mid.value.setHex(m.sky[1]); su.low.value.setHex(m.sky[2]); }
}
