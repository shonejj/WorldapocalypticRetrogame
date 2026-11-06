# Asset pipeline — painted art → game

All game art is painted (AI-generated) source material in `assets-src/`, processed by
build scripts into optimised files in `public/assets/` (committed, so CI only runs Vite).

```
assets-src/layers/*.png            9 parallax layers, 2172×724 (100 px = 1 m, walk line = row 632)
assets-src/video/reed_anim.mp4     Reed animation video (flat grey background)
assets-src/characters/reed/        frames extracted from the video (git-ignored, regenerate)
assets-src/characters/reed_sample/ original 8+8 idle/walk frames (infected base)
        │  npm run assets:extract   (needs ffmpeg: video → keyed, normalised PNG frames)
        │  npm run assets           (needs nothing but node + sharp)
        ▼
public/assets/layers/*.webp        alpha-cleaned layers; store sign repainted from WORLD_NAMES.storeName
public/assets/chars/<id>.webp      animation atlas (idle, walk, run, draw, aim, aimWalk)
public/assets/chars/<id>_parts.webp  cut-out limbs for the physics ragdoll
public/assets/chars/<id>_portrait.webp HUD portrait
src/game/assetManifest.json        frame grid, muzzle points, ragdoll joints (read by the game)
```

Changing the store name in `src/config/game.ts` requires `npm run assets` (the sign is repainted into the layer).

## The world is kit-bashed
`src/game/levels/kit.ts` names rectangles of the layer images (store, lamp, billboard,
radio shack, apartment blocks, overpass, bus, truck, sedan, wreck, props, foreground plants…).
Levels (`src/game/levels/chapter1.ts`) place those pieces along the street at three depths
(`street` with parallax, `curb` on the walk line, `fg` foreground silhouettes). Lights listed
on a piece (lamps, shop windows) become real scene lights for characters and props.

## Adding a character (recommended: generate a video like Reed's)
1. Generate a 10 s side-view animation on a **flat mid-grey background** (#4a4a4a), character
   facing **right**, same framing/scale as `reed_anim.mp4`, in this order: idle → run → walk →
   draw weapon → aim → fire. No camera motion, no ground shadow, no text/logos.
2. Put it in `assets-src/video/<id>.mp4`, find the frame ranges (contact sheet), and add them to
   `ANIMS` in `scripts/extract-video.mjs` (or make it per-character).
3. `node scripts/extract-video.mjs assets-src/video/<id>.mp4 <id>` then point the character in
   `scripts/characters.mjs` (`CHARACTERS`) at its own frames instead of Reed's, and `npm run assets`.

Until then Maya, Miller and Iris are **recoloured Reed** sprites with painted overlays (mask,
cap, hair, headphones), and the infected are Reed's original frames re-posed (reaching arms,
hunched, pale skin, blood). They work in-game but are placeholders for dedicated art.

## Prompts for the next art batch (same style as the existing layers)
- **Maya (medic)**: woman, 20s, dark ponytail, maroon hoodie + utility vest, medic pouch, red backpack, pistol.
- **Miller (mechanic)**: man, 60s, grey beard, olive cap, khaki work jacket, pump shotgun.
- **Iris (signalist)**: young woman, long black hair, headphones round neck, navy jacket, khaki cargo pants, radio on backpack, hunting rifle.
- **Infected common / runner / brute**: pale grey-green skin, torn clothes, hunched shamble; runner thin and fast; brute huge and bloated. Animations: idle sway, shamble walk, lunge attack, death fall.
- **Next locations** (9 layers each, 2172×724, same layer order and walk line): The Camp safehouse, Underground Transit, Shopping Complex, Forest Highway, Industrial Sector.
