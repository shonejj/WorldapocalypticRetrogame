# Three.js for a 2.5D side-view game (three@0.187)

Docs: https://threejs.org/docs/ (unreachable from the sandbox; content is from the
installed package + standard, stable Three.js API). Examples live in
`three/examples/jsm/*` (importmap needs `three/addons/` -> that folder).

## Setup (no-build importmap)
```html
<script type="importmap">{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/",
  "animejs": "https://cdn.jsdelivr.net/npm/animejs@4.5.0/dist/modules/index.js",
  "animejs/adapters/three": "https://cdn.jsdelivr.net/npm/animejs@4.5.0/dist/modules/adapters/three/index.js",
  "planck": "https://cdn.jsdelivr.net/npm/planck@1.5.1/dist/planck.mjs" } }</script>
```
(Anime's modules import each other via relative paths; jsdelivr serves them fine.
Verify the planck path exists for the pinned version, or use Vite + npm instead.)

## Renderer + ortho camera

```js
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
// This project: native resolution (DPR capped at 2 × user render scale) + NearestFilter
// textures at 32–64 texels/m gives "close-to-realistic pixel art". A tiny internal
// resolution (e.g. 480×270) is only for a deliberately crunchy retro mode.

const VIEW_H = 9;                            // world units visible vertically
function makeCam(aspect) {
  const c = new THREE.OrthographicCamera(-VIEW_H*aspect/2, VIEW_H*aspect/2, VIEW_H/2, -VIEW_H/2, 0.1, 100);
  c.position.z = 20; return c;              // looks down -Z
}
// zoom via camera.zoom + updateProjectionMatrix(), never by moving Z (ortho ignores Z distance)
```
Camera follow: a `rig` Group holds the camera; lerp/`createAnimatable` the rig toward
`player + lookAhead`, clamp to level bounds, shake a child of the rig.

**2.5D depth with perspective instead:** a *very narrow-FOV* PerspectiveCamera
(fov 20-30, far back) gives genuine parallax from z-offsets without moving layers
manually. Use it if you want 3D props/rotation visible; ortho + manual parallax is
simpler and pixel-exact.

## Layers (z = depth) and parallax

Convention: z=0 gameplay plane; negative = background; positive = foreground.
```
z=-40 sky      factor 0.02   |  z=-12 far ruins  0.25
z=-25 skyline  0.10          |  z=-4  near props 0.6
z= 0  gameplay 1.0           |  z=+3  fg debris  1.3 (blurred/dark)
```
Manual parallax (ortho): `layer.position.x = camX * (1 - factor)` (infinite tiling:
two or three copies, wrap by `width`). With a perspective camera just place at z.
Set `material.depthWrite=false` and use `renderOrder` for transparent sprite layers,
or sort by z automatically (transparent objects sort back-to-front).

## Sprites & characters

- Plain `Mesh(PlaneGeometry, MeshBasicMaterial({map, transparent:true, alphaTest:0.5}))`
  beats `THREE.Sprite` for 2.5D (you control rotation, can use lit materials, normal maps).
- Pixel art textures: `tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace`.
- **Atlas animation:** `tex.repeat.set(1/cols, 1/rows)`; per frame set `tex.offset.set(col/cols, 1 - (row+1)/rows)`. Clone texture per sprite *or* use per-instance UVs (below) to avoid shared-offset bugs.
- Flip facing with `mesh.scale.x = -1` (visual child group), not the physics body.
- **Cutout/skeletal characters** (what ragdolls need): each limb = its own textured
  plane parented to a pivot Group placed at the joint; sync pivot to the physics body
  (position + `rotation.z = body.getAngle()`). Same art animates when alive (Anime.js
  on pivots) and ragdolls on death (swap to physics-driven pivots).
- Many identical things (debris, bullets, tiles, particles): `InstancedMesh` +
  `setMatrixAt` + `instanceMatrix.needsUpdate = true`; per-instance colour via `setColorAt`.
  Thousands of instances = one draw call.

## Lighting & mood (cheap, big payoff for "apocalypse")
- `Fog`/`FogExp2` with ortho works on z-distance: layers fade into haze. Tween fog colour/density with Anime.js (`animate(scene.fog, { density: .04 })`).
- Use `MeshStandardMaterial`/`MeshLambertMaterial` + normal-mapped sprites with a few `PointLight`s (muzzle flash, fire, flashlight cone via `SpotLight`) for 2.5D lit pixel art. Budget: <= 4-8 dynamic lights; bake the rest into the art.
- Flicker lights with Anime.js: `animate(light, { intensity: [..], loop:true, duration: random })`.

## Post-processing (retro look)
`EffectComposer` + `RenderPass` + `OutputPass` (last). Available in addons:
`UnrealBloomPass` (fires/glow), `FilmPass` (grain/scanlines), `RenderPixelatedPass`
(auto pixelation), `HalftonePass`, `GlitchPass` (damage/EMP), `AfterimagePass`
(motion smear), `ShaderPass` (custom: CRT curvature, palette quantise, vignette),
`OutlinePass`. Keep passes <= 3-4 for mobile. Tween pass uniforms with Anime.js
(`animate(bloom, { strength: [2, .6] })`).

## Performance checklist
- Share geometries/materials; atlas textures; `InstancedMesh` for repeats.
- `renderer.info.render.calls` < ~100; triangles trivial for 2.5D.
- `object.matrixAutoUpdate = false` + `updateMatrix()` for static scenery.
- Frustum-cull by distance of level chunks; pool + `visible=false` offscreen entities.
- Dispose: `geometry.dispose(); material.dispose(); texture.dispose(); renderer.renderLists.dispose()`.
- Cap `devicePixelRatio`; low internal res is both the look and the perf win.
- Handle `resize`: update `renderer.setSize`, camera left/right/top/bottom, `updateProjectionMatrix()`.
- Handle context loss / `visibilitychange` (pause loop and physics).

## Fixed-step loop template
```js
const STEP = 1/60; let acc = 0, last = performance.now();
function frame(now) {
  acc += Math.min((now - last)/1000, 0.1); last = now;
  while (acc >= STEP) { input.update(); game.update(STEP); world.step(STEP, 8, 3); acc -= STEP; }
  sync(acc / STEP);                 // copy body transforms -> meshes (optionally interpolate)
  composer.render();                // or renderer.render(scene, camera)
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

## Loading
`GLTFLoader` (`three/addons/loaders/GLTFLoader.js`) for glTF/GLB models (3D props
or characters rendered in 2.5D); `TextureLoader` for sprites; `AudioLoader` +
`THREE.Audio` or WebAudio for sound. Wrap in a `LoadingManager` for a progress bar.
