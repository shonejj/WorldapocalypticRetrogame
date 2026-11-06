import { animate, createTimer, stagger } from 'animejs';
import { h } from './dom';
import { GAME } from '../config/game';
import { ITEMS, SURVIVORS, WEAPONS, type ItemId } from '../game/data';
import type { Settings } from '../core/storage';
import type { Game } from '../game/game';

type Btn = [label: string, fn: () => void, disabled?: boolean];

export const footText = (offline: boolean) => `v${GAME.version} · ${offline ? 'OFFLINE READY — PLAYABLE WITHOUT INTERNET' : 'CACHING FOR OFFLINE…'} · MIT`;

function menu(items: Btn[]): HTMLElement {
  const m = h('div.menu');
  for (const [label, fn, disabled] of items) m.append(h('button', { onclick: fn, disabled: !!disabled }, label));
  return m;
}

/** One screen visible at a time; screens are plain DOM, animated in with Anime.js. */
export class Screens {
  private current: HTMLElement | null = null;
  private waveTimer: { revert(): unknown } | null = null;

  show(el: HTMLElement): void {
    this.close();
    this.current = el;
    document.body.append(el);
    animate(el, { opacity: [0, 1], duration: 300, ease: 'outQuad' });
    const btns = el.querySelectorAll('.menu button');
    if (btns.length) animate(btns, { opacity: [0, 1], y: [8, 0], delay: stagger(50, { start: 150 }), duration: 280, ease: 'outQuad' });
    (el.querySelector('.menu button:not([disabled])') as HTMLButtonElement | null)?.focus({ preventScroll: true });
  }
  close(): void { this.waveTimer?.revert(); this.waveTimer = null; this.current?.remove(); this.current = null; }
  get open(): boolean { return !!this.current; }

  loading(): { set(p: number, label?: string): void; done(): void } {
    const bar = h('i'), lbl = h('div', {}, 'TUNING IN…');
    const el = h('div.loading', {}, lbl, h('div.bar', {}, bar));
    document.body.append(el);
    return { set: (p, label) => { bar.style.width = `${p * 100}%`; if (label) lbl.textContent = label; }, done: () => el.remove() };
  }

