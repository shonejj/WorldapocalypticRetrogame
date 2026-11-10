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
- [ ] Mood system: per-place palette (fog, sky, light, grade, weather) — rain night, fog dawn, dusk, cold lab, warm candle-lit rooms
- [ ] Layered fog sheets + silhouette depth layers (bare trees, pylons, billboards) like the reference
- [ ] Readable characters: stronger rim/fill, no film grain, cleaner pixel pass
- [ ] Cinematic letterbox during story moments
- [ ] HUD pass: smaller, quieter, nothing over the action

### M2 — Story presentation
- [ ] Storyboard cutscenes: hand-authored pixel-art panels with captions (prologue, chapter cards, interludes, endings)
- [ ] Conversation UI: speaker portraits (rendered from the real character models), typewriter, press to advance, choices in the box; the world waits
- [ ] Barks stay as subtitles during play

### M3 — Places
- [ ] Interiors rebuilt as side-on cut-away rooms in the same simulation: the whole squad enters, infected live inside, same stealth and combat
- [ ] Lore notes readable in a proper note view; collected notes matter for the ending

### M4 — Campaign
- [ ] Chapter 1 — Market Street (rain, night) — tuned
- [ ] Safehouse scenes between chapters: talk to the squad (backstory), upgrade, rest
- [ ] Chapter 2 — The Long Road (fog, dawn): highway, gas station, motel, quarantine checkpoint; boss: the Warden
- [ ] Chapter 3 — Genova Labs (dusk → cold interior); final boss: the Host (three phases)
- [ ] Three endings incl. a true ending earned through trust and the research notes
- [ ] Campaign saves: chapter, stash, party, upgrades and story state carry over

### M5 — Depth
- [ ] Boss health bar, telegraphed attacks, phases
- [ ] Upgrades bought with scrap: weapons (damage, magazine, suppressor) and squad (pack, health, medicine)
- [ ] Chapter results screen

### M6 — Sound
- [ ] Themes: title, street, road, lab, safehouse, boss, ending — on the existing adaptive layers
- [ ] Ambience per mood (rain, wind, room tone, fire crackle)

### M7 — Quality
- [ ] Automated playthrough bot (Playwright) through every chapter; zero console errors
- [ ] `npm run check` green; docs and asset manifest updated
