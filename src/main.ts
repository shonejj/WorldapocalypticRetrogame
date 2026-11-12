import './ui/style.css';
import * as THREE from 'three';
import { engine } from 'animejs';
import { GAME } from './config/game';
import { Renderer, QUALITY_PRESETS } from './render/renderer';
import { Input } from './core/input';
import { SimClock, STEP } from './core/clock';
import { audio } from './core/audio';
import { Game } from './game/game';
import { CAMPAIGN, levelById, nextLevel } from './game/campaign';
import { CAMP_ARRIVE } from './game/levels/camps';
import type { LevelDef } from './game/levels/types';
import { Dialogue } from './game/dialogue';
import { NOTES, type NoteId } from './game/data';
import { saveGame, latestSave, deleteSave, hasSave, SAVE_VERSION, type SaveData } from './game/save';
import storyJson from './story/story.ink';
import { STORYBOARDS } from './story/storyboards';
import { ScreenStack } from './ui/screens';
import { Hud } from './ui/hud';
import { TouchControls } from './ui/touch';
import { loadCharacterAsset } from './art/skinned';
import { loadAssets } from './art/assets';
import { makePortraits } from './art/portraits';
import { playMinigame } from './ui/minigames';
import { loadSettings, saveSettings, type Settings } from './ui/settings';
import { titleScreen, pauseScreen, settingsScreen, controlsScreen, squadBio, inventoryScreen, endScreen, resultsScreen, footText } from './ui/menus';
import { cutscene, conversation, noteScreen } from './ui/story';
import { readPrefs, writePrefs } from './core/storage';
import { h } from './ui/dom';
import { registerServiceWorker } from './sw-register';

