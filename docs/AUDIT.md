# Audit — what was broken, what was fixed, what is left

What this repo does: a single-player 2.5D survival game in the browser (three.js world, Planck physics,
Ink story), shipped as an offline PWA on GitHub Pages. Load assumed: one player per device, mid-range
phones as the weakest target.

## Fixed in this pass

1. **Mobile was unplayable.** Phones open the page in portrait; the HUD, controls and subtitles
   stacked on top of each other. Now: a rotate-to-landscape screen in portrait, and fullscreen +
   landscape lock when an expedition starts (Android; a no-op where the browser refuses).
2. **Too heavy for phones.** A test scene drew 1.28 M triangles/frame: every character (skinned
   meshes skip frustum culling) in every pass, plus a full-res pixel pass that rendered the scene twice.
   Now 0.29 M: off-screen actors are hidden and not animated, pixel art is a ~360-row render scaled up
   with nearest-neighbour CSS, the mirror is 480×270, phones default to Medium (no shadows).
3. **WebGL error every frame** ("feedback loop"): the ground sampled the reflection texture while the
   reflection was being rendered into it; some GPUs drop or corrupt those draws. The ground now reads
   a blank texture during that pass.
4. **Yellow/white "flares".** Halos and light cones were mirrored in puddles and bloomed; the mirror
   lookup ran past the edge of its image near the camera; lit windows had a point light floating in
   front of them. All three fixed (excluded from reflections, edge fade + HDR cap, lights removed).
5. **Live site broke after deploys** — GitHub's own "Deploy from a branch" job published the raw
   sources after our build. The workflow now publishes last; switching Settings → Pages → Source to
   **GitHub Actions** removes the race for good (then the 90 s wait can go).
6. **Ammo / health rules.** Story mode (default): reserve ammo never runs out, health only drops from
   attacks. Survival mode keeps scarcity, hunger, thirst and bleeding (Settings → Game).
7. **Little parallax.** Closer camera with a wider lens, trailing yaw while moving, per-area camera
   moments (garage, overpass, relay), and a near foreground layer (plants, posts, cables).
8. **Stiff, identical characters.** CC0 rigged human with 27 clips; per-survivor idle/walk, desynced
   loops, search/interact clips, ragdoll deaths on the same skeleton.
9. **Scavenging and crafting not readable.** Visible loot spots with a glint that goes out when
   searched; the garage workbench is a lit crafting station; the truck no longer hides it.
10. **Code-only props looked fake.** Poly Haven photo-scans (CC0) for crates, boxes, barrel, tyres,
    trash bags, barrier, AC units, power boxes, generator, jerrycan, covered cars; Quaternius guns.

## Still open (next passes)

- **Faces and clothing detail.** The body is a mannequin painted by region. Truly clothed/faced
  characters need CC0 character models we can reach (only GitHub/npm are reachable from the build
  environment; Kenney, Quaternius' site, poly.pizza and OpenGameArt are blocked). Upload candidates to
  the repo and they can be wired the same way.
- **Real recorded audio.** All sound is synthesised; no reachable CC0 audio pack fitted the tone yet.
- **Leak on restart.** `Game.dispose()` clears the scene but does not dispose merged geometries, so
  many retries in one session grow GPU memory. Fix: traverse and dispose geometries the level built.
- **Frame rate on real phones is unmeasured** (the build machine renders in software).
