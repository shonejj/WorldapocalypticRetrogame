import './ui/style.css';
import * as THREE from 'three';
import { engine } from 'animejs';
import { GAME } from './config/game';
import { Renderer, QUALITY_PRESETS } from './render/renderer';
import { Input } from './core/input';
import { SimClock, STEP } from './core/clock';
import { audio } from './core/audio';
import { Game } from './game/game';
import { CHAPTER1 } from './game/levels/chapter1';
import { Dialogue } from './game/dialogue';
import { saveGame, latestSave, deleteSave, hasSave, type SaveData } from './game/save';
import storyJson from './story/chapter1.ink';
import { ScreenStack } from './ui/screens';
import { Hud } from './ui/hud';
import { TouchControls } from './ui/touch';
import { loadCharacterAsset } from './art/skinned';
import { loadAssets } from './art/assets';
import { loadSettings, saveSettings, type Settings } from './ui/settings';
import { titleScreen, pauseScreen, settingsScreen, controlsScreen, squadBio, inventoryScreen, choiceScreen, endScreen, introScreen, footText } from './ui/menus';
import { h } from './ui/dom';
import { registerServiceWorker } from './sw-register';

/**
 * App shell: owns renderer, input, screen stack and the frame loop.
 * Loop (threejs-scene-setup + physics-tuning): renderer.setAnimationLoop + THREE.Timer
 * (visibility-aware), delta clamped, fixed 60 Hz simulation steps via SimClock (hit-stop
 * aware), then presentation + render once per frame.
 */
class App {
  readonly canvas = document.getElementById('game') as HTMLCanvasElement;
  readonly settings: Settings = loadSettings();
  readonly r = new Renderer(this.canvas);
  readonly input = new Input(this.canvas);
  readonly screens = new ScreenStack();
  readonly touch = new TouchControls(this.input);
  readonly clock = new SimClock();
  readonly timer = new THREE.Timer();
  game: Game | null = null; hud: Hud | null = null; dialogue: Dialogue | null = null;
  private lines: { speaker: string; text: string }[] = []; private lineUntil = 0; private pendingChoices: string[] = []; private knot = '';
  offline = !!navigator.serviceWorker?.controller;
  private fps = h('div.fps.hidden'); private fpsAcc = 0; private fpsN = 0;
  private perf = { t: 0, n: 0, done: false };
  private carry: Set<string> | null = null;

