# Ragdolls & 2D physics (Planck.js default)

Verified: `planck@1.5.1` ragdoll below ran headlessly in Node (6 bodies, 4 joints,
settled on the floor). Planck = JS port of Box2D (MIT). Docs/testbed: https://github.com/piqnt/planck.js
Y is up. Units metres/seconds/radians. Keep bodies 0.1-10 m; 1 unit = 1 m.

## Open-source options compared

| Lib | Licence | Notes for ragdolls |
|---|---|---|
| **Planck.js** | MIT | Full Box2D joint set (revolute+limits+motors, weld, rope, distance, wheel...), no async init, stable stacking. Recommended. |
| Rapier 2D (`@dimforge/rapier2d-compat`) | Apache-2.0 | WASM, very fast, revolute/spring joints with limits; `await RAPIER.init()` first; dispose/`free()` objects. Use if body count is high. |
| Matter.js | MIT | Constraints are soft (springy), no real angle limits; limbs may stretch/jitter. OK for jokey physics, not great for believable ragdolls. |
| Box2D-wasm / box2d3 ports | MIT-ish | Option if you need official Box2D; heavier setup. |
(3D ragdolls, if ever needed: Rapier3D or cannon-es, with `three/addons/physics/` helpers.)

## Tested ragdoll (Planck)

```js
import * as planck from 'planck';
const world = new planck.World({ gravity: { x: 0, y: -20 } });   // 2x real g feels better in games
const ground = world.createBody();
ground.createFixture(new planck.Edge({x:-50,y:0},{x:50,y:0}), { friction: 0.8 });

// negative filterGroupIndex => fixtures in the same group NEVER collide with each other,
// so limbs don't fight their own joints. Give each ragdoll a unique negative group.
function part(x, y, w, h, group) {
  const b = world.createDynamicBody({ position: { x, y }, linearDamping: 0.1, angularDamping: 0.3 });
  b.createFixture(new planck.Box(w/2, h/2), { density: 1, friction: 0.6, restitution: 0.05, filterGroupIndex: group });
  return b;
}
function joint(a, b, anchor, lo, hi) {   // revolute with angle limits (radians), world-space anchor
  return world.createJoint(new planck.RevoluteJoint({ enableLimit: true, lowerAngle: lo, upperAngle: hi }, a, b, anchor));
}
function ragdoll(x, y, group = -1) {
  const torso = part(x, y, .5, .8, group),      head = part(x, y+.7, .4, .4, group);
  const arm   = part(x-.45, y+.2, .2, .6, group), legL = part(x-.12, y-.8, .22, .8, group), legR = part(x+.12, y-.8, .22, .8, group);
  const joints = [
    joint(torso, head, { x, y: y+.45 },        -.5,  .5),   // neck
    joint(torso, arm,  { x: x-.3, y: y+.35 },  -2,   2),    // shoulder
    joint(torso, legL, { x: x-.12, y: y-.4 },  -.2,  1.5),  // hip
    joint(torso, legR, { x: x+.12, y: y-.4 },  -.2,  1.5),
  ];
  return { parts: { torso, head, arm, legL, legR }, joints };
}
// per fixed step: world.step(1/60, 8, 3);  (velocity iters, position iters)
```

### Sync to Three (cutout rig)
```js
for (const [name, body] of Object.entries(rag.parts)) {
  const p = body.getPosition();
  pivots[name].position.set(p.x, p.y, 0);
  pivots[name].rotation.z = body.getAngle();   // radians (Three .rotation is radians; Anime rotateZ is degrees)
}
```

## Design rules

- **Anatomy:** torso, head, upper+lower arms, upper+lower legs (add feet/hands if art needs). Hip/shoulder/elbow/knee/neck = revolute joints.
- **Limits** (radians; starting guesses, NOT verified, tune by dropping the ragdoll): neck ±0.5 and hip -0.2..1.5 are what the tested code uses; shoulder about ±2; elbow/knee are one-way hinges, so the sign depends on which way your character faces and joint body order (A->B). Wrong-way limits make limbs snap.
- **Mass:** torso heaviest (density 1), limbs 0.5-0.7, head 0.8. Avoid >10:1 mass ratios on a joint.
- **Stability:** add small `angularDamping` (0.2-0.5), `linearDamping` 0.05-0.2; raise iterations to (10,4) for long chains; use `bullet:true` only on fast thin bodies (projectiles). Make limbs overlap slightly at joints.
- **Standing "active ragdoll":** keep the live character as a kinematic/controller capsule; on death *spawn* the ragdoll at the same pose, inheriting velocity: `body.setLinearVelocity(vel)` on each part, plus an impulse at the hit point: `body.applyLinearImpulse(dir.mul(power), hitPoint, true)`.
- **Motors for hit reactions / flailing:** `RevoluteJoint({ enableMotor:true, motorSpeed, maxMotorTorque })`; ramp torque down to 0 over ~300 ms (Anime.js can tween a plain object whose value you copy to `joint.setMaxMotorTorque`) to blend from stiff -> limp.
- **Dismemberment:** `world.destroyJoint(j)` on a limb joint (do it *outside* the step / in a post-step queue); spawn blood/gib FX; the detached limb stays a normal body. Note: destroy during `world.step` callbacks is unsafe, queue it.
- **Collision filtering:** categories/masks: `filterCategoryBits`, `filterMaskBits`; ragdolls collide with ground+props but not each other if you like (distinct masks), and not with the player.
- **Sensors** (`isSensor:true`) for pickups/triggers/hurt-boxes; use `world.on('begin-contact', c => ...)` and defer logic.
- **Pooling & cleanup:** cap live ragdolls (e.g. 12); oldest -> fade with Anime.js (`opacity`, then `world.destroyBody` for each part and dispose meshes). Sleep settled bodies (`allowSleep` true by default) to save CPU.
- **Determinism / netcode:** fixed step, same iteration counts, no `Math.random` in physics (use `utils.createSeededRandom`).
- **Debug draw:** render fixture outlines with `THREE.LineSegments`/`Line` toggled by a key; invaluable for tuning joints.

## Rapier 2D sketch (if you switch)
```js
import RAPIER from '@dimforge/rapier2d-compat';
await RAPIER.init();                                   // async, once
const world = new RAPIER.World({ x: 0, y: -20 });
const a = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 5));
world.createCollider(RAPIER.ColliderDesc.cuboid(.25, .4).setCollisionGroups(0x0002ffff), a);
const j = world.createImpulseJoint(RAPIER.JointData.revolute({x:0,y:.4},{x:0,y:-.2}), a, b, true);
j.setLimits(-0.5, 0.5);
world.step();   // set world.timestep = 1/60 first
```
Verified: package imports and `init()` works in Node; joint types include
Revolute/Fixed/Spring/Rope. Collision-group bitfield = membership (high 16 bits) | filter (low 16 bits).

## Matter.js sketch
`Matter.Constraint.create({ bodyA, bodyB, pointA, pointB, stiffness: 0.9, length: 0 })`;
use `Body.nextGroup(true)` for a negative collision group per ragdoll. No angle limits;
emulate with extra stiff constraints between limb ends.

## Free ragdoll-adjacent references
- Planck's npm package ships `testbed/` samples (Bridge, Breakable, etc.; there is no ragdoll sample, so use the tested code above) and `docs/pages/joint.md` for joint reference.
- Rapier docs "joints" + the `rapier.js` testbed demos (Apache-2.0).
- Three.js examples: `physics_rapier_*`, `three/examples/jsm/physics/RapierPhysics.js` (3D ragdoll-capable).
Check each repo's licence before copying code, not just reading it.
