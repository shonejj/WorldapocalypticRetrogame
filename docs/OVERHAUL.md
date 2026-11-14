# Overhaul plan — from tech demo to a game

Audit of v0.2 (played end to end, screenshots at 1280×720) and the plan to fix it.
References: *Long Gone* / *Replaced* (fog, silhouettes, letterboxed pixel art), a cozy candle-lit
safe room, *The Last of Us* (stealth, scarcity, people), *Left 4 Dead* (special infected, hordes).

## What was wrong

| # | Problem (as played) | Cause |
|---|---|---|
| 1 | Murky, noisy picture; characters are black mannequins; you cannot see faces | night grade + film grain on a 360-row image; no fill light; no portraits anywhere |
| 2 | No story: four lines on a black screen, then subtitles that scroll by while you fight | no cutscenes, no conversation UI, dialogue never pauses the game |
| 3 | One 5-minute level, no ending | a single `LevelDef`, completion hard-wired to the relay |
| 4 | Interiors: an empty box floating in a void, no enemies, the avatar walks through the edge | separate isometric mini-mode with its own movement and no combat |
| 5 | No boss worth the name, nothing to work toward | brute is a bigger zombie; no boss bar, phases or upgrades |
| 6 | HUD clutter: five panels, labels on top of the scene, choices drawn over combat | every system got its own always-on panel |
| 7 | One drone for music, no themes | adaptive layers exist but there is no melody or per-place identity |

## Plan and checklist

Engine stays three.js + TypeScript (the repo ships as an offline PWA on GitHub Pages; a Unity
rewrite would throw away every system and the deploy pipeline). The work is direction and content.

### M1 — Look and feel
- [x] Mood system: per-place palette (fog, sky, light, grade, weather) — rain night, fog dawn, dusk, cold lab, warm candle-lit rooms
- [x] Layered fog sheets + silhouette depth layers (bare trees, pylons, billboards) like the reference
- [x] Readable characters: stronger rim/fill, no film grain, cleaner pixel pass
- [x] Cinematic letterbox during story moments
- [x] HUD pass: smaller, quieter, nothing over the action

### M2 — Story presentation
- [x] Storyboard cutscenes: hand-authored pixel-art panels with captions (prologue, chapter cards, interludes, endings)
- [x] Conversation UI: speaker portraits (rendered from the real character models), typewriter, press to advance, choices in the box; the world waits
- [x] Barks stay as subtitles during play

### M3 — Places
- [x] Interiors rebuilt as side-on cut-away rooms in the same simulation: the whole squad enters, infected live inside, same stealth and combat
- [x] Lore notes readable in a proper note view; collected notes matter for the ending

### M4 — Campaign
- [x] Chapter 1 — Market Street (rain, night) — tuned
- [x] Safehouse scenes between chapters: talk to the squad (backstory), upgrade, rest
- [x] Chapter 2 — The Long Road (fog, dawn): highway, gas station, motel, quarantine checkpoint; boss: the Warden
- [x] Chapter 3 — Genova Labs (dusk → cold interior); final boss: the Host (three phases)
- [x] Three endings incl. a true ending earned through trust and the research notes
- [x] Campaign saves: chapter, stash, party, upgrades and story state carry over

### M5 — Depth
- [x] Boss health bar, telegraphed attacks, phases
- [x] Upgrades bought with scrap: weapons (damage, magazine, suppressor) and squad (pack, health, medicine)
- [x] Chapter results screen

### M6 — Sound
- [x] Themes: title, street, road, lab, safehouse, boss, ending — on the existing adaptive layers
- [x] Ambience per mood (rain, wind, room tone, fire crackle)

### M7 — Quality
- [x] Automated playthrough bot (Playwright) through every chapter; zero console errors
- [x] `npm run check` green; docs and asset manifest updated

### M8 — v0.4: Long Gone direction, stability (second feedback round)
Reference: *Long Gone* (Hillfort Games) — the street is 2.5D pixel platforming, the houses are fully 3D and
(relatively) safe; inspect and search what people left behind. Feedback: PC browser crashes, enemies stand or lie
still, wants third-person areas inside buildings, minigames, more camera variety, less text.
- [x] Root cause of frozen infected: memory `Sequence` guards never re-checked → `When` guard node
- [x] PC stability: audio beat backlog after a background tab (could schedule thousands of nodes), audio suspends when hidden, WebGL context-loss recovery, half-res PBR maps, one shadow map, per-level textures freed
- [x] Fully 3D houses, third person over the shoulder: floor plans, flashlight, hinged doors, infected that path through rooms, hitscan + shove, searching (one per chapter: apartment, farmhouse, staff quarters)
- [x] Minigames: lockpick, breaker puzzle, radio tuning
- [x] Camera variety on the street: isometric stretches and flat long-lens silhouette sections (per beat)
- [x] Enemy idle life on the street: feeders hunch over bodies, idlers shuffle and turn, wanderers roam, half the sleepers replaced by feeders

### M9 — third feedback round: critique and redesign
Critique (as played): everyone looked like the same person in a black suit; infected were grey humans; rooms
felt like dioramas (sleepers and feeders never reacted to the squad walking in); the 3D houses were grey
boxes; the intro was abstract colour blocks you could not read; "Continue" showed with no save; the chapter 2
fuel could be silently left behind by a full pack. Free asset research: the only free animated zombies reachable
from this build environment (Quaternius via an npm CC0 mirror) are chibi/cartoon and would break the tone, so
the existing realistic CC0 Quaternius bodies are kept and redesigned in code.
- [x] Four distinct survivor silhouettes (hood + chest rig / medic vest + cross bag / long coat + goggles / antenna + scarf)
- [x] Infected: veined, bruised, bloodied skin; filthy rags; fungal plates from heads and backs; hunch and lurch
- [x] Pixel outline pass (one art pixel, from depth edges) for sprite-like figures
- [x] Chapter openings filmed in-engine over the live level (letterbox, cuts, big captions), skippable
- [x] Houses dressed (wallpaper, wainscot, frames, rugs, debris, plants, light shafts, dust); warmer light
- [x] Rooms react to the door; Continue only with a save; key items always fit; second fuel can at the pumps
- [ ] Hand-drawn sprite characters (would need an artist or a reachable CC0 sprite source)
- [ ] Real-device performance pass (only measured in software rendering here)

## Status (v0.3.0)
Everything above is implemented and verified by `npm run check` and the headless campaign run. Still open, in order of value:
hand-drawn sprite characters (the cast is still 3D models through the pixel pass), per-chapter enemy variants, a dodge move,
recorded audio, multiplayer.
