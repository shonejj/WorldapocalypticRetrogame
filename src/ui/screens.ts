import { animate, stagger } from 'animejs';
import { h } from './dom';
import { audio } from '../core/audio';

/**
 * Screen stack (game-ui-ux pattern 5): push overlays, pop to go back; only the top screen
 * receives input. Every screen focuses a control on open and supports keyboard/gamepad
 * focus navigation (up/down/left/right, confirm, back).
 */
export interface Screen { el: HTMLElement; onBack?: () => void; onClose?: () => void; modal?: boolean }

export class ScreenStack {
  private stack: Screen[] = [];
  /** Called after any screen closes (main flushes buffered input so Esc/B don't leak into gameplay). */
  onPop: (() => void) | null = null;
  readonly layer = h('div.screens');
  constructor() { document.body.append(this.layer); addEventListener('keydown', (e) => this.key(e)); }

  get top(): Screen | undefined { return this.stack[this.stack.length - 1]; }
  get open(): boolean { return this.stack.length > 0; }
  get blocking(): boolean { return this.stack.some((s) => s.modal !== false); }

  push(s: Screen): void {
    if (this.top) this.top.el.classList.add('under');
    this.stack.push(s); this.layer.append(s.el);
    animate(s.el, { opacity: [0, 1], duration: 220, ease: 'outQuad' });
    const items = s.el.querySelectorAll('.menu > button, .focusable');
    if (items.length) animate(items, { opacity: [0, 1], y: [8, 0], delay: stagger(40, { start: 80 }), duration: 260, ease: 'outQuad' });
    this.focusFirst();
  }
  pop(): void {
    const s = this.stack.pop(); if (!s) return;
    s.onClose?.(); s.el.remove(); this.onPop?.();
    if (this.top) { this.top.el.classList.remove('under'); this.focusFirst(); }
  }
  replace(s: Screen): void { const old = this.stack.pop(); old?.onClose?.(); old?.el.remove(); this.push(s); }
  clear(): void { while (this.stack.length) this.pop(); }

  focusFirst(): void {
    const t = this.top; if (!t) return;
    const el = t.el.querySelector<HTMLElement>('[autofocus], .menu > button:not([disabled]), button:not([disabled]), input, select');
    el?.focus({ preventScroll: true });
  }
  private focusables(): HTMLElement[] {
    return this.top ? [...this.top.el.querySelectorAll<HTMLElement>('button:not([disabled]), input, select')].filter((e) => e.offsetParent !== null) : [];
  }
  /** Move focus spatially; dir: up/down/left/right. */
  move(dir: 'up' | 'down' | 'left' | 'right'): void {
    const list = this.focusables(); if (!list.length) return;
    const cur = document.activeElement as HTMLElement;
    if (!list.includes(cur)) { list[0].focus(); return; }
    if ((dir === 'left' || dir === 'right') && cur.tagName === 'INPUT' && (cur as HTMLInputElement).type === 'range') {
      const r = cur as HTMLInputElement; r.value = String(Number(r.value) + Number(r.step || 0.05) * (dir === 'right' ? 1 : -1)); r.dispatchEvent(new Event('input')); return;
    }
    const a = cur.getBoundingClientRect(), ax = a.x + a.width / 2, ay = a.y + a.height / 2;
    let best: HTMLElement | null = null, bd = 1e9;
    for (const e of list) {
      if (e === cur) continue;
      const b = e.getBoundingClientRect(), bx = b.x + b.width / 2, by = b.y + b.height / 2, dx = bx - ax, dy = by - ay;
      const ok = dir === 'up' ? dy < -4 : dir === 'down' ? dy > 4 : dir === 'left' ? dx < -4 : dx > 4;
      if (!ok) continue;
      const d = dir === 'up' || dir === 'down' ? Math.abs(dy) + Math.abs(dx) * 2 : Math.abs(dx) + Math.abs(dy) * 2;
      if (d < bd) { bd = d; best = e; }
    }
    if (!best && (dir === 'down' || dir === 'up')) best = list[(list.indexOf(cur) + (dir === 'down' ? 1 : list.length - 1)) % list.length];
    if (best) { best.focus({ preventScroll: false }); audio.play('uiMove'); }
  }
  confirm(): void { const e = document.activeElement as HTMLElement | null; if (e && this.top?.el.contains(e)) { e.click(); } }
  back(): void { const t = this.top; if (!t) return; audio.play('uiBack'); if (t.onBack) t.onBack(); else this.pop(); }
  private key(e: KeyboardEvent): void {
    if (!this.top || (document.activeElement as HTMLElement)?.dataset.capturing) return;
    const map: Record<string, () => void> = { ArrowUp: () => this.move('up'), ArrowDown: () => this.move('down'), ArrowLeft: () => this.move('left'), ArrowRight: () => this.move('right'), Escape: () => this.back() };
    const f = map[e.code]; if (f) { e.preventDefault(); e.stopPropagation(); f(); }
  }
  /** Gamepad menu navigation (called each frame by main while a screen is open). */
  private padPrev: boolean[] = []; private padRepeat = 0;
  pollPad(now: number): void {
    const p = Array.from(navigator.getGamepads?.() ?? []).find((g) => g && g.connected); if (!p || !this.top) return;
    const b = (i: number) => !!p.buttons[i]?.pressed, ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0;
    const dirs: [boolean, 'up' | 'down' | 'left' | 'right'][] = [[b(12) || ay < -0.6, 'up'], [b(13) || ay > 0.6, 'down'], [b(14) || ax < -0.6, 'left'], [b(15) || ax > 0.6, 'right']];
    const held = dirs.find((d) => d[0]);
    if (held && now > this.padRepeat) { this.move(held[1]); this.padRepeat = now + 180; }
    if (!held) this.padRepeat = 0;
    const edge = (i: number) => { const v = b(i), was = this.padPrev[i]; this.padPrev[i] = v; return v && !was; };
    if (edge(0)) this.confirm();
    if (edge(1) || edge(9)) this.back();
  }
}

export function menu(items: [string, () => void, boolean?][]): HTMLElement {
  const m = h('div.menu');
  for (const [label, fn, disabled] of items) m.append(h('button', { onclick: () => { audio.play('uiSelect'); fn(); }, disabled: !!disabled }, label));
  return m;
}
export const panel = (title: string, ...kids: (Node | string | null | false)[]) => h('div.card', {}, h('h2', {}, title), ...kids);
