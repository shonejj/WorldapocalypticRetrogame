import { readPrefs, writePrefs } from './storage';

/**
 * Action-based input (input-systems skill):
 * gameplay reads ACTIONS; bindings are data per device; edges are buffered until the
 * simulation consumes them; sticks use a radial deadzone; bindings are rebindable with
 * conflict detection and persisted; the last-used device drives on-screen prompts.
 */
export const ACTIONS = [
  'left', 'right', 'run', 'crouch', 'fire', 'melee', 'interact', 'reload', 'heal', 'throw',
  'nextSurvivor', 'slot1', 'slot2', 'slot3', 'slot4', 'squad', 'inventory', 'pause',
] as const;
export type Action = (typeof ACTIONS)[number];
export const ACTION_LABEL: Record<Action, string> = {
  left: 'Move left', right: 'Move right', run: 'Run', crouch: 'Crouch / sneak', fire: 'Fire', melee: 'Melee',
  interact: 'Interact / search', reload: 'Reload', heal: 'Use medical', throw: 'Throw lure', nextSurvivor: 'Next survivor',
  slot1: 'Survivor 1', slot2: 'Survivor 2', slot3: 'Survivor 3', slot4: 'Survivor 4', squad: 'Squad hold / follow',
  inventory: 'Inventory & crafting', pause: 'Pause',
};
/** Discrete actions are edge-triggered; the rest are read as held. */
const DISCRETE: ReadonlySet<Action> = new Set(['crouch', 'melee', 'interact', 'reload', 'heal', 'throw', 'nextSurvivor', 'slot1', 'slot2', 'slot3', 'slot4', 'squad', 'inventory', 'pause']);

export type Binding =
  | { d: 'key'; code: string }
  | { d: 'mouse'; button: number }
  | { d: 'pad'; button: number }
  | { d: 'axis'; axis: number; dir: 1 | -1 };
export type Bindings = Record<Action, Binding[]>;
export type Device = 'keyboard' | 'gamepad' | 'touch';

const key = (code: string): Binding => ({ d: 'key', code });
export const DEFAULT_BINDINGS: Bindings = {
  left: [key('KeyA'), key('ArrowLeft'), { d: 'axis', axis: 0, dir: -1 }, { d: 'pad', button: 14 }],
  right: [key('KeyD'), key('ArrowRight'), { d: 'axis', axis: 0, dir: 1 }, { d: 'pad', button: 15 }],
  run: [key('ShiftLeft'), key('ShiftRight'), { d: 'pad', button: 10 }, { d: 'pad', button: 4 }],
  crouch: [key('KeyC'), key('ControlLeft'), { d: 'pad', button: 1 }],
  fire: [key('KeyJ'), { d: 'mouse', button: 0 }, { d: 'pad', button: 7 }, { d: 'pad', button: 5 }],
  melee: [key('KeyF'), key('KeyK'), { d: 'mouse', button: 2 }, { d: 'pad', button: 2 }],
  interact: [key('KeyE'), { d: 'pad', button: 0 }],   // W/↑ walk 'up' inside buildings
  reload: [key('KeyR'), { d: 'pad', button: 3 }],
  heal: [key('KeyH'), { d: 'pad', button: 12 }],
  throw: [key('KeyT'), key('KeyG'), { d: 'pad', button: 6 }],
  nextSurvivor: [key('Tab'), key('KeyQ'), { d: 'pad', button: 11 }],
  slot1: [key('Digit1')], slot2: [key('Digit2')], slot3: [key('Digit3')], slot4: [key('Digit4')],
  squad: [key('KeyV'), { d: 'pad', button: 13 }],
  inventory: [key('KeyI'), key('KeyB'), { d: 'pad', button: 8 }],
  pause: [key('Escape'), key('KeyP'), { d: 'pad', button: 9 }],
};

export const sameBinding = (a: Binding, b: Binding) => JSON.stringify(a) === JSON.stringify(b);

/** Radial deadzone with rescale (input-systems pattern 2). */
export function radialDeadzone(x: number, y: number, dead = 0.22): [number, number] {
  const m = Math.hypot(x, y);
  if (m < dead) return [0, 0];
  const s = Math.min((m - dead) / (1 - dead), 1);
  return [(x / m) * s, (y / m) * s];
}

