# The Last Frequency

Browser-based narrative 2.5D survival RPG (single player; multiplayer planned separately).
Stack: three.js (3D world) · Planck.js (2D physics/ragdolls in the gameplay plane) · Anime.js v4 (UI motion) · inkjs (Ink narrative) · Vite + TypeScript.

Rules for this repo:
- Start game-dev work with the `router` skill (vendored in `.claude/skills/`, source in `.claude/skills/_vendor/`). docs/ARCHITECTURE.md maps each system to the skill it follows; keep to those patterns.
- Where a skill suggests CDN imports, external assets or engine-specific APIs, project rules win: everything is bundled (offline PWA) and all art/audio is authored in code (`src/art/*`, `src/core/audio.ts`). Record new assets in docs/asset-manifest.json.
- Game title and in-world names: only in `src/config/game.ts`.
- Every actor is driven by an `Intent` from a brain (player / squad utility AI / infected behavior tree) in a fixed 60 Hz step — keep it that way (multiplayer seam). Gameplay randomness uses `Rng`.
- Static world geometry is merged per material (`Batch`); lights go through the `LightPool` (fixed count — never add raw lights per lamp).
- Before pushing: `npm run check` (typecheck, vitest, build). Deploys to GitHub Pages from `main` via `.github/workflows/deploy.yml`.
