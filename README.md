# The Last Frequency

A narrative **2.5D survival adventure** that runs entirely in the browser and keeps working with **no internet** after the first visit. A small squad of ordinary survivors follows a repeating radio transmission through a world taken by a microscopic organism.

The title and in-world names live in one file: [`src/config/game.ts`](src/config/game.ts).

## Play
- **Online:** GitHub Pages (auto-deployed from `main`).
- **Offline:** open once; the service worker caches every file. It then loads and plays with no network, and installs to home screen / desktop.
- **Keyboard + mouse, gamepad, or touch.** Every action is rebindable (Settings → Controls).

| Action | Keyboard / mouse | Gamepad |
|---|---|---|
| Move · run | A D / ← → · Shift | Left stick / D-pad · LB / L3 |
| Crouch (sneak, toggle) | C / Ctrl | B |
| Aim & fire (loud) | J / left mouse | RT / RB |
| Melee (quiet; takedown on unaware infected) | F / K / right mouse | X |
| Throw bottle lure | T / G | LT |
| Search / interact | E / W / ↑ | A |
| Reload · heal | R · H | Y · D-pad ↑ |
| Switch survivor · squad hold/follow | 1–4 / Tab / Q · V | R3 · D-pad ↓ |
| Inventory & crafting · pause | I / B · Esc / P | View · Menu |

## Chapter 1 — Market Street
Leave the alley behind **FRESH VEGGIES**, scavenge the street, lure the infected out of the pharmacy, craft a relay fuse at the garage workbench, get through the infested overpass, and restore **Relay 7** while something enormous guards it. Choices in the conversations shape how the squad sees Reed.

## Develop
```bash
npm install
```
```bash
npm run dev       # http://localhost:5173  (window.__game exposed in dev)
```
```bash
npm run check     # typecheck + 26 unit tests + production build
```

## Built with
**three.js** (3D world, PBR, shadows, post-processing) · **Planck.js** (2D physics in the gameplay plane, ragdolls, props, thrown lures) · **Anime.js v4** (UI and HUD motion) · **inkjs** (Ink narrative, compiled at build time) · **Vite + TypeScript**. No runtime downloads; no external art or audio — everything is authored in code.

How it is structured, and which game-dev skill drove each part: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Art direction and asset manifest: [docs/ART_DIRECTION.md](docs/ART_DIRECTION.md), [docs/asset-manifest.json](docs/asset-manifest.json). Design and roadmap: [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md).

## Deploy (GitHub Pages)
`.github/workflows/deploy.yml` runs `npm run check` and deploys `dist/` on every push to `main`. One-time repo setting: **Settings → Pages → Source: GitHub Actions**. Relative URLs make it work under `/<repo>/`.

## License
MIT — see [LICENSE](LICENSE).

### Third-party assets
- Character body and animations: **Universal Animation Library** by [Quaternius](https://quaternius.com) — CC0 1.0 (`public/models/LICENSE-Quaternius-UAL-CC0.txt`). Thank you, Quaternius.
- Props (boxes, crates, barrel, jerrycan, trash bag, tyres, road barrier, AC unit, power box, generator, hanging lamp, covered car): [Poly Haven](https://polyhaven.com) photo-scans — CC0. Guns: Quaternius — CC0. Every file with its author and source: `public/models/LICENSES-CC0.csv`.
