# Environment (2.5D) techniques & free/open assets

## Building a post-apocalyptic 2.5D environment

- **Layered parallax** (see threejs-25d.md): sky gradient -> far skyline silhouettes (tinted to
  fog colour) -> mid ruins -> gameplay plane -> foreground debris/smoke. Tint far layers
  toward the haze colour instead of drawing separate "faded" art: one asset, many depths.
- **Tilemap gameplay plane:** author in Tiled (open source, GPL editor; exported JSON/TMX
  is yours). Render tiles as one `InstancedMesh` per tileset or bake chunks into a single
  merged mesh; collision from a separate Tiled object layer -> Planck `Edge`/`Chain`/`Box` fixtures
  (merge adjacent solid tiles into rects/chains to cut fixture count).
- **Depth cues:** `FogExp2`, vertical gradient planes, drifting dust (`Points` or instanced
  quads animated by Anime.js `loop:true`), light shafts as additive planes, screen-space vignette/grain.
- **Dynamic weather/time-of-day:** one `createTimeline()` driving fog colour/density,
  light colour/intensity, sky uniforms; trigger from level events (`engine`-synced).
- **Destruction/props:** crates, barrels, car wrecks as dynamic Planck bodies with a
  mesh each; breakables spawn debris from a pool (`InstancedMesh`).
- **Hazards & ambience:** flickering lights (`animate(light,{intensity})`), sparking cables,
  swaying signs: pivots tweened with `alternate:true, loop:true, ease:'inOutSine'`.
- **Pixel-consistency:** one pixels-per-unit for all art; render at low internal res with
  nearest filtering; snap camera to the pixel grid (`pos = round(pos*ppu)/ppu`) to kill shimmer.
- **Palette discipline:** 16-32 colour palette + `ShaderPass` palette quantise = instant retro cohesion.

## Free / open-source asset sources

Licence status below is from background knowledge and one web search; the cloud
sandbox could not open most of these sites. **Verify the licence on the asset's own
page before using it and record it in `assets/CREDITS.md`.**

| Source | Typical licence | Good for |
|---|---|---|
| Kenney (kenney.nl) | CC0 | Huge 2D/3D packs: platformer tiles, UI, particles, sfx, fonts |
| OpenGameArt.org | Mixed: CC0 / CC-BY / CC-BY-SA / GPL; check each item | Sprites, tilesets, music, sfx |
| itch.io (Game Assets > Free, filter by licence) | Per-asset | Post-apocalyptic pixel packs (many are "name your price", NOT automatically open) |
| Quaternius | CC0 | Low-poly 3D characters/props (glTF) |
| Poly Haven / ambientCG | CC0 | HDRIs, textures, 3D models |
| Freesound.org | Per-sound (CC0/CC-BY) | Ambience, impacts, footsteps |
| Google Fonts | OFL | Pixel/display fonts (e.g. Press Start 2P, VT323) |
| Mixamo | Free to use but **not open-source/CC0** (Adobe terms) | Rigged 3D animations; avoid if you need redistributable assets |

Found in the search (all unverified, check before use):
- "A Terra" tileset by joseluizof on itch.io: listed as CC0, post-apocalyptic pixel tileset.
- Free City Ruin Backgrounds (free-game-assets, itch.io): free parallax set; licence unclear.
- LittleSmith "post apocalyptic background": 5-layer 480x180 parallax; name-your-own-price, licence unclear.
- drxwat "City parallax": 9-layer post-Soviet city; licence unclear.
- Paid (not free): jap-q "Dystopian Platformer Tileset Pack", pixkari "Post-Apocalyptic Tileset + Props".
- An AI-generated CC0 pack exists in Summer Engine's store; avoid unless generative-AI art is acceptable to this project.

## Licence checklist
1. CC0 / public domain: use freely. 2. CC-BY: add attribution in CREDITS + in-game credits.
3. CC-BY-SA / GPL art: share-alike obligations; avoid unless the whole game can comply.
4. "Free" without a stated licence = all rights reserved; do not ship it.
5. NC (non-commercial) or ND: avoid if the game might ever be monetised.
6. Never commit paid or EULA-restricted packs to a public repo.
`assets/CREDITS.md` columns: file | author | source URL | licence | date checked.

## Making your own ragdoll-ready art
Cut each limb from the character's sprite sheet into separate PNGs with the joint
position at a known pixel (store pivot offsets in JSON next to the atlas), so the same
art drives idle/run animations (Anime.js on pivots) and the physics ragdoll.
Free tools: Aseprite (source-available, paid binary; or LibreSprite, GPL), Krita (GPL),
GIMP, Piskel (Apache-2.0, in-browser), Tiled (map editor), TexturePacker alternatives like `free-tex-packer`.