  title(opts: { hasSave: boolean; offline: boolean; onContinue: () => void; onNew: () => void; onSettings: () => void; onControls: () => void; onSquad: () => void }): void {
    const canvas = h<'canvas'>('canvas.wave');
    const words = GAME.title.toUpperCase().split(' ');
    const half = Math.ceil(words.length / 2);
    const titleEl = h('h1', {}, words.slice(0, half).join(' '), h('br'), words.slice(half).join(' '));
    const el = h('div.screen.title', {}, canvas, titleEl, h('div.sub', {}, GAME.tagline.toUpperCase()),
      menu([
        ['Continue', opts.onContinue, !opts.hasSave], ['New expedition', opts.onNew], ['The squad', opts.onSquad],
        ['Settings', opts.onSettings], ['Controls', opts.onControls],
      ]),
      h('div.foot#netfoot', {}, footText(opts.offline)));
    this.show(el);
    animate(titleEl, { opacity: [0, 1], letterSpacing: ['0.4em', '0.06em'], duration: 1600, ease: 'outExpo' });
    // radio waveform (procedural) — locks onto the "signal" every few seconds
    const g = canvas.getContext('2d')!;
    const draw = (t: number) => {
      const w = (canvas.width = canvas.clientWidth * Math.min(2, devicePixelRatio || 1)), hh = (canvas.height = canvas.clientHeight * Math.min(2, devicePixelRatio || 1));
      g.clearRect(0, 0, w, hh);
      const lock = Math.max(0, Math.sin(t / 2400)) ** 6;
      for (let layer = 0; layer < 3; layer++) {
        g.beginPath();
        g.strokeStyle = layer === 0 ? `rgba(90,209,230,${0.5 + lock * 0.5})` : `rgba(90,209,230,${0.15 - layer * 0.04})`;
        g.lineWidth = layer === 0 ? 2 : 1;
        for (let x = 0; x <= w; x += 3) {
          const u = x / w, env = Math.sin(u * Math.PI);
          const noise = Math.sin(u * 91 + t / 90 + layer) * Math.sin(u * 37 - t / 170) * (1 - lock) * 0.6;
          const sig = Math.sin(u * 28 - t / 120) * lock;
          const y = hh / 2 + (noise + sig + Math.sin(u * 13 + t / 300 + layer * 2) * 0.15) * env * hh * 0.38;
          if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      }
    };
    this.waveTimer = createTimer({ loop: true, duration: 1000, onUpdate: () => draw(performance.now()) });
  }

  pause(onResume: () => void, onSettings: () => void, onControls: () => void, onQuit: () => void, onRestart: () => void): void {
    this.show(h('div.screen', {}, h('h1', { style: 'font-size:40px' }, 'PAUSED'), h('div.sub', {}, GAME.title.toUpperCase()),
      menu([['Resume', onResume], ['Restart from checkpoint', onRestart], ['Settings', onSettings], ['Controls', onControls], ['Quit to title', onQuit]])));
  }

  settings(s: Settings, onChange: (s: Settings) => void, onBack: () => void): void {
    const range = (label: string, key: keyof Settings, min: number, max: number, step: number) => {
      const out = h('span', {}, String(s[key]));
      const input = h('input', { type: 'range', min, max, step, value: String(s[key]), oninput: (e: Event) => {
        (s as unknown as Record<string, number>)[key] = Number((e.target as HTMLInputElement).value); out.textContent = String(s[key]); onChange(s);
      } });
      return h('div.row', {}, h('span', {}, label), h('span', {}, input, ' ', out));
    };
    const check = (label: string, key: keyof Settings) => h('div.row', {}, h('span', {}, label), h('input', { type: 'checkbox', checked: !!s[key], onchange: (e: Event) => {
      (s as unknown as Record<string, boolean>)[key] = (e.target as HTMLInputElement).checked; onChange(s);
    } }));
    const touchSel = h('select', { onchange: (e: Event) => { s.touchControls = (e.target as HTMLSelectElement).value as Settings['touchControls']; onChange(s); } },
      ...(['auto', 'on', 'off'] as const).map((v) => h('option', { value: v, selected: s.touchControls === v }, v.toUpperCase())));
    this.show(h('div.screen', {}, h('div.card', {}, h('h2', {}, 'SETTINGS'),
      range('Master volume', 'masterVolume', 0, 1, 0.05), range('Effects', 'sfxVolume', 0, 1, 0.05), range('Ambience (rain, wind)', 'ambienceVolume', 0, 1, 0.05),
      range('Render scale', 'renderScale', 0.5, 1, 0.25), check('Rain', 'rain'), check('Screen shake', 'screenShake'), check('Show FPS', 'showFps'),
      h('div.row', {}, h('span', {}, 'Touch controls'), touchSel),
      h('div', { style: 'margin-top:14px' }, menu([['Back', onBack]])))));
  }

  controls(onBack: () => void): void {
    const k = (keys: string, what: string) => [h('kbd', {}, keys), h('span', {}, what)];
    this.show(h('div.screen', {}, h('div.card', {}, h('h2', {}, 'CONTROLS'), h('div.keys', {},
      ...k('A / D  ← →', 'Move'), ...k('Shift', 'Run (loud)'), ...k('C / S / Ctrl', 'Crouch — sneak, harder to spot'),
      ...k('J / Left mouse', 'Fire weapon (very loud)'), ...k('K / F / Right mouse', 'Melee — silent; takedown on unaware infected'),
      ...k('R', 'Reload'), ...k('H', 'Use medkit / bandage'), ...k('E / W / ↑', 'Search / interact'),
      ...k('1–4 / Tab / Q', 'Switch survivor'), ...k('G', 'Squad: hold / follow'), ...k('I', 'Squad & inventory'), ...k('Esc / P', 'Pause'),
      ...k('Gamepad', 'Stick move · RT fire · X melee · A use · B crouch · Y reload · LT switch'),
      ...k('Touch', 'On-screen buttons appear automatically')),
      h('p', { style: 'font-size:11px;color:var(--dim);margin-top:14px' }, 'Infected react to sound and movement. Gunfire pulls the whole street — sneak and use melee when you can.'),
      menu([['Back', onBack]]))));
  }

  squad(portraits: string[], game: Game | null, onBack: () => void): void {
    const card = h('div.card', {}, h('h2', {}, game ? 'SQUAD & SUPPLIES' : 'THE SQUAD'));
    SURVIVORS.forEach((s, i) => {
      const a = game?.survivors[i];
      const status = a ? (a.alive ? `${Math.round(a.hp)}/${a.maxHp} HP · ${WEAPONS[a.weapon].name} (${a.mag[a.weapon] ?? 0})` : 'DOWN') : `${WEAPONS[s.weapon].name} · ${s.resistant ? 'resistant to the organism' : 'not exposed'}`;
      card.append(h('div.bio', {}, h('img', { src: portraits[i], alt: s.name }), h('div', {}, h('b', {}, `${s.name} — ${s.roleLabel}`), h('div', {}, status), h('div', {}, s.bio), h('div', { style: 'color:var(--accent)' }, s.trait))));
    });
    if (game) {
      const grid = h('div.keys');
      for (const [id, n] of Object.entries(game.stash) as [ItemId, number][]) if (n) grid.append(h('kbd', {}, `${ITEMS[id].icon} ${n}`), h('span', {}, ITEMS[id].name));
      card.append(h('h2', { style: 'margin-top:16px' }, 'STASH'), grid);
    }
    card.append(h('div', { style: 'margin-top:14px' }, menu([['Back', onBack]])));
    this.show(h('div.screen', {}, card));
  }

  gameOver(onRetry: () => void, onQuit: () => void): void {
    this.show(h('div.screen', {}, h('h1', { style: 'font-size:44px;color:#d2463a' }, 'THE SIGNAL GOES QUIET'), h('div.sub', {}, 'THE SQUAD DID NOT MAKE IT'), menu([['Retry from checkpoint', onRetry], ['Quit to title', onQuit]])));
  }

  complete(game: Game, onTitle: () => void): void {
    const kills = game.killed.size, loot = game.looted.size, alive = game.survivors.filter((s) => s.alive).length;
    this.show(h('div.screen', {}, h('h1', { style: 'font-size:42px' }, 'RELAY 7 RESTORED'), h('div.sub', {}, `${game.level.name.toUpperCase()} — COMPLETE`),
      h('div.card', { style: 'text-align:center' },
        h('div', {}, `Survivors: ${alive}/4 · Caches searched: ${loot} · Infected put down: ${kills}`),
        h('p', { style: 'color:var(--dim);font-size:12px' }, 'The transmission is clearer now: coordinates, an emergency protocol — and a voice. The journey continues in the next chapter.'),
        menu([['Back to title', onTitle]]))));
  }
}
