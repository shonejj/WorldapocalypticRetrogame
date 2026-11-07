# The Last Frequency

Browser-based narrative 2.5D survival RPG (single player now; multiplayer later, planned separately).
Stack: Three.js (render) · Anime.js v4 (tweens/FX/UI) · Planck.js (2D physics/ragdolls) · Vite + TypeScript.

Rules for this repo:
- Before writing game code, use the project skill `apocalypse-25d-game-dev` (`.claude/skills/apocalypse-25d-game-dev/SKILL.md`). Anime.js is v4: no `anime()` default export; `import 'animejs/adapters/three'` before animating Three objects.
- Game title and in-world names: only in `src/config/game.ts`.
- Must work fully offline: no CDN/runtime downloads; everything bundled. The build plugin `build/pwa-plugin.ts` precaches all of `dist/`.
- Art is painted source material in `assets-src/` processed by `npm run assets` (see docs/ASSET_PIPELINE.md). The world is kit-bashed from layer images (`src/game/levels/kit.ts`); characters are sprite atlases with cut-out ragdoll parts. Lighting comes from `src/render/lighting.ts` (lit materials + scene lights).
- Every actor is driven by an `Intent` from a brain (player / companion / infected) in a fixed 60 Hz step — keep it that way (multiplayer seam).
- Before pushing: `npm run check` (typecheck, vitest, build). Deploys to GitHub Pages from `main` via `.github/workflows/deploy.yml`.
