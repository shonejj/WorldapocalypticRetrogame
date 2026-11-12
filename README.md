# The Last Frequency

A narrative **2.5D survival adventure** that runs entirely in the browser and keeps working with **no internet** after the first visit. A small squad of ordinary survivors follows a repeating radio transmission through a world taken by a microscopic organism — three chapters, two safehouses, three endings.

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

## The campaign
| | Place | What happens |
|---|---|---|
| Prologue | storyboard | How the city fell, and the voice on the dead band |
| Chapter 1 | **Market Street** — rain, night | Search the shops (they are not empty), craft a relay fuse, get under the overpass, wake **Relay 7** past the Brute |
| Safehouse | The Keeper's Flat | Talk to Maya, Miller and Iris; spend scrap on upgrades; sleep |
| Chapter 2 | **The Long Road** — dawn fog | Diner, gas station, motel, the pile-up; kill **the Warden** and fuel the quarantine gate |
| Safehouse | The Barracks | The squad's secrets come out — or don't |
| Chapter 3 | **Genova Labs** — dusk, then emergency power | Read Dr. Hale's journals, face **the Host**, open the broadcast room |
| Endings | storyboard | *The Cost*, *Silence*, and a true ending earned by trust and by finding all three research notes |

Doors lead into cut-away rooms where the whole squad follows you and the same stealth and combat rules apply. Bosses shrug off most damage until a charge leaves them exposed: run when they roar, shoot when they hit the wall. Conversations pause the world, show who is speaking, and their choices carry through the save.

## Develop
```bash
npm install
```
```bash
npm run dev       # http://localhost:5173  (window.__game exposed in dev)
```
```bash
npm run check     # typecheck + unit tests + production build
```
```bash
node tests/e2e/campaign.cjs   # with `npm run dev` running: plays the whole campaign headless and fails on any error
```

## Built with
**three.js** (3D world, PBR, shadows, post-processing) · **Planck.js** (2D physics in the gameplay plane, ragdolls, props, thrown lures) · **Anime.js v4** (UI and HUD motion) · **inkjs** (Ink narrative, compiled at build time) · **Vite + TypeScript**. No runtime downloads; world art, cutscene paintings, portraits and all audio are authored in code.

How it is structured, and which game-dev skill drove each part: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Art direction and asset manifest: [docs/ART_DIRECTION.md](docs/ART_DIRECTION.md), [docs/asset-manifest.json](docs/asset-manifest.json). Design and roadmap: [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md). The v0.3 overhaul audit and checklist: [docs/OVERHAUL.md](docs/OVERHAUL.md).

## Deploy (GitHub Pages)
`.github/workflows/deploy.yml` runs `npm run check` and deploys `dist/` on every push to `main`. One-time repo setting: **Settings → Pages → Source: GitHub Actions**. Relative URLs make it work under `/<repo>/`.

## License
MIT — see [LICENSE](LICENSE).

### Third-party assets
- Characters: **Modular Character Outfits**, **Universal Base Characters** (faces, hair) and **Universal Animation Library** by [Quaternius](https://quaternius.com) — CC0 1.0 (`public/models/chars/LICENSE-*.txt`). Thank you, Quaternius.
- Props (boxes, crates, barrel, jerrycan, trash bag, tyres, road barrier, AC unit, power box, generator, hanging lamp, covered car): [Poly Haven](https://polyhaven.com) photo-scans — CC0. Guns: Quaternius — CC0. Every file with its author and source: `public/models/LICENSES-CC0.csv`.
