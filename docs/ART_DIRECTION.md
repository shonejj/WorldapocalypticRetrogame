# Art direction brief — The Last Frequency (v0.2, code-authored)

Produced with the `create-game-assets` workflow. No image-generation tool and no external art are
used: **every asset is authored in code** (geometry + procedural PBR textures + lighting). The
manifest of every asset, its source module and status is `docs/asset-manifest.json`.

## Technical frame (locked)
| | |
|---|---|
| Engine | three.js r187, WebGL2, `MeshStandardMaterial`/`MeshPhysicalMaterial` PBR |
| View | 2.5D side-scroller: 3D world, gameplay on the plane z = 0, perspective camera (fov 28°) at z ≈ +17, slight downward tilt, follows x |
| World scale | 1 unit = 1 m. Adult 1.80 m. Sidewalk z ∈ [-1.4, 1.2], road z ∈ [1.2, 8], facades at z ≈ -2.4 |
| Target display | 1280×720 → 4K; DPR budget 1–1.5; optional pixel pass (2–4 px) for the "HD pixel" look |
| Textures | procedural canvas, 256–512 px, tileable; colour maps sRGB, normal/roughness linear |
| Lighting | night: hemisphere fill + moon directional (one shadow caster following the camera) + pooled point/spot lights reassigned to the nearest street lamps / windows (fixed light count → no shader recompiles) + baked PMREM environment of the street for wet reflections |
| Post | bloom (lights, muzzle flashes), colour grade (teal shadows / amber highlights), vignette, grain, optional pixelation with depth/normal edge lines |
| Budgets | ≤ 250 draw calls, ≤ 400k triangles on screen, ≤ 40 MB textures, 60 fps on integrated GPUs at DPR 1 |

## Visual system
- **Mood:** rainy night after the collapse. Silence, wet surfaces, pools of sodium light, overgrowth.
- **Shape language:** rectilinear concrete and brick blocks; broken by sagging cables and awnings,
  hanging ivy, slumped vehicles. Organic shapes = nature reclaiming; hard shapes = dead civilisation.
- **Value structure:** world sits in dark mid-tones (value 15–40%). Highlights are reserved for
  light sources, lit shop windows, wet specular streaks and the radio-cyan UI. Characters get a
  rim light so they always separate from the background.
- **Palette roles:** ambient night `#1b2a36`, fog `#22343f`, sodium lamp `#ffb45e`, shop interior
  `#ff9a4a`, radio/UI accent `#5ad1e6`, danger `#d2463a`, overgrowth olive `#55702c`→`#2f4a1f`,
  rust `#8a4a26`, concrete `#6a6e6c`, brick `#6b3f33`.
- **Materials:** concrete/plaster (rough 0.85–0.95), brick (0.9), rusted metal (0.6, metalness 0.3–0.6),
  glass (0.05), wet asphalt (roughness map 0.12–0.55 so puddles mirror light), cloth (0.95), skin (0.6).
- **Detail density:** high at the gameplay plane (props, signage, vines), lower with depth; fog
  (exp²) does the rest.
- **Characters:** grounded proportions (~7.5 heads), chunky readable silhouettes — backpack,
  headwear and weapon identify each survivor at 120 px tall. Infected: pale grey-green skin,
  torn darker clothing, hunched, slack arms; brute is 1.35× and bloated; runner is gaunt.
- **Motion character:** survivors deliberate and weighty; infected shamble with irregular rhythm;
  runners lurch; everything settles (no floaty loops).

## Approval
Visual target = the first street section (FRESH VEGGIES storefront, lamp, sedan, squad) judged at
1280×720 in-game. Families (buildings, props, vehicles, characters) reuse its palette roles,
light direction, texture density and edge treatment. Validation is done in-engine with Playwright
captures (see README → verification).