  constructor() {
    document.title = GAME.title;
    document.body.append(this.fps);
    this.r.renderer.info.autoReset = false;
    this.screens.onPop = () => this.input.flush();
    this.timer.connect(document);
    engine.pauseOnDocumentHidden = true;
    this.input.onDevice = () => this.updateTouch();
    this.input.toWorldX = (cx, cy) => this.r.toWorldX(cx, cy);
    this.apply(this.settings);
    addEventListener('pointerdown', () => audio.unlock()); addEventListener('keydown', () => audio.unlock());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.game && !this.screens.open) this.pause(); });
    addEventListener('pagehide', () => this.autosave());
    this.r.renderer.setAnimationLoop(() => this.frame());
    // phones: the game is landscape-only; in portrait show a rotate screen with a fullscreen button
    document.body.append(h('div#rotate', {}, h('div.phone'), h('p', {}, 'Turn your phone sideways to play'), h('button', { onclick: goLandscape }, 'Play fullscreen')));
    this.title();
    registerServiceWorker((ok) => { this.offline = ok; const f = document.getElementById('netfoot'); if (f) f.textContent = footText(ok); });
  }

  apply(s: Settings): void {
    Object.assign(audio.volumes, { master: s.master, music: s.music, sfx: s.sfx, ambience: s.ambience, voice: s.voice, ui: s.sfx * 0.8 });
    audio.applyVolumes(); audio.setRain(s.rain);
    this.r.setQuality({ ...QUALITY_PRESETS[s.quality], pixel: s.pixel });
    if (this.game) { this.game.story = s.mode !== 'survival'; this.game.rain.enabled = s.rain; this.game.cam.shakeScale = s.shake; this.game.lights.moon.castShadow = QUALITY_PRESETS[s.quality].shadows; this.game.wet.setEnabled(QUALITY_PRESETS[s.quality].reflections); }
    if (this.hud) this.hud.tagsOn = s.nameTags;
    this.fps.classList.toggle('hidden', !s.showFps);
    this.updateTouch();
    saveSettings(s);
  }
  private updateTouch(): void {
    const s = this.settings.touch;
    this.touch.visible = !!this.game && !this.screens.blocking && (s === 'on' || (s === 'auto' && (this.input.device === 'touch' || matchMedia('(pointer: coarse)').matches)));
  }

  // ---------------------------------------------------------------- flow
  title(): void {
    this.screens.clear();
    titleScreen(this.screens, {
      canContinue: hasSave('autosave') || hasSave('manual'), offline: this.offline,
      onContinue: () => this.start(latestSave()), onNew: () => { deleteSave('autosave'); this.start(null); },
      onSettings: () => settingsScreen(this.screens, this.settings, this.input, (s) => this.apply(s)),
      onControls: () => controlsScreen(this.screens, this.input), onSquad: () => squadBio(this.screens),
    });
    this.updateTouch();
  }

  start(save: SaveData | null): void {
    audio.unlock();
    goLandscape();
    this.screens.clear(); this.teardown();
    const loading = h('div.loading', {}, h('div', {}, 'TUNING IN…'), h('div.bar', {}, h('i'))); document.body.append(loading);
    Promise.all([loadCharacterAsset(import.meta.env.BASE_URL).catch((e) => console.warn('[characters] falling back to built-in rig', e)), loadAssets(import.meta.env.BASE_URL)])
      .then(() => setTimeout(() => {
      try {
        const g = (this.game = new Game(this.r, CHAPTER1, save, QUALITY_PRESETS[this.settings.quality].shadows));
        this.dialogue = new Dialogue(storyJson); this.dialogue.load(save?.ink ?? null);
        this.hud = new Hud(g, this.input, () => this.pause(), () => this.inventory(false));
        g.ev.on('dialogue', (e) => this.onDialogue(e.knot));
        g.ev.on('checkpoint', () => this.autosave());
        g.ev.on('hitStop', (e) => this.clock.hitStop(performance.now(), e.seconds));
        g.ev.on('gameover', () => setTimeout(() => { this.updateTouch(); endScreen(this.screens, 'THE SIGNAL GOES QUIET', 'THE SQUAD DID NOT MAKE IT', '', [['Retry from checkpoint', () => this.start(latestSave())], ['Quit to title', () => this.quit()]]); }, 2200));
        if (import.meta.env.DEV) (window as unknown as { __game: Game; __app: App }).__game = g;
        (window as unknown as { __app: App }).__app = this;
        this.apply(this.settings);
        this.warmUp(g);
      } finally { loading.remove(); }
      this.perf = { t: 0, n: 0, done: false };
      if (!save) introScreen(this.screens, CHAPTER1.name, () => this.updateTouch());     // new game: the broadcast first
      this.updateTouch();
    }, 30));
  }

  /**
   * Stutter fix: compile every shader and upload every texture/geometry BEFORE play. Hidden pooled
   * objects (effects, off-screen actors, loot glints) are shown for a moment and the camera sweeps the
   * level, so nothing compiles or uploads mid-game (each first-time compile was a visible hitch).
   */
  private warmUp(g: Game): void {
    const r = this.r, hidden: THREE.Object3D[] = [];
    r.scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    r.renderer.compile(r.scene, r.camera);
    const fx = r.focus.x, step = Math.max(6, r.halfWidth * 1.6);
    for (let x = g.x0; x <= g.x1 + step; x += step) { r.focus.x = x; r.camera.updateMatrixWorld(); r.render(0); }
    r.focus.x = fx;
    for (const o of hidden) o.visible = false;
  }

  private teardown(): void { this.hud?.dispose(); this.hud = null; this.game?.dispose(); this.game = null; this.lines = []; this.pendingChoices = []; audio.duck(false); }
  quit(): void { this.autosave(); this.screens.clear(); this.teardown(); this.title(); }
  autosave(): void { if (this.game && !this.game.ended) saveGame('autosave', this.game.snapshot(this.dialogue?.save() ?? null)); }

  pause(): void {
    if (!this.game || this.screens.open) return;
    pauseScreen(this.screens, {
      onResume: () => { this.screens.clear(); this.updateTouch(); },
      onSave: () => { const ok = saveGame('manual', this.game!.snapshot(this.dialogue?.save() ?? null)); this.hud?.toast(ok ? 'Game saved' : 'Could not save (storage unavailable)', ok ? 'info' : 'warn'); this.screens.clear(); this.updateTouch(); },
      onLoad: () => this.start(latestSave()),
      onSettings: () => settingsScreen(this.screens, this.settings, this.input, (s) => this.apply(s)),
      onControls: () => controlsScreen(this.screens, this.input),
      onQuit: () => this.quit(),
    });
    this.updateTouch();
  }
  inventory(atBench: boolean): void {
    if (!this.game || this.screens.open) return;
    inventoryScreen(this.screens, this.game, { atBench, onClose: () => this.updateTouch() });
    this.updateTouch();
  }

  // ---------------------------------------------------------------- dialogue (Ink)
  private onDialogue(knot: string): void {
    if (knot === '__craft') { this.inventory(true); return; }
    if (!this.dialogue) return;
    if (knot === 'relay_restore') this.dialogue.set('has_fuse', true);
    this.knot = knot;
    const step = this.dialogue.start(knot);
    this.lines.push(...step.lines); this.pendingChoices = step.choices; this.lineUntil = 0;
    audio.duck(true);
  }
  private stepDialogue(now: number): void {
    if (!this.hud) return;
    if (this.lines.length && now >= this.lineUntil) {
      const l = this.lines.shift()!;
      this.lineUntil = now + this.hud.say(l.speaker, l.text);
      if (l.speaker === 'RADIO') audio.play('radioStatic', undefined, 0.6, 'voice');
    } else if (!this.lines.length && this.lineUntil && now >= this.lineUntil) {
      if (this.pendingChoices.length && !this.screens.open) {
        const ch = this.pendingChoices; this.pendingChoices = [];
        choiceScreen(this.screens, ch, (i) => { const s = this.dialogue!.choose(i); this.lines.push(...s.lines); this.pendingChoices = s.choices; this.lineUntil = 0; });
      } else if (!this.pendingChoices.length) {
        this.lineUntil = 0; this.hud.clearSubtitle(); audio.duck(false);
        if (this.knot === 'relay_restore' && this.game) this.complete();
      }
    }
  }
  private complete(): void {
    const g = this.game!; this.knot = ''; deleteSave('autosave');
    const alive = g.squad.filter((s) => s.alive).length;
    endScreen(this.screens, `${GAME.title.toUpperCase()}`, `${g.level.name.toUpperCase()} — COMPLETE`,
      `Survivors: ${alive}/4 · Caches searched: ${g.looted.size}/${g.level.caches.length} · Infected put down: ${g.killed.size} · Time: ${Math.floor(g.time / 60)}:${String(Math.floor(g.time % 60)).padStart(2, '0')}. The voice gave coordinates north-east: a research facility. Chapter 2 continues the journey.`,
      [['Back to title', () => this.quit()]]);
    this.updateTouch();
  }

  // ---------------------------------------------------------------- frame loop
  private frame(): void {
    this.timer.update();
    this.r.renderer.info.reset();
    const dt = Math.min(Math.max(this.timer.getDelta(), 0), 0.1), now = performance.now();
    this.input.sample(now);
    const g = this.game;
    if (this.screens.open) this.screens.pollPad(now);
    const blocked = this.screens.blocking;
    if (g && !blocked) {
      const f = this.input.frame(now);
      if (f.pressed.has('pause')) this.pause();
      else if (f.pressed.has('inventory')) this.inventory(false);
      else {
        const n = this.clock.advance(dt, now);
        if (this.carry) { for (const a of this.carry) (f.pressed as Set<string>).add(a); this.carry = null; }
        if (n === 0 && f.pressed.size) this.carry = f.pressed;      // no sim step this frame: keep taps for the next one
        for (let i = 0; i < n; i++) g.tick(STEP, i === 0 ? f : null);
      }
      this.stepDialogue(now);
    } else this.input.frame(now);            // drain buffered presses while menus are open
    if (g) { this.input.planar = !!g.inside; g.update(blocked ? 0 : dt * this.clock.timeScale, this.clock.alpha); this.hud?.update(); this.touch.sync(!!g.focus, g.player.crouch); }
    audio.update();
    this.r.grade.uniforms.uHurt.value = g ? Math.max(0, 1 - g.leader.hp / g.leader.maxHp - 0.45) * 0.9 : 0;
    this.r.render(now / 1000);
    this.measure(dt);
  }
  private measure(dt: number): void {
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.5) { this.fps.textContent = `${(this.fpsN / this.fpsAcc).toFixed(0)} FPS · ${this.r.renderer.info.render.calls} calls`; this.fpsAcc = 0; this.fpsN = 0; }
    // adaptive quality (threejs-scene-setup: measure after warm-up, step down, no oscillation)
    if (!this.game || this.perf.done || this.screens.open || !this.settings.autoQuality) return;
    this.perf.t += dt; this.perf.n++;
    if (this.perf.t < 5) return;
    this.perf.done = true;
    const fps = this.perf.n / this.perf.t;
    if (fps < 40 && this.settings.quality !== 'low') {
      this.settings.quality = this.settings.quality === 'high' ? 'medium' : 'low';
      this.apply(this.settings);
      this.hud?.toast(`Graphics set to ${this.settings.quality} for smoother play (${fps.toFixed(0)} FPS). Change in Settings.`, 'info');
      this.perf = { t: 0, n: 0, done: false };
    }
  }
}

new App();

/** Fullscreen + landscape lock where the browser allows it (Android Chrome); a no-op elsewhere. Needs a user gesture. */
function goLandscape(): void {
  if (!matchMedia('(pointer: coarse)').matches || document.fullscreenElement) return;
  document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })
    .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
    .catch(() => { /* iOS / desktop: no fullscreen API — the rotate screen still guides the player */ });
}
