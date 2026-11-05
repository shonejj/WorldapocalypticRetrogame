# Anime.js v4 (verified against animejs@4.5.0)

Docs: https://animejs.com/documentation (not reachable from the cloud sandbox; this
file was built from the shipped `.d.ts` files and runtime tests).
**v4 is NOT v3.** There is no default export and no `anime({...})`.

## Imports

```js
import { animate, createTimeline, stagger, spring, createTimer, createAnimatable,
         createDraggable, createScope, onScroll, engine, utils, svg, eases } from 'animejs';
import 'animejs/adapters/three';   // REQUIRED once, to animate THREE objects (see below)
```
Sub-path exports exist for tree-shaking: `animejs/animation`, `/timeline`, `/timer`,
`/animatable`, `/draggable`, `/scope`, `/engine`, `/easings`, `/utils`, `/svg`,
`/text`, `/waapi`, `/events`, `/layout`, `/adapters/three`.
CDN/no-build: `bundles/anime.esm.min.js` (ESM) or `anime.umd.min.js` (global `anime`).
Pin an exact version in importmaps.

## Core API

```js
// Tween anything: DOM, CSS vars, SVG, plain objects, Three objects
const a = animate(target, {
  x: 320, y: { from: 0, to: 100 }, rotate: { from: -180 },
  duration: 800, delay: stagger(65, { from: 'center' }),
  ease: 'outQuad',            // string eases: in/out/inOut + Quad Cubic Quart Quint Sine Circ Expo Bounce Back Elastic
  loop: true, alternate: true, // also loopDelay, playbackEase
  composition: 'blend',        // none | replace | blend  (how overlapping tweens combine)
  modifier: v => Math.round(v),
  onUpdate: self => {}, onComplete: self => {}, autoplay: true,
});
a.pause(); a.play(); a.reverse(); a.restart(); a.seek(ms); a.cancel(); a.revert();
// keyframes
animate(obj, { x: [{ to: 1, duration: 40 }, { to: -1, duration: 40 }, { to: 0, duration: 40 }] });
// from/to array shorthand
animate(obj, { opacity: [0, 1] });
```

Timeline:
```js
const tl = createTimeline({ defaults: { duration: 400, ease: 'outExpo' }, autoplay: false })
  .add(obj, { x: 100 })               // sequential
  .add(obj, { y: 50 }, '-=200')       // relative position; also absolute ms or a label
  .label('boom')
  .call(() => spawnDebris(), 'boom')  // callback at a time
  .set(obj, { alpha: 1 }, 'boom')
  .sync(otherAnim);
```
Other: `createTimer({duration, loop, onUpdate})` (clock-synced timing, no targets),
`createAnimatable(target, {x: 500, ease:'out(3)'})` then call `ca.x(value)` every frame
for smooth *follow* (cursor/camera-follow, health-bar chase), `stagger(n, {from, grid, axis, ease})`,
`utils.random/randomPick/shuffle/clamp/lerp/damp/mapRange/snap/wrap`, `svg.createDrawable`,
`svg.morphTo`, `svg.createMotionPath`, `splitText`/`scrambleText` (HUD text),
`onScroll` (scroll-linked), `createDraggable` (inventory/UI), `createScope` (group
animations for cleanup: `scope.revert()`), `waapi.animate` (WAAPI-backed for DOM UI).

Springs: use `spring({ stiffness, damping, mass })` as an ease
(`createSpring` still works but logs a deprecation warning).

## Using Anime.js with Three.js (the important part)

After `import 'animejs/adapters/three'`, `animate()` accepts `Object3D`s, materials,
lights, cameras, fog. (Without that import it throws `str.includes is not a function`;
we hit this in testing.) Property names are *flat* aliases:

