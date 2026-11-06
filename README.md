# The Last Frequency

A narrative 2.5D survival adventure that runs entirely in the browser — and keeps running with no internet once it has loaded.
A small squad of ordinary survivors follows a repeating radio transmission through the ruins of a world taken by a microscopic organism.

> The game title lives in **one place**: [`src/config/game.ts`](src/config/game.ts). Change it there and the page title, PWA manifest, title screen and HUD all follow.

## Play

- **Online:** GitHub Pages (deployed automatically from `main`, see below).
- **Offline:** open the page once; a service worker caches every file. After that it loads and plays with no network, and can be installed to the home screen / desktop.
- **Desktop:** keyboard + mouse, or a gamepad. **Mobile:** on-screen touch controls appear automatically.

| Action | Keyboard | Gamepad |
|---|---|---|
| Move / run | A D / ← → · Shift | Left stick · LB |
| Crouch (sneak) | C / S / Ctrl | B |
| Fire (loud) | J / left mouse | RT |
| Melee (quiet; takedown on unaware infected) | K / F / right mouse | X |
| Reload · Heal | R · H | Y · D-pad ↑ |
| Search / interact | E / W / ↑ | A |
| Switch survivor | 1–4 / Tab / Q | LT |
| Squad hold / follow | G | D-pad ↓ |
| Squad & stash · Pause | I · Esc | Select · Start |

## Develop

```bash
npm install
```
```bash
npm run dev        # http://localhost:5173 (window.__game is exposed in dev for debugging)
```
```bash
npm run check      # typecheck + tests + production build
```
```bash
npm run assets     # rebuild public/assets from assets-src (after art or store-name changes)
```

Stack: **Three.js** (rendering), **Anime.js v4** (tweens, UI, camera shake, lamp flicker), **Planck.js** (2D physics, ragdolls), **Vite** + **TypeScript**. No runtime CDN or asset downloads — everything is bundled.

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` typechecks, tests, builds and deploys on every push to `main`.
One-time repo setting: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The build uses relative URLs (`base: './'`), so it works under `https://<user>.github.io/<repo>/` without changes.

## How it is built

- **Painted art, processed at build time** (`scripts/`, see [docs/ASSET_PIPELINE.md](docs/ASSET_PIPELINE.md)): the parallax layers are kit-bashed into a longer street across depth bands; Reed's animation is extracted from a video (idle, walk, run, draw, aim, aim-walk); every character gets an atlas, cut-out ragdoll limbs and a portrait. ~7.8 MB, all precached for offline play.
- **Lighting & atmosphere** (`src/render/lighting.ts`, `worldView.ts`, `renderer.ts`): lamps, shop windows and muzzle flashes are real 2D lights on characters and props; wet-street reflections, rain, mist, lightning, bloom and a film grade.
- **Ragdolls from the art** (`src/physics/spriteRagdoll.ts`): on death the sprite is swapped for its cut-out limbs on Planck bodies with neck/hip/knee joints.
- **One ruleset for everyone** (`src/game/actor.ts`): player input, squad bots and infected all produce the same `Intent` each fixed 60 Hz tick — the seam a future network layer will use.
- **Stealth through sound and sight** (`src/game/ai.ts`): infected build suspicion from what they see (distance, light, crouching, running) and walk to noises (footsteps, gunfire, impacts). Gunfire pulls the street.
- **Squad bots**: follow in formation, mirror your stance, hold fire on unaware infected, defend when hunted, reload when calm; Maya heals, Miller hits hard, Iris senses infected on the radio band, Reed scavenges extra loot.

See [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) for the design, story bible and roadmap.

## License

MIT — see [LICENSE](LICENSE).