/** One tick's worth of action state handed to the simulation. */
/** aimX: world x under the mouse (PC aiming); aimDir: right-stick facing (gamepad). */
export interface InputFrame { held: Set<Action>; pressed: Set<Action>; moveX: number; aimX?: number; aimDir?: number; /** interiors: + = toward the camera */ moveY?: number }

const BUFFER_MS = 130;

export class Input {
  bindings: Bindings;
  device: Device = 'keyboard';
  private keys = new Set<string>();
  private mouse = new Set<number>();
  private pad: { buttons: boolean[]; axes: number[] } = { buttons: [], axes: [] };
  private prevActive = new Set<Action>();
  private pressedAt = new Map<Action, number>();
  /** Touch UI writes held actions here and calls tap() for discrete ones. */
  touchHeld = new Set<Action>();
  touchMoveX = 0; touchMoveY = 0;
  /** true inside buildings: the stick/WASD move on both axes */
  planar = false;
  private capture: ((b: Binding) => void) | null = null;
  onDevice: ((d: Device) => void) | null = null;
  /** Mouse position in CSS px (PC aiming); converted to world x by `toWorldX` (set by the app). */
  private ptr: { x: number; y: number } | null = null;
  toWorldX: ((cx: number, cy: number) => number) | null = null;

  constructor(target: HTMLElement) {
    this.bindings = readPrefs<Bindings>('bindings', structuredClone(DEFAULT_BINDINGS));
    this.bindings.interact = this.bindings.interact.filter((b) => !(b.d === 'key' && (b.code === 'KeyW' || b.code === 'ArrowUp')));   // old saves: W/↑ now walk up indoors
    addEventListener('keydown', (e) => {
      if (this.capture) { e.preventDefault(); if (e.code !== 'Escape') this.finishCapture({ d: 'key', code: e.code }); else this.capture = null; return; }
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) { this.keys.add(e.code); this.edge((b) => b.d === 'key' && b.code === e.code); }
      this.setDevice('keyboard');
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    target.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (this.capture) { this.finishCapture({ d: 'mouse', button: e.button }); return; }
      this.mouse.add(e.button); this.edge((b) => b.d === 'mouse' && b.button === e.button); this.setDevice('keyboard');
    });
    addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') this.mouse.delete(e.button); });
    addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') this.ptr = { x: e.clientX, y: e.clientY }; });
    document.addEventListener('mouseleave', () => { this.ptr = null; });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('blur', () => { this.keys.clear(); this.mouse.clear(); this.touchHeld.clear(); this.touchMoveX = 0; });
    addEventListener('touchstart', () => this.setDevice('touch'), { passive: true });
  }

  /** A tap shorter than one frame must still count: record discrete presses at event time. */
  private edge(match: (b: Binding) => boolean): void {
    const now = performance.now();
    for (const a of ACTIONS) if (DISCRETE.has(a) && !this.suppressUntilRelease.has(a) && this.bindings[a].some(match)) this.pressedAt.set(a, now);
  }

  private setDevice(d: Device): void { if (d !== this.device) { this.device = d; this.onDevice?.(d); } }

  private isActive(b: Binding): boolean {
    switch (b.d) {
      case 'key': return this.keys.has(b.code);
      case 'mouse': return this.mouse.has(b.button);
      case 'pad': return !!this.pad.buttons[b.button];
      case 'axis': { const v = this.pad.axes[b.axis] ?? 0; return v * b.dir > 0.5; }
    }
  }

  private pollPad(): void {
    const p = Array.from(navigator.getGamepads?.() ?? []).find((g) => g && g.connected);
    if (!p) { this.pad = { buttons: [], axes: [] }; return; }
    const [ax, ay] = radialDeadzone(p.axes[0] ?? 0, p.axes[1] ?? 0);
    this.pad = { buttons: p.buttons.map((b) => b.pressed), axes: [ax, ay, ...p.axes.slice(2)] };
    if (this.pad.buttons.some(Boolean) || Math.abs(ax) > 0.3) this.setDevice('gamepad');
    if (this.capture) {
      const bi = this.pad.buttons.findIndex(Boolean);
      if (bi >= 0) this.finishCapture({ d: 'pad', button: bi });
      else if (Math.abs(ax) > 0.6) this.finishCapture({ d: 'axis', axis: 0, dir: ax > 0 ? 1 : -1 });
    }
  }

  /** Sample devices once per rendered frame; record edges with a timestamp for buffering. */
  sample(now: number): void {
    this.pollPad();
    for (const a of ACTIONS) {
      const active = this.touchHeld.has(a) || this.bindings[a].some((b) => this.isActive(b));
      if (!active) this.suppressUntilRelease.delete(a);
      if (active && !this.prevActive.has(a) && !this.suppressUntilRelease.has(a)) this.pressedAt.set(a, now);
      if (active) this.prevActive.add(a); else this.prevActive.delete(a);
    }
  }

  /** Forget buffered presses and treat currently held inputs as already handled. */
  flush(): void {
    this.pressedAt.clear();
    this.suppressUntilRelease = new Set(ACTIONS.filter((a) => this.touchHeld.has(a) || this.bindings[a].some((b) => this.isActive(b))));
  }
  private suppressUntilRelease = new Set<Action>();
  private lastFrame = 0;

  /** Touch buttons for discrete actions. */
  tap(a: Action): void { this.pressedAt.set(a, performance.now()); this.setDevice('touch'); }

  /** Build the frame for the simulation; consumes buffered presses (each fires once). */
  frame(now: number): InputFrame {
    const held = new Set<Action>(), pressed = new Set<Action>();
    for (const a of this.prevActive) held.add(a);
    const win = BUFFER_MS + Math.max(0, now - this.lastFrame);   // a slow frame must not expire a tap made during it
    for (const [a, t] of this.pressedAt) {
      if (now - t <= win || !DISCRETE.has(a)) pressed.add(a);
    }
    this.pressedAt.clear(); this.lastFrame = now;
    let moveX = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
    const stick = this.pad.axes[0] ?? 0;
    if (Math.abs(stick) > 0.05) moveX = stick;
    if (this.touchMoveX) moveX = this.touchMoveX;
    const k = (c: string) => this.keys.has(c), py = this.pad.axes[1] ?? 0;
    const out: InputFrame = { held, pressed, moveX, moveY: this.touchMoveY || (Math.abs(py) > 0.15 ? py : (k('KeyS') || k('ArrowDown') ? 1 : 0) - (k('KeyW') || k('ArrowUp') ? 1 : 0)) };
    if (this.device === 'keyboard' && this.ptr && this.toWorldX) out.aimX = this.toWorldX(this.ptr.x, this.ptr.y);
    const rx = this.pad.axes[2] ?? 0;
    if (this.device === 'gamepad' && Math.abs(rx) > 0.5) out.aimDir = Math.sign(rx);
    return out;
  }

  // ---------------------------------------------------------------- rebinding
  /** Listen for the next physical input and bind it to `action` (replacing that device kind). */
  rebind(action: Action, done: (result: { ok: true } | { ok: false; conflict: Action }) => void): void {
    this.capture = (b) => {
      const conflict = ACTIONS.find((o) => o !== action && this.bindings[o].some((x) => sameBinding(x, b)));
      if (conflict && conflict !== 'pause') { done({ ok: false, conflict }); return; }
      const kind = b.d === 'axis' ? 'pad' : b.d;
      this.bindings[action] = [b, ...this.bindings[action].filter((x) => (x.d === 'axis' ? 'pad' : x.d) !== kind)];
      writePrefs('bindings', this.bindings);
      done({ ok: true });
    };
  }
  private finishCapture(b: Binding): void { const c = this.capture; this.capture = null; c?.(b); }
  get capturing(): boolean { return !!this.capture; }
  resetBindings(): void { this.bindings = structuredClone(DEFAULT_BINDINGS); writePrefs('bindings', this.bindings); }

  /** Human label for the first binding of the current device. */
  label(a: Action): string {
    const want = this.device === 'gamepad' ? ['pad', 'axis'] : ['key', 'mouse'];
    const b = this.bindings[a].find((x) => want.includes(x.d)) ?? this.bindings[a][0];
    if (!b) return '—';
    if (b.d === 'key') return b.code.replace(/^Key|^Digit/, '').replace('Arrow', '').replace('Left', 'L').replace('Right', 'R').replace('Escape', 'Esc');
    if (b.d === 'mouse') return ['LMB', 'MMB', 'RMB'][b.button] ?? `M${b.button}`;
    if (b.d === 'pad') return PAD_NAMES[b.button] ?? `B${b.button}`;
    return b.dir > 0 ? 'Stick →' : 'Stick ←';
  }
}
const PAD_NAMES: Record<number, string> = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'View', 9: 'Menu', 10: 'L3', 11: 'R3', 12: 'D↑', 13: 'D↓', 14: 'D←', 15: 'D→' };
