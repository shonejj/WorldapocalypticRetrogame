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

Stack: **Three.js** (rendering), **Anime.js v4** (tweens, UI, camera shake, lamp flicker), **Planck.js** (2D physics, ragdolls), **Vite** + **TypeScript**. No runtime CDN or asset downloads — everything is bundled.

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` typechecks, tests, builds and deploys on every push to `main`.
One-time repo setting: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The build uses relative URLs (`base: './'`), so it works under `https://<user>.github.io/<repo>/` without changes.

## How it is built

- **All art is generated in code** (`src/render/art/*`) from seeded pixel painters — buildings, the FRESH VEGGIES store, vehicles, props, vegetation, sky, and every character. Nothing is downloaded, so it is offline-safe and tiny (~230 KB gzipped).
- **Characters are cut-out rigs** (`src/game/rig.ts`): 10 limb parts animated procedurally while alive and handed to a Planck ragdoll on death. A *Skin* (part → texture + pivot) is the swap point for hand-drawn art later.
- **One ruleset for everyone** (`src/game/actor.ts`): player input, squad bots and infected all produce the same `Intent` each fixed 60 Hz tick — the seam a future network layer will use.
- **Stealth through sound and sight** (`src/game/ai.ts`): infected build suspicion from what they see (distance, light, crouching, running) and walk to noises (footsteps, gunfire, impacts). Gunfire pulls the street.
- **Squad bots**: follow in formation, mirror your stance, hold fire on unaware infected, defend when hunted, reload when calm; Maya heals, Miller hits hard, Iris senses infected on the radio band, Reed scavenges extra loot.

See [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) for the design, story bible and roadmap.

## License

MIT — see [LICENSE](LICENSE).