/**
 * App shell: owns renderer, input, screen stack and the frame loop, and runs the campaign —
 * title → storyboard → chapter → results → storyboard → safehouse → … → one of three endings.
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
  /** barks: subtitle lines that play while the game keeps running */
  private lines: { speaker: string; text: string }[] = []; private lineUntil = 0;
  /** conversations waiting for the screen to be free */
  private scenes: { knot: string; then?: 'complete' }[] = [];
  offline = !!navigator.serviceWorker?.controller;
  private fps = h('div.fps.hidden'); private fpsAcc = 0; private fpsN = 0;
  private perf = { t: 0, n: 0, done: false };
  private carry: Set<string> | null = null; private lost = false;
  private loading = false;

  constructor() {
    document.title = GAME.title;
    (window as unknown as { __app: App }).__app = this;
    document.body.append(this.fps);
    this.r.renderer.info.autoReset = false;
    // a GPU reset must never take the tab down with it: stop drawing, drop to low quality, offer a resume
    this.r.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault(); this.lost = true;
      this.autosave();
      this.settings.quality = 'low'; this.settings.autoQuality = false; saveSettings(this.settings);
      const el = document.createElement('div'); el.className = 'gpu-lost';
      el.innerHTML = '<b>The graphics driver reset.</b><span>Your progress is saved. Quality was lowered.</span>';
      const b = document.createElement('button'); b.textContent = 'Reload'; b.onclick = () => location.reload(); el.append(b); document.body.append(el);
    });
    this.screens.onPop = () => this.input.flush();
    this.timer.connect(document);
    engine.pauseOnDocumentHidden = true;
    this.input.onDevice = () => this.updateTouch();
    this.input.toWorldX = (cx, cy) => this.r.toWorldX(cx, cy);
    this.apply(this.settings);
    addEventListener('pointerdown', () => audio.unlock()); addEventListener('keydown', () => audio.unlock());
    document.addEventListener('visibilitychange', () => { audio.sleep(document.hidden); if (document.hidden && this.game && !this.screens.open) this.pause(); });
    addEventListener('pagehide', () => this.autosave());
    this.r.renderer.setAnimationLoop(() => this.frame());
    // phones: the game is landscape-only; in portrait show a rotate screen with a fullscreen button
    document.body.append(h('div#rotate', {}, h('div.phone'), h('p', {}, 'Turn your phone sideways to play'), h('button', { onclick: goLandscape }, 'Play fullscreen')));
    this.title();
    registerServiceWorker((ok) => { this.offline = ok; const f = document.getElementById('netfoot'); if (f) f.textContent = footText(ok); });
  }

  apply(s: Settings): void {
    Object.assign(audio.volumes, { master: s.master, music: s.music, sfx: s.sfx, ambience: s.ambience, voice: s.voice, ui: s.sfx * 0.8 });
    audio.applyVolumes(); if (!this.game) audio.setRain(false);
    this.r.setQuality({ ...QUALITY_PRESETS[s.quality], pixel: s.pixel });
    if (this.game) { this.game.story = s.mode !== 'survival'; this.game.prefs = { rain: s.rain, reflections: QUALITY_PRESETS[s.quality].reflections }; this.game.applyPrefs(); this.game.cam.shakeScale = s.shake; this.game.lights.moon.castShadow = QUALITY_PRESETS[s.quality].shadows; }
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
    audio.setTheme('title'); audio.setRain(false);
    const save = hasSave('autosave') || hasSave('manual') ? latestSave() : null, lv = save ? levelById(save.chapter) : null;
    titleScreen(this.screens, {
      canContinue: !!save, continueLabel: lv ? `Continue — ${lv.kind === 'camp' ? lv.name : lv.number.toLowerCase()}` : 'Continue', endings: readPrefs<{ ids: number[] }>('endings', { ids: [] }).ids.length, offline: this.offline,
      onContinue: () => this.start(latestSave()), onNew: () => { deleteSave('autosave'); deleteSave('manual'); this.begin(CAMPAIGN[0], null); },
      onSettings: () => settingsScreen(this.screens, this.settings, this.input, (s) => this.apply(s)),
      onControls: () => controlsScreen(this.screens, this.input), onSquad: () => squadBio(this.screens),
    });
    this.updateTouch();
  }

  /** A save that starts `level` from its beginning, carrying the squad's state over from the previous one. */
  private freshSave(level: LevelDef, from: SaveData | null): SaveData {
    return {
      version: SAVE_VERSION, chapter: level.id, checkpoint: level.spawnX, savedAt: Date.now(), controlled: 0,
      stash: from?.stash ?? { ammo_rifle: 36, ammo_9mm: 24, ammo_shells: 8, bandage: 1, food: 1, water: 1, bottle: 1 },
      // whoever went down is carried to the next place and patched up: nobody is left behind between chapters
      party: (from?.party ?? []).map((p) => ({ ...p, alive: true, hp: Math.max(p.hp, 60), bleed: 0, hunger: Math.max(p.hunger, 0.6), thirst: Math.max(p.thirst, 0.6) })),
      looted: [], picked: [], killed: [], objectives: [], seenBeats: [], ink: from?.ink ?? null,
      notes: from?.notes ?? [], upgrades: from?.upgrades ?? {}, stats: from?.stats ?? { time: 0, shots: 0 },
    };
  }

  /** Enter a level from its start: storyboard first (if it has one), then play. */
  begin(level: LevelDef, from: SaveData | null, board?: string): void {
    audio.unlock(); goLandscape();
    this.screens.clear(); this.teardown();
    const save = this.freshSave(level, from);
    saveGame('autosave', save);
    const shots = STORYBOARDS[board ?? level.intro ?? ''];
    if (shots) { audio.setTheme('title'); cutscene(this.screens, shots, () => this.start(save)); } else this.start(save);
    this.updateTouch();
  }

  start(save: SaveData | null): void {
    if (this.loading) return;
    if (!save) { this.begin(CAMPAIGN[0], null); return; }
    audio.unlock();
    goLandscape();
    this.screens.clear(); this.teardown(); this.loading = true;
    const level = levelById(save.chapter);
    const loading = h('div.loading', {}, h('div', {}, 'TUNING IN…'), h('div.bar', {}, h('i'))); document.body.append(loading);
    Promise.all([loadCharacterAsset(import.meta.env.BASE_URL).catch((e) => console.warn('[characters] falling back to built-in rig', e)), loadAssets(import.meta.env.BASE_URL)])
      .then(() => setTimeout(() => {
      try {
        makePortraits(this.r.renderer);
        const g = (this.game = new Game(this.r, level, save, QUALITY_PRESETS[this.settings.quality].shadows));
        g.minigame = (k) => { this.input.flush(); return playMinigame(k).finally(() => this.input.flush()); };
        this.dialogue = new Dialogue(storyJson); this.dialogue.load(save.ink ?? null);
        this.hud = new Hud(g, this.input, () => this.pause(), () => this.inventory(false));
        g.ev.on('dialogue', (e) => this.onDialogue(e.knot, e.then));
        g.ev.on('checkpoint', () => this.autosave());
        g.ev.on('note', (e) => this.note(e.id));
        g.ev.on('complete', () => this.levelComplete());
        g.ev.on('hitStop', (e) => this.clock.hitStop(performance.now(), e.seconds));
        g.ev.on('gameover', () => setTimeout(() => { this.updateTouch(); endScreen(this.screens, 'THE SIGNAL GOES QUIET', 'THE SQUAD DID NOT MAKE IT', '', [['Retry from checkpoint', () => this.start(latestSave())], ['Quit to title', () => this.quit()]]); }, 2200));
        (window as unknown as { __game: Game }).__game = g;
        this.apply(this.settings);
        audio.setTheme(level.theme);
        this.warmUp(g);
        if (g.camp && !g.seenBeats.has('arrive')) { g.seenBeats.add('arrive'); this.scenes.push({ knot: CAMP_ARRIVE[level.id] }); }
        else if (level.kind === 'chapter' && save.checkpoint === level.spawnX) this.hud.banner(`${level.number} — ${level.name}`);
      } finally { loading.remove(); this.loading = false; }
      this.perf = { t: 0, n: 0, done: false };
      this.updateTouch();
    }, 30));
  }

  /** The level's goal is done (or the squad slept): results, the storyboard, then the next place. */
  private levelComplete(): void {
    const g = this.game; if (!g) return;
    const level = g.level, snap = g.snapshot(this.dialogue?.save() ?? null), next = nextLevel(level.id);
    snap.stats = { time: (snap.stats?.time ?? 0), shots: snap.stats?.shots ?? 0 };
    const go = () => {
      if (!next) { this.ending(); return; }
      this.begin(next, snap, level.outro);
    };
    if (level.kind === 'camp') { go(); return; }
    const spots = level.caches.filter((c) => !c.room).length + level.rooms.reduce((n, r) => n + r.spots.length, 0);
    const notes = level.rooms.flatMap((r) => r.spots).filter((sp) => sp.note), found = notes.filter((sp) => g.notes.has(sp.note!)).length;
    resultsScreen(this.screens, { number: level.number, name: level.name, next: next ? 'Continue' : 'See how it ends', onNext: go, rows: [
      ['Time', `${Math.floor(g.time / 60)}:${String(Math.floor(g.time % 60)).padStart(2, '0')}`],
      ['Survivors standing', `${g.squad.filter((s) => s.alive).length} / 4`],
      ['Infected put down', String([...g.killed].length)],
      ['Places searched', `${Math.min(spots, g.looted.size)} / ${spots}`],
      ['Documents found', `${found} / ${notes.length}`],
      ['Shots fired', String(g.shotsFired)],
    ] });
    this.updateTouch();
  }

  private ending(): void {
    const n = Math.max(1, Math.min(3, Number(this.dialogue?.get('ending') ?? 2)));
    const seen = readPrefs<{ ids: number[] }>('endings', { ids: [] }); if (!seen.ids.includes(n)) { seen.ids.push(n); writePrefs('endings', seen); }
    deleteSave('autosave'); deleteSave('manual');
    this.screens.clear(); this.teardown(); audio.setTheme('ending');
    cutscene(this.screens, STORYBOARDS[`ending${n}`], () => {
      endScreen(this.screens, GAME.title.toUpperCase(), n === 3 ? 'THE TRUE ENDING' : `ENDING ${n} OF 3`,
        n === 3 ? 'Thank you for playing.' : 'There is another way this could have gone. Trust the people walking with you, and read everything Dr. Hale left behind.', [['Back to title', () => this.title()]]);
    });
    this.updateTouch();
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

  private teardown(): void { this.hud?.dispose(); this.hud = null; this.game?.dispose(); this.game = null; this.lines = []; this.scenes = []; this.lineUntil = 0; audio.duck(false); audio.setBoss(false); }
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
    if (atBench && this.game.camp) this.game.setObjective('o_bench', true);
    inventoryScreen(this.screens, this.game, { atBench, onClose: () => this.updateTouch(), onNote: (id) => noteScreen(this.screens, id, () => {}) });
    this.updateTouch();
  }
  private note(id: NoteId): void {
    const g = this.game!;
    noteScreen(this.screens, id, () => {
      this.updateTouch();
      if (NOTES[id].research) this.hud?.toast(`Research note ${[...g.notes].filter((n) => NOTES[n].research).length} / 3`, 'loot');
      if (g.level.id === 'ch3') g.setObjective('o_read', [...g.notes].filter((n) => n.startsWith('n_hale')).length >= 3);
    });
    this.updateTouch();
  }

  // ---------------------------------------------------------------- story (Ink)
  private onDialogue(knot: string, then?: 'complete'): void {
    if (knot === '__craft') { this.inventory(true); return; }
    if (!this.dialogue || !this.game) return;
    if (knot.startsWith('bark_')) {                                   // subtitles while you keep moving
      const step = this.dialogue.start(knot);
      this.lines.push(...step.lines); this.lineUntil = 0; audio.duck(true);
    } else this.scenes.push({ knot, then });
  }
  /** Run the next waiting conversation once nothing else is on screen. */
  private stepScenes(): void {
    const g = this.game;
    if (!g || !this.dialogue || !this.scenes.length || this.screens.open || g.fading) return;
    const sc = this.scenes.shift()!, d = this.dialogue;
    d.set('research', [...g.notes].filter((n) => NOTES[n].research).length);
    this.lines = []; this.hud?.clearSubtitle();
    audio.duck(true);
    conversation(this.screens, d.start(sc.knot), (i) => d.choose(i), () => {
      audio.duck(false); this.updateTouch();
      if (g.camp && sc.knot.startsWith('camp') && !sc.knot.endsWith('arrive')) { if (!g.interactables.some((i) => i.kind === 'talk')) g.setObjective('o_talk', true); }
      if (g.level.id === 'ch3' && sc.knot === 'lab_enter') g.setObjective('o_in', true);
      if (sc.then === 'complete') this.levelComplete();
    });
    this.updateTouch();
  }
  private stepBarks(now: number): void {
    if (!this.hud) return;
    if (this.lines.length && now >= this.lineUntil) {
      const l = this.lines.shift()!;
      this.lineUntil = now + this.hud.say(l.speaker, l.text);
      if (l.speaker === 'RADIO') audio.play('radioStatic', undefined, 0.6, 'voice');
    } else if (!this.lines.length && this.lineUntil && now >= this.lineUntil) { this.lineUntil = 0; this.hud.clearSubtitle(); audio.duck(false); }
  }

  // debug handles for automated playthroughs (tests/e2e) — not reachable from the UI
  debugStart(id: string | null): void { this.start(this.freshSave(levelById(id ?? 'ch1'), null)); }
  debugSkip(): void { this.screens.clear(); this.scenes = []; this.lines = []; this.updateTouch(); }

  // ---------------------------------------------------------------- frame loop
  private frame(): void {
    if (this.lost) return;
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
      this.stepBarks(now); this.stepScenes();
    } else this.input.frame(now);            // drain buffered presses while menus are open
    document.body.classList.toggle('cine', blocked);
    if (g) { audio.setBoss(!!g.boss); g.update(blocked ? 0 : dt * this.clock.timeScale, this.clock.alpha); this.hud?.update(); this.touch.sync(!!g.focus, g.player.crouch); }
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
