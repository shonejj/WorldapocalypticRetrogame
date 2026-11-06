/**
 * Device-agnostic input. Keyboard, gamepad and touch all write into the same
 * Command snapshot that the simulation consumes once per fixed tick.
 * (Commands — not raw keys — are what a future network layer would send.)
 */
export interface Command {
  moveX: number;        // -1..1
  run: boolean;
  crouch: boolean;      // toggle edge handled by game
  fire: boolean;
  melee: boolean;       // edge
  interact: boolean;    // edge
  reload: boolean;      // edge
  heal: boolean;        // edge
  switchChar: number;   // 0 = none, 1..4 = slot, -1 = next
  pause: boolean;       // edge
  inventory: boolean;   // edge
  debug: boolean;       // edge
  orderHold: boolean;   // edge: toggle squad hold/follow
}

export const emptyCommand = (): Command => ({
  moveX: 0, run: false, crouch: false, fire: false, melee: false, interact: false,
  reload: false, heal: false, switchChar: 0, pause: false, inventory: false, debug: false, orderHold: false,
});

type EdgeKey = 'melee' | 'interact' | 'reload' | 'heal' | 'pause' | 'inventory' | 'debug' | 'orderHold' | 'crouch';

const KEYMAP: Record<string, EdgeKey | 'left' | 'right' | 'run' | 'fire' | `slot${1 | 2 | 3 | 4}` | 'next'> = {
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run', KeyC: 'crouch', ControlLeft: 'crouch', ArrowDown: 'crouch', KeyS: 'crouch',
  KeyJ: 'fire', KeyK: 'melee', KeyF: 'melee', KeyE: 'interact', ArrowUp: 'interact', KeyW: 'interact', KeyR: 'reload', KeyH: 'heal',
  Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', Digit4: 'slot4', Tab: 'next', KeyQ: 'next',
  Escape: 'pause', KeyP: 'pause', KeyI: 'inventory', Backquote: 'debug', KeyG: 'orderHold',
};

export class Input {
  private held = new Set<string>();
  private edges = new Set<string>();
  private mouseFire = false;
  /** Touch UI writes here (see ui/touch.ts). */
  touch = { moveX: 0, run: false, fire: false };
  usingTouch = false;
  usingGamepad = false;
  private padPrev: boolean[] = [];

  constructor(canvas: HTMLElement) {
    addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      if (e.code === 'Tab' || e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      if (!e.repeat) this.edges.add(a);
      this.held.add(a);
      this.usingTouch = false;
    });
    addEventListener('keyup', (e) => { const a = KEYMAP[e.code]; if (a) this.held.delete(a); });
    addEventListener('blur', () => { this.held.clear(); this.mouseFire = false; this.touch.moveX = 0; this.touch.fire = false; });
    canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button === 0) this.mouseFire = true; if (e.pointerType === 'mouse' && e.button === 2) this.edges.add('melee'); });
    addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse' && e.button === 0) this.mouseFire = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('touchstart', () => { this.usingTouch = true; }, { passive: true });
  }

  /** Called by touch UI buttons for one-shot actions. */
  press(action: EdgeKey | 'next'): void { this.edges.add(action); }

  /** Build this tick's command and clear one-shot edges. */
  poll(): Command {
    const c = emptyCommand();
    const h = this.held;
    c.moveX = (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0);
    c.run = h.has('run');
    c.fire = h.has('fire') || this.mouseFire || this.edges.has('fire');   // edge: a tap shorter than a frame still fires
    this.pollGamepad(c);
    if (this.touch.moveX !== 0) c.moveX = this.touch.moveX;
    c.run ||= this.touch.run;
    c.fire ||= this.touch.fire;
    const e = this.edges;
    c.melee = e.has('melee'); c.interact = e.has('interact'); c.reload = e.has('reload'); c.heal = e.has('heal');
    c.pause = e.has('pause'); c.inventory = e.has('inventory'); c.debug = e.has('debug'); c.orderHold = e.has('orderHold');
    c.crouch = e.has('crouch');
    for (let i = 1; i <= 4; i++) if (e.has(`slot${i}`)) c.switchChar = i;
    if (e.has('next')) c.switchChar = -1;
    e.clear();
    return c;
  }

  private pollGamepad(c: Command): void {
    const pads = navigator.getGamepads?.() ?? [];
    const p = Array.from(pads).find((g) => g && g.connected);
    if (!p) return;
    const ax = p.axes[0] ?? 0;
    const btn = (i: number) => !!p.buttons[i]?.pressed;
    const edge = (i: number) => { const now = btn(i); const was = this.padPrev[i]; this.padPrev[i] = now; return now && !was; };
    if (Math.abs(ax) > 0.25) { c.moveX = Math.sign(ax) * Math.min(1, (Math.abs(ax) - 0.25) / 0.6); this.usingGamepad = true; }
    if (btn(14)) c.moveX = -1; if (btn(15)) c.moveX = 1;
    c.run ||= btn(10) || btn(4);            // L3 / LB
    c.fire ||= btn(7) || btn(5);             // RT / RB
    if (edge(2)) c.melee = true;             // X / Square
    if (edge(0)) c.interact = true;          // A / Cross
    if (edge(1)) c.crouch = true;            // B / Circle
    if (edge(3)) c.reload = true;            // Y / Triangle
    if (edge(12)) c.heal = true;             // dpad up
    if (edge(13)) c.orderHold = true;        // dpad down
    if (edge(9)) c.pause = true;             // start
    if (edge(8)) c.inventory = true;         // select
    if (edge(6)) c.switchChar = -1;          // LT
    if ([0, 1, 2, 3, 7, 5].some(btn)) this.usingGamepad = true;
  }
}
