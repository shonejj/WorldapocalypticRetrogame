---
name: apocalypse-25d-game-dev
description: Build the Worldapocalyptic retro 2.5D game with Three.js (rendering), Anime.js v4 (tweens/UI/FX), and open-source 2D physics + ragdolls (Planck.js/Rapier/Matter.js). Use when writing or changing game code, scenes, characters, ragdolls, parallax environments, camera, VFX, HUD animation, or when picking free/CC0 assets.
---

# Worldapocalyptic 2.5D game development

Stack decisions and working knowledge for this repo. Versions below were checked
against the npm packages in Nov 2026 (animejs 4.5.0, three 0.187.0, planck 1.5.1,
@dimforge/rapier2d-compat 0.21.0, matter-js 0.20.0; all MIT except Rapier = Apache-2.0).

## The architecture in one paragraph

**2.5D = gameplay in 2D, presentation in 3D.** Physics and game logic run in a flat
2D world (x = right, y = up). Three.js renders that world with an
**OrthographicCamera** looking down -Z; sprites/meshes sit at different **z depths**
to form parallax layers and give real lighting, fog and depth. Anime.js animates
everything that is *not* simulated: camera shake/zoom, hit flashes, UI/HUD, title
screens, props, spawn/death effects. Ragdolls are *simulated* (physics owns them),
never tweened.

```
input -> game state -> physics step (fixed dt) -> sync to Three objects -> render
                           ^                          ^
                  Planck/Rapier owns bodies     Anime.js tweens visual-only props
```

## Ownership rules (prevents most bugs)

1. **One owner per property.** If physics moves a body, never also tween its
   `position`. Tween a child "visual" `Group` instead (squash/stretch, flash, bob).
2. **Fixed physics timestep** (1/60, accumulator, max ~5 substeps); render with the
   interpolation alpha if you need smoothness. Never step physics with raw frame dt.
3. **Y-up, meters for physics** (~1 unit = 1 m, characters ~1.8 high). Pixel-art
   scale is a *render* concern: pick a pixels-per-unit constant once (e.g. 16 or 32).
4. **Anime.js owns time for visuals; you own time for physics.** For pause/slow-mo,
   pause the physics accumulator *and* `engine.pause()` / `engine.speed` (see ref).
5. **Dispose what you create** (geometry, material, texture, render targets) when
   leaving a level; reuse via pools for bullets, gibs, particles.
6. **No allocations in the hot loop** (reuse `Vector3`, arrays; pool ragdolls).

## Which library for what

| Need | Use | Why |
|---|---|---|
| Rendering, camera, lights, sprites, post-fx | Three.js | `OrthographicCamera`, `InstancedMesh`, `EffectComposer` |
| Tweens, timelines, springs, stagger, SVG, scroll, draggable UI | Anime.js v4 | `import 'animejs/adapters/three'` lets it tween `Object3D` directly |
| Ragdolls, platformer collision | **Planck.js** (default) | Box2D port, full joint set, pure JS, no WASM/async init, deterministic, easy to debug |
| Heavy physics (hundreds of bodies, 3D later) | Rapier (`rapier2d-compat`) | WASM, fast; needs `await RAPIER.init()` |
| Quick prototypes / tiny bundle | Matter.js | Simple constraints, but weaker joint limits & stacking than Box2D |

Default to Planck for ragdolls. Only switch to Rapier if profiling shows physics is
the bottleneck.

## Workflow when adding a feature

1. Decide: simulated (physics) or authored (Anime.js)? Apply ownership rule 1.
2. Read the matching reference file below *before* coding.
3. Keep game logic independent of Three (so it can be tested in Node).
4. Verify headless where possible (`node` + Planck steps; Anime.js with
   `engine.useDefaultMainLoop = false` and `anim.seek(ms)`); verify visuals with the
   preinstalled Playwright Chromium + a screenshot.
5. Check asset licences before committing anything under `assets/` (see ref 4) and
   record them in `assets/CREDITS.md`.

## References (read as needed)

- `references/animejs-v4.md`: Anime.js v4 API, Three adapter, game-feel recipes, gotchas
- `references/threejs-25d.md`: ortho camera, parallax layers, sprites/atlases, lighting, perf, post-fx
- `references/ragdoll-physics.md`: Planck ragdoll (tested code), joints/limits, death-to-ragdoll, dismemberment, Rapier/Matter notes
- `references/environment-and-assets.md`: environment art/parallax/tilemap techniques, free CC0 asset sources, licence checklist

## Suggested project layout (when scaffolding)

```
index.html            importmap -> three, animejs, planck (or Vite)
src/main.js           bootstrap + fixed-step loop
src/core/             loop.js input.js assets.js audio.js
src/physics/          world.js ragdoll.js (no Three imports)
src/render/           camera.js parallax.js sprites.js fx.js
src/game/             player.js enemies.js levels/ ui/
assets/               + CREDITS.md
```

Prefer Vite (`npm create vite@latest`, vanilla) for dev server + bundling; a plain
importmap + static server also works for a no-build prototype.
