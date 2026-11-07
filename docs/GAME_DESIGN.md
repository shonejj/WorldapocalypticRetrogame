# The Last Frequency — design notes & roadmap

## Pillars
Vulnerability over power · sound is danger · ordinary people who depend on each other · a believable remnant of a lived-in world · silence and ambience over music.

## Story (canonical)
A microscopic organism escaped from a research facility. It spreads between people and turns them into mindless, hostile humanoids; there is no cure and no return. Civilisation collapsed. A few survive — some naturally resistant, some simply never exposed. A small group discovers a repeating radio transmission from a supposedly abandoned facility: an emergency protocol, coordinates, and a hint that people are alive. With no certainty it is real, they follow it.

## The squad (v0.1)
| | Role | Gameplay | Notes |
|---|---|---|---|
| **Reed** | Scavenger (lead) | Pistol; extra loot when he searches | Resistant. Hasn't told the others. |
| **Maya** | Medic | Pistol; heals teammates under 50% with medkits | Not exposed. Keeps a notebook of patients she lost. |
| **Miller** | Mechanic | Pump shotgun; heavy melee knockback | Not exposed. Oldest; ran a garage for 30 years. |
| **Iris** | Signalist | Hunting rifle; senses infected on the radio band (HUD) | Resistant. First caught the transmission. |

Every survivor is playable (1–4 / Tab); the others are bots. None is strictly better.

## Enemies (v0.1)
- **Infected** — slow, dangerous in groups, react to movement and noise. Some lie **dormant** until you come close or make noise.
- **Runner** — fast; its scream pulls nearby infected.
- **Bloated Brute** — huge, shrugs off knockback, hits through the squad. Chapter 1 mini-boss near Relay 7.

Planned: hostile humans (cover, flanking, weapons), special infected (biologically grounded mutations only), multi-stage bosses.

## Systems status
| System | v0.1 | Next |
|---|---|---|
| Side-scrolling 2.5D, 13 parallax depth bands, fog, rain, lamp light | ✅ | weather presets, time of day |
| Painted world kit-bashed from layer art, real 2D lighting, reflections, bloom | ✅ | new locations (needs new layer sets) |
| Reed: real painted animation (idle/walk/run/draw/aim/aim-walk) | ✅ | crouch, melee, reload, hurt, death animations |
| Maya/Miller/Iris + infected | placeholder recolours of Reed | dedicated painted animations (see ASSET_PIPELINE.md) |
| Ragdolls cut from the sprite art, physics props | ✅ | dismemberment, explosive barrels |
| Stealth: sight + sound, dormant infected, takedowns | ✅ | distractions (throwables), hiding spots |
| Squad bots (follow/hold, engage, reload, medic heals) | ✅ | commands per survivor, revive downed |
| Shared stash, caches, pickups, ammo per weapon | ✅ | weight/slots, crafting, durability, food/water drain |
| Objectives, radio chatter, checkpoints + save | ✅ | dialogue trees, choices, relationships |
| Procedural audio (rain, wind, steps, guns, groans) | ✅ | surface-aware steps, positional ambience emitters |
| Offline PWA + GitHub Pages CI/CD | ✅ | — |
| Safehouse (The Camp) | — | rest, crafting bench, conversations |
| Isometric / over-the-shoulder sequences | — | later phase (same simulation, different camera) |
| Multiplayer co-op | — | planned separately (see below) |

## Chapters (draft)
1. **Market Street** — rainy night, FRESH VEGGIES, Relay 7. *(playable)*
2. **The Camp** — safehouse between expeditions.
3. **Underground Transit** — darkness, flashlights, flooded platforms.
4. **Shopping Complex** — ambushes, escalators, a scavenger gang.
5. **Forest Highway** — abandoned vehicles, hordes, rural settlement.
6. **Industrial Sector** — steam, machinery, the brute's nest.
7. **Military checkpoint → research facility** — the source of the transmission.

## Multiplayer readiness (not started — to be planned separately)
Already in place: fixed-step deterministic-friendly simulation, seeded RNG for gameplay, all actors driven by `Intent` objects from interchangeable brains, game state separate from rendering, serialisable save snapshot. GitHub Pages is static hosting, so online co-op will need either WebRTC peer-to-peer with a small signalling service, or a relay server hosted elsewhere.

## Art direction
Close-to-realistic pixel art: near-native resolution, nearest-neighbour texels, 32–64 texels per metre, cool rainy-night palette broken by warm sodium lamps and lit shop windows; overgrowth reclaiming everything. Store names and in-world text live in `src/config/game.ts` (`WORLD_NAMES`).
