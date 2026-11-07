import './ui/style.css';
import { engine } from 'animejs';
import { GAME } from './config/game';
import { Renderer } from './render/renderer';
import { Input, emptyCommand } from './core/input';
import { audio } from './core/audio';
import { loadSettings, saveSettings, store, type Settings } from './core/storage';
import { Game, type SaveData } from './game/game';
import { CHAPTER1 } from './game/levels/chapter1';
import { Hud } from './ui/hud';
import { Screens, footText } from './ui/screens';
import { TouchControls } from './ui/touch';
import { SURVIVORS } from './game/data';
import { loadAssets, type Assets, type CharId } from './render/assets';
import { registerServiceWorker } from './sw-register';

document.title = GAME.title;
const canvas = document.getElementById('game') as HTMLCanvasElement;
const settings: Settings = loadSettings();
const renderer = new Renderer(canvas);
const input = new Input(canvas);
const screens = new Screens();
const touch = new TouchControls(input);
let game: Game | null = null;
let hud: Hud | null = null;
let offline = !!navigator.serviceWorker?.controller;
let assets: Assets | null = null;
type Mode = 'title' | 'play' | 'pause' | 'menu' | 'end';
let mode: Mode = 'title';

engine.pauseOnDocumentHidden = true;

function applySettings(): void {
  audio.volumes = { master: settings.masterVolume, sfx: settings.sfxVolume, ambience: settings.ambienceVolume };
  audio.applyVolumes(); audio.setRain(settings.rain);
  renderer.setRenderScale(settings.renderScale);
  renderer.setQuality(settings.quality);
  hud?.setNameTags(settings.nameTags);
  if (game) { game.rain.enabled = settings.rain; game.shakeEnabled = settings.screenShake; }
  hud?.setFpsVisible(settings.showFps);
  updateTouch();
  saveSettings(settings);
}
function updateTouch(): void {
  const on = settings.touchControls === 'on' || (settings.touchControls === 'auto' && (input.usingTouch || matchMedia('(pointer: coarse)').matches));
  touch.visible = on && mode === 'play';
}

const hasSave = () => store.get<SaveData | { level: '' }>('save', { level: '' }).level === CHAPTER1.id;

function showTitle(): void {
  mode = 'title'; updateTouch();
  const portraits = SURVIVORS.map((s) => assets!.chars[s.id as CharId].portraitUrl);
  screens.title({
    hasSave: hasSave(), offline,
    onContinue: () => start(store.get<SaveData>('save', null as unknown as SaveData)),
    onNew: () => { store.remove('save'); start(null); },
    onSettings: () => screens.settings(settings, applySettings, showTitle),
    onControls: () => screens.controls(showTitle),
    onSquad: () => screens.squad(portraits, null, showTitle),
  });
}

function teardown(): void {
  hud?.dispose(); hud = null;
  game?.dispose(); game = null;
}

/** Build the level after a frame so the loading bar can paint (art is generated procedurally). */
function start(save: SaveData | null): void {
  audio.unlock();
  screens.close();
  teardown();
  const loader = screens.loading();
  loader.set(0.3, 'BUILDING THE STREET…');
  requestAnimationFrame(() => setTimeout(() => {
    game = new Game(renderer, CHAPTER1, save, assets!);
    if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;   // test/debug hook (dev only)
    loader.set(0.9, 'WAKING THE SQUAD…');
    hud = new Hud(game, pause, inventory);
    game.listeners.push((e) => {
      if (e.type === 'gameover') setTimeout(() => { mode = 'end'; updateTouch(); screens.gameOver(retry, quit); }, 1800);
      if (e.type === 'complete') { mode = 'end'; updateTouch(); store.remove('save'); screens.complete(game!, quit); }
    });
    applySettings();
    loader.done();
    mode = 'play'; updateTouch();
    hud.say('IRIS', save ? 'Back on the signal. Let\'s keep moving.' : 'The transmission repeats every ninety seconds. Same coordinates. Someone wants to be found.');
  }, 30));
}

function retry(): void { start(hasSave() ? store.get<SaveData>('save', null as unknown as SaveData) : null); }
function quit(): void { game?.save(); screens.close(); teardown(); showTitle(); }
function resume(): void { screens.close(); mode = 'play'; if (game) game.paused = false; engine.resume(); updateTouch(); }
function pause(): void {
  if (!game || mode !== 'play') return;
  mode = 'pause'; game.paused = true; updateTouch();
  const show = () => screens.pause(resume, () => screens.settings(settings, applySettings, show), () => screens.controls(show), quit, retry);
  show();
}
function inventory(): void {
  if (!game || mode !== 'play') return;
  mode = 'menu'; game.paused = true; updateTouch();
  screens.squad(game.portraits, game, resume);
}

// pause when the tab is hidden; keep an emergency save
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') pause(); });
addEventListener('pagehide', () => game?.save());
addEventListener('pointerdown', () => audio.unlock(), { once: false });
addEventListener('keydown', () => audio.unlock());

// ------------------------------------------------------------------ main loop
let last = performance.now(), fpsAcc = 0, fpsN = 0;
// adaptive quality: sample the first seconds of play and step down on slow devices
const perf = { t: 0, n: 0, done: false };
function adaptQuality(dt: number): void {
  if (perf.done || mode !== 'play') return;
  perf.t += dt; perf.n++;
  if (perf.t < 4) return;
  perf.done = true;
  const fps = perf.n / perf.t;
  if (fps < 35 && settings.quality === 'high') {
    settings.quality = 'low'; if (fps < 22) settings.renderScale = 0.75;
    applySettings(); hud?.toast(`Graphics lowered for smoother play (${fps.toFixed(0)} FPS) — change in Settings`, 'info');
  }
}
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const cmd = input.poll();
  if (mode === 'play' && game) {
    if (cmd.pause) pause();
    else if (cmd.inventory) inventory();
    else game.update(dt, cmd);
    hud?.update();
  } else if ((mode === 'pause' || mode === 'menu') && cmd.pause) resume();
  else if (game && mode === 'end') game.update(dt, emptyCommand());
  if (input.usingTouch && settings.touchControls === 'auto' && mode === 'play' && touch.root.classList.contains('hidden')) updateTouch();
  adaptQuality(dt);
  renderer.render(now / 1000);
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { hud?.setFps(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  requestAnimationFrame(frame);
}

applySettings();
requestAnimationFrame(frame);
{
  const loader = screens.loading();
  loadAssets((p) => loader.set(p, 'TUNING IN…'))
    .then((a) => { assets = a; loader.done(); showTitle(); })
    .catch((err) => { console.error(err); loader.set(1, 'FAILED TO LOAD ASSETS — RELOAD'); });
}
registerServiceWorker((ready) => {
  offline = ready;
  const f = document.getElementById('netfoot');
  if (f) f.textContent = footText(ready);
});
