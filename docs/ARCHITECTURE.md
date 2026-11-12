# Architecture — and the skill behind each part

Rebuilt from scratch in v0.2 using the vendored game-dev skills (`.claude/skills/`, picked by `router`).

```
src/config/game.ts        title + in-world names (single source of truth)
src/main.ts               App: campaign flow (storyboard → level → results → next), frame loop (setAnimationLoop + THREE.Timer), conversations/barks, adaptive quality
src/core/                 clock (fixed 60 Hz + hit-stop), input (actions/bindings/buffer/deadzone/rebind),
                          audio (buses in dB, ducking, adaptive music, SFX variation), storage (atomic writes, migrations), events, math
src/ai/                   bt.ts (behavior-tree runtime), utility.ts (curves, compensated scoring, hysteresis)
src/game/                 actor (shared Intent-driven rules), brains (player / squad utility AI / infected BT + perception),
                          rig (FK + procedural animation), data (items, weapons, survivors, infected, recipes), inventory (atomic crafting),
                          save (versioned schema), dialogue (inkjs runner), worldBuilder, game (simulation, combat, noise, needs, beats)
src/game/campaign.ts      play order: chapters with a safehouse between them
src/game/levels/          chapter1–3.ts, camps.ts — beats, rooms, gating, encounters, goals (data)
src/story/story.ink       the whole campaign in Ink (bark_* knots are subtitles; the rest are conversations), compiled by build/ink.ts
src/story/storyboards.ts  cutscene scripts: panels + captions
src/physics/              world (categories, raycast, kicks), ragdoll (from rig FK)
src/art/                  textures (procedural PBR maps), kit (merging, materials), buildings, street, props, vehicles, nature, characters, weapons,
                          rooms (cut-away interiors), sets (road / facility backdrops), panels (painted storyboards), portraits (rendered from the models)
src/render/               renderer (PBR, PMREM env, fog, composer: pixel/bloom/grade/output), mood (per-place palette), haze (fog sheets), lighting (light pool), camera (deadzone, look-ahead, trauma shake), fx, weather
src/ui/                   screens (stack + focus nav), hud (event-driven), story (cutscene, conversation, note), menus, touch, settings, style.css
build/                    offline-pwa (manifest + sw.js precache), ink (compile .ink)
tests/                    vitest: rig, ragdoll, BT/utility/perception, stash/crafting, saves, input/clock, Ink + campaign consistency; e2e/campaign.cjs plays every stage headless
```

| Skill | Where it shows up |
|---|---|
| `threejs-scene-setup` | `setAnimationLoop` + `THREE.Timer` with clamped delta; DPR as a budget + adaptive quality; resize; disposal |
| `threejs-materials-lighting` | `MeshStandardMaterial`/`MeshPhysicalMaterial` PBR with sRGB colour + linear data maps; hemisphere + moon (shadow) + key; PMREM `fromScene` IBL; ACES tone mapping; `OutputPass` last |
| `create-game-assets` | art-direction brief, asset manifest, approved visual target, families with invariant palette/light/texel density; in-engine validation captures |
| `shader-programming` | sky dome shader; colour-grade/vignette/grain/hurt pass |
| `physics-tuning` | fixed 60 Hz step with capped substeps; collision categories with both-sided masks; 2D densities; sleeping; bullet lures |
| `camera-systems` | deadzone → eased look-ahead → bounds clamp on the view → exp smoothing; shake as additive offset |
| `game-feel` | trauma² noise shake; real-time hit-stop with newest-wins restore; tiered feedback (muzzle flash + light + casing + tracer + impact + sound) |
| `game-ai` / `ai-behavior-trees-utility-ai` | infected: reactive BT + blackboard + perception service (sight × light × stance, hearing); squad: utility reasoner with response curves + hysteresis |
| `input-systems` | actions not keys; per-device bindings; edge vs held; 130 ms buffer; radial deadzone; rebinding with conflict detection; device-aware prompts; touch |
| `game-ui-ux` | screen stack; initial focus + spatial focus nav (keyboard/gamepad); event-driven HUD; safe-area insets; scalable type |
| `audio-design` | bus tree, dB from squared sliders, voice ducking, SFX pitch/gain variation, 3-layer adaptive music on a lookahead beat clock |
| `save-systems` | plain data, version + migrations, temp→verify→promote with `.bak`, corrupt-file fallback, separate autosave on checkpoints |
| `survival-crafting` / `rpg` | needs with graded consequences; weight/stack-limited stash; atomic, role-gated crafting; squad roles & traits |
| `dialogue-systems` | Ink (inkjs) compiled at build time; variables persist in saves; choices drive relationships |
| `level-design` | metrics-first layout; critical path with a crafted-item gate; sawtooth intensity beats |
| `performance-optimization` | merged static geometry per material, instanced grass/skyline/particles, fixed light pool (no shader recompiles), pooled VFX |

## Places: one simulation, many zones
A level is the street plus any number of **rooms** (`LevelDef.rooms`). Rooms are built far to the right on the same lane
(x ≥ 1000) and registered as `Zone`s; actors are clamped to the zone they stand in, so every rule — sight, noise, squad AI,
ragdolls, bosses — works indoors without a second code path. Walking through a door fades, moves the squad, and swaps the
`Mood`. A safehouse is a level that *starts* in its room. The level's `goal` (optionally inside a room, optionally guarded by
a boss or gated by an item) ends it with a conversation; `main.ts` then shows results, plays the outro storyboard and
starts the next stage with stash, party, upgrades, notes and Ink state carried in the save (v3).
