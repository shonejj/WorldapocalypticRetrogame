# The Last Frequency — design & roadmap

## Pillars
Vulnerability over power · sound is danger · ordinary people who depend on each other · a believable remnant of a lived-in world · silence and ambience over music.

## Story
A microscopic organism escaped from a research facility and turned most of humanity into mindless hosts. There is no cure. A few survive — some resistant, some never exposed. A small group catches a repeating radio transmission: an emergency protocol and coordinates. With no certainty it is real, they follow it.

## The squad
| | Role | Gameplay | Secret |
|---|---|---|---|
| **Reed** | Scavenger | Carbine; searches faster, finds extra supplies | Resistant. Hasn't told the others. |
| **Maya** | Medic | Pistol; heals teammates; crafts medkits | Keeps a notebook of patients she lost. |
| **Miller** | Mechanic | Pump shotgun; heavy melee knockback; crafts shells and the relay fuse | Thirty years running a garage. |
| **Iris** | Signalist | Pistol; hears infected on the radio band (HUD signal strip) | Resistant. First caught the transmission. |
All four are playable (switch any time); the rest are utility-AI teammates who follow, hold, defend, reload and heal.

## Enemies (Chapter 1)
Infected (slow, groups, sight + hearing) · dormant infected (lie still until close or loud) · runner (fast; its shriek pulls others) · Bloated Brute (huge, shrugs off knockback; mini-boss at Relay 7). Planned: hostile humans, special infected, multi-stage bosses.

## Chapter 1 beat sheet (level-design)
| Beat | Type | Intensity | Teaches / tests |
|---|---|---|---|
| Alley behind FRESH VEGGIES | teach | 0.1 | move, search, Ink choice |
| Street | teach | 0.3 | crouch + rear takedown on a lone infected |
| Pharmacy | tension | 0.45 | bottle lure vs. sleeping pair; supplies |
| Garage | rest | 0.15 | workbench crafting (fuse gate) |
| Overpass | combat | 0.75 | sneak or fight a crowd with runners |
| Breather | rest | 0.2 | heal, eat, drink, checkpoint |
| Relay 7 | climax | 1.0 | brute + restore the relay (needs fuse) |

## Campaign (v0.3)
Prologue → Ch.1 Market Street → safehouse → Ch.2 The Long Road → safehouse → Ch.3 Genova Labs → one of three endings.
Bosses: Bloated Brute, the Warden, the Host (armoured until a charge leaves them exposed; the Host calls waves at ⅔ and ⅓).
Progression: seven upgrades bought with scrap at any workbench. See docs/OVERHAUL.md.

## Status
| System | v0.2 | Next |
|---|---|---|
| Code-authored 3D world, PBR, lighting pool, rain, reflections, post | ✅ | more biomes/chapters, day/night |
| Characters on a shared rig + procedural animation + ragdolls | ✅ | more animation states (vault, climb, door) |
| Stealth: sight (light/stance), hearing, dormant, lures, takedowns | ✅ | hiding spots, more distraction tools |
| Squad utility AI; infected behavior trees | ✅ | per-member orders, revive |
| Needs, weight-limited stash, crafting, roles | ✅ | weapon wear, safehouse |
| Ink dialogue with choices & relationships | ✅ | camp conversations, personal missions |
| Saves (versioned, autosave/manual, backup) | ✅ | multiple slots UI |
| Offline PWA + Pages CI | ✅ | — |
| Isometric / over-the-shoulder sequences | — | later phase |
| Multiplayer co-op | — | planned separately (Intent-driven sim is the seam) |