| Anime prop | Maps to | Notes |
|---|---|---|
| `x` `y` `z` | `position.x/y/z` | |
| `rotateX/Y/Z` | `rotation.x/y/z` | **degrees**, not radians |
| `scale`, `scaleX/Y/Z` | `scale.*` | auto-toggles `visible` at 0 |
| `opacity` | `material.opacity` | set `material.transparent = true` first |
| `color`, `groundColor`, `background` | material/light/scene colour | |
| `visible` | `visible` | |
| `skewX/Y/Z`, `transformOrigin` | matrix patch | |

You can also tween vectors/plain props directly: `animate(mesh.position, { y: 3 })`,
`animate(material, { emissiveIntensity: 0 })`, `animate(cam, { zoom: 1.5, onUpdate: () => cam.updateProjectionMatrix() })`.
Camera zoom/fov changes need `updateProjectionMatrix()` in `onUpdate`.

Verified snippet:
```js
animate(mesh, { x: 5, rotateZ: 90, opacity: 0.5, duration: 1000, ease: 'outQuad' });
```

### Render loop integration
Anime.js runs its own rAF loop by default; that is fine because it only mutates
properties and Three renders afterwards in *your* loop. If you want one clock:
```js
engine.useDefaultMainLoop = false;       // you drive it
function frame(t) { engine.update(); /* physics, render */ requestAnimationFrame(frame); }
```
Global controls: `engine.pause()/resume()`, `engine.speed` (slow-mo hit-stop: set
0.1 for 80 ms then restore), `engine.pauseOnDocumentHidden`, `engine.defaults`
(set global `ease`, `duration` once), `engine.timeUnit = 's'` if you prefer seconds.
Headless test: `engine.useDefaultMainLoop = false; anim.seek(ms)`.

## Game-feel recipes (Anime.js side)

```js
// Camera shake (orthographic): decaying keyframes on a *rig* group, not the follow target
const shake = (rig, a = .25) => animate(rig.position, {
  x: [{ to: a, duration: 30 }, { to: -a, duration: 30 }, { to: a/2, duration: 30 }, { to: 0, duration: 60 }],
  y: [{ to: -a, duration: 30 }, { to: a, duration: 30 }, { to: 0, duration: 90 }],
  composition: 'blend' });

// Hit flash: tween a material uniform/emissive (don't swap materials)
animate(mat, { emissiveIntensity: [2, 0], duration: 120, ease: 'outQuad' });

// Squash & stretch on a visual child group (physics body untouched)
createTimeline().add(visual.scale, { x: 1.25, y: .75, duration: 60 }).add(visual.scale, { x: 1, y: 1, duration: 200, ease: spring({stiffness:300,damping:12}) });

// Pickup bob / idle loops
animate(item.visual.position, { y: '+=0.15', alternate: true, loop: true, duration: 700, ease: 'inOutSine' });

// Spawn pops with stagger
animate(group.children, { scale: [0, 1], delay: stagger(40), ease: 'outBack' });

// Smooth chase (health bar, camera lead)
const cam = createAnimatable(rig.position, { x: 400, y: 400, ease: 'out(3)' });  // per frame: cam.x(player.x); cam.y(player.y);

// Hit-stop
engine.speed = 0.05; setTimeout(() => engine.speed = 1, 70);  // also freeze physics accumulator
```

## HUD / menus (DOM)
Use Anime.js on DOM for title screens, damage numbers, dialogue, `splitText` +
`stagger` typewriter, `scrambleText` for glitchy terminal text, `svg.createDrawable`
for radar sweeps, `createDraggable` for inventory. Keep the DOM overlay above the canvas.

## Gotchas
- v3 snippets from the web (`anime({targets: ...})`, `anime.timeline`) are wrong for v4.
- Don't tween properties physics also writes (rule 1).
- Many overlapping tweens on the same prop: use `composition: 'blend'`, or cancel first.
- Create anims inside a `createScope()` per level/screen and `.revert()` on exit to avoid leaks.
- `rotate*` is degrees on Object3D; Planck angles are radians; convert at the boundary.
- When the tab is hidden Anime pauses (`pauseOnDocumentHidden`); physics must pause too.
