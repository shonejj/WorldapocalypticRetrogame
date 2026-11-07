/**
 * Kit pieces cut (by UV rectangle) out of the painted layer images in
 * public/assets/layers. Rect = [x0, y0, x1, y1] in source pixels (2172×724 images,
 * 100 px = 1 m for layers 04/05/06; layer-03 pieces are scaled up to street size).
 * `ground` is the pixel row that sits on the walk line (y = 0).
 * Lights are in piece pixels (relative to rect top-left) and light the scene.
 */
export type LayerFile =
  | '01_distant_skyline' | '02_distant_city_architecture' | '03_mid_distance_structures' | '04_main_street_storefronts'
  | '05_abandoned_vehicles_props' | '06_playable_ground' | '07_vegetation' | '08_foreground_depth' | '09_extreme_foreground';

export interface KitLight { x: number; y: number; color: string; radius: number; intensity: number; flicker?: boolean; glow?: number }
export interface KitPiece { layer: LayerFile; rect: [number, number, number, number]; ground: number; scale?: number; lights?: KitLight[] }

export const PX_PER_M = 100;

export const KIT: Record<string, KitPiece> = {
  // ---- street fronts (layer 04)
  store: { layer: '04_main_street_storefronts', rect: [8, 0, 935, 700], ground: 632, lights: [
    { x: 400, y: 545, color: '#ffb25e', radius: 4.6, intensity: 1.25, glow: 3.4 },          // lit shop interior
    { x: 395, y: 462, color: '#ffd9a0', radius: 2.6, intensity: 0.9, glow: 1.2, flicker: true },
  ] },
  vanFence: { layer: '04_main_street_storefronts', rect: [930, 300, 1100, 700], ground: 632 },
  lamp: { layer: '04_main_street_storefronts', rect: [1095, 330, 1215, 700], ground: 632, lights: [
    { x: 55, y: 22, color: '#ffe2a8', radius: 6.5, intensity: 1.35, glow: 2.6 },
  ] },
  billboard: { layer: '04_main_street_storefronts', rect: [1212, 190, 1602, 700], ground: 632, lights: [
    { x: 128, y: 50, color: '#ffd59a', radius: 2.8, intensity: 0.6, glow: 1.1 },
    { x: 238, y: 24, color: '#ffd59a', radius: 2.8, intensity: 0.6, glow: 1.1, flicker: true },
  ] },
  relay: { layer: '04_main_street_storefronts', rect: [1598, 150, 2165, 700], ground: 632, lights: [
    { x: 117, y: 370, color: '#ffc77a', radius: 3.6, intensity: 1.1, glow: 1.3 },
  ] },
  // ---- larger buildings / overpass (layer 03, scaled to street size)
  blockA: { layer: '03_mid_distance_structures', rect: [22, 150, 445, 640], ground: 628, scale: 1.75 },
  blockB: { layer: '03_mid_distance_structures', rect: [688, 185, 1112, 640], ground: 628, scale: 1.75 },
  overpass: { layer: '03_mid_distance_structures', rect: [1108, 270, 2162, 640], ground: 628, scale: 1.75, lights: [
    { x: 216, y: 52, color: '#ffd59a', radius: 4, intensity: 0.5, glow: 1.6 },
    { x: 618, y: 20, color: '#ffd59a', radius: 4, intensity: 0.5, glow: 1.6 },
  ] },
  // ---- vehicles & big props (layer 05)
  bus: { layer: '05_abandoned_vehicles_props', rect: [28, 290, 798, 592], ground: 584 },
  sedan: { layer: '05_abandoned_vehicles_props', rect: [895, 425, 1195, 592], ground: 584 },
  truck: { layer: '05_abandoned_vehicles_props', rect: [1180, 290, 1800, 592], ground: 584 },
  wreck: { layer: '05_abandoned_vehicles_props', rect: [1798, 430, 2148, 592], ground: 584 },
  barrier: { layer: '05_abandoned_vehicles_props', rect: [338, 510, 472, 582], ground: 578 },
  // ---- small physics props (layer 05)
  barrel: { layer: '05_abandoned_vehicles_props', rect: [1196, 476, 1268, 582], ground: 580 },
  crates: { layer: '05_abandoned_vehicles_props', rect: [798, 494, 898, 580], ground: 578 },
  cone: { layer: '05_abandoned_vehicles_props', rect: [1000, 503, 1066, 580], ground: 578 },
  // ---- extreme foreground (layer 09) — framing silhouettes, kept low
  fgPlants: { layer: '09_extreme_foreground', rect: [0, 400, 640, 655], ground: 655, scale: 0.62 },
  fgHazard: { layer: '09_extreme_foreground', rect: [1610, 340, 2172, 640], ground: 640, scale: 0.55 },
  fgLeavesL: { layer: '09_extreme_foreground', rect: [0, 0, 720, 330], ground: 330, scale: 0.7 },
  fgLeavesR: { layer: '09_extreme_foreground', rect: [1560, 0, 2172, 260], ground: 260, scale: 0.7 },
  // ---- foreground (layer 08)
  fgTreeLamp: { layer: '08_foreground_depth', rect: [0, 0, 760, 724], ground: 724, lights: [{ x: 700, y: 150, color: '#ffd38a', radius: 0, intensity: 0, glow: 2.2 }] },
  fgFence: { layer: '08_foreground_depth', rect: [1560, 260, 2172, 724], ground: 724 },
};

/** Full-width tiling bands (mirrored every other tile so they repeat seamlessly).
 *  `rect` limits a band to part of the image; `y` shifts it vertically (m). */
export interface Band { layer: LayerFile; factor: number; z: number; ground: number; lit?: boolean; dim?: number; rect?: [number, number, number, number]; scale?: number; y?: number }
export const TILED: Band[] = [
  { layer: '01_distant_skyline', factor: 0.04, z: -520, ground: 632, dim: 0.9 },
  { layer: '02_distant_city_architecture', factor: 0.14, z: -420, ground: 632, dim: 0.85 },
  { layer: '03_mid_distance_structures', factor: 0.34, z: -260, ground: 600, dim: 0.72 },
  { layer: '06_playable_ground', factor: 1, z: -1.2, ground: 632, lit: true },
  { layer: '07_vegetation', factor: 1, z: 1.5, ground: 632, lit: true, dim: 0.75, rect: [0, 585, 1440, 700], y: -0.3 },  // weeds at the feet
  { layer: '07_vegetation', factor: 1.06, z: 4, ground: 632, lit: true, dim: 0.7, rect: [180, 0, 1440, 250], y: 0.55 }, // hanging vines along the top
];
