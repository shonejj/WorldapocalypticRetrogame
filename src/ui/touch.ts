import { h } from './dom';
import type { Action, Input } from '../core/input';

/**
 * On-screen controls (input-systems: touch device; game-ui-ux: thumb zones).
 * LEFT thumb: a floating analog stick anywhere in the left half — tilt to walk, push to the rim
 * to run; flick down toggles sneak, flick up uses/searches. A SNEAK toggle sits above it.
 * RIGHT thumb: an arc around a large FIRE button — HIT, USE (lights up when something is in
 * reach), RELOAD, LURE, MED, and SWAP survivor. Nothing overlaps the HUD panels.
 */
const R = 58, DEAD = 0.16, RUN_AT = 0.82;

export class TouchControls {
  readonly root = h('div.touch.hidden');
  private use!: HTMLElement;
  private sneak!: HTMLElement;

  constructor(private input: Input) {
    // ---- left: floating stick
    const zone = h('div.stickzone'), base = h('div.stick'), knob = h('div.knob'); base.append(knob);
    let id = -1, ox = 0, oy = 0, flicked = false;
    const home = () => { base.style.left = ''; base.style.top = ''; base.classList.remove('live'); knob.style.transform = ''; };
    const release = () => { id = -1; input.touchMoveX = 0; input.touchMoveY = 0; input.touchHeld.delete('run'); home(); };
    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault(); if (id !== -1) return;
      id = e.pointerId; zone.setPointerCapture(id); ox = e.clientX; oy = e.clientY; flicked = false;
      base.style.left = `${ox}px`; base.style.top = `${oy}px`; base.classList.add('live');
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      let dx = (e.clientX - ox) / R, dy = (e.clientY - oy) / R; const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      knob.style.transform = `translate(${dx * R}px, ${dy * R}px)`;
      const ax = Math.abs(dx) < DEAD ? 0 : Math.sign(dx) * Math.min(1, (Math.abs(dx) - DEAD) / (1 - DEAD));
      input.touchMoveX = ax;
      if (input.planar) {                       // inside buildings: free movement on both axes, no flick gestures
        input.touchMoveY = Math.abs(dy) < DEAD ? 0 : dy;
        if (Math.hypot(dx, dy) > RUN_AT) input.touchHeld.add('run'); else input.touchHeld.delete('run');
        return;
      }
      if (Math.abs(dx) > RUN_AT) input.touchHeld.add('run'); else input.touchHeld.delete('run');
      if (!flicked && Math.abs(dy) > 0.85 && Math.abs(dx) < 0.45) { flicked = true; input.tap(dy > 0 ? 'crouch' : 'interact'); }
      if (Math.abs(dy) < 0.4) flicked = false;
    });
    zone.addEventListener('pointerup', release); zone.addEventListener('pointercancel', release);
    this.root.append(zone, base);

    // ---- buttons
    const hold = (label: string, cls: string, a: Action) => {
      const b = h(`button.${cls}`, { 'aria-label': label }, label);
      const on = (e: PointerEvent) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on'); input.touchHeld.add(a); };
      const off = () => { b.classList.remove('on'); input.touchHeld.delete(a); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off);
      return b;
    };
    const tap = (label: string, cls: string, a: Action) => {
      const b = h(`button.${cls}`, { 'aria-label': label }, label);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); input.tap(a); b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 120); });
      return b;
    };
    this.sneak = tap('SNEAK', 'crouch', 'crouch');
    this.use = tap('USE', 'use', 'interact');
    const cluster = h('div.cluster', {}, hold('FIRE', 'fire', 'fire'), tap('HIT', 'melee', 'melee'), this.use, tap('RLD', 'reload', 'reload'),
      tap('LURE', 'throw', 'throw'), tap('MED', 'heal', 'heal'), tap('SWAP', 'swap', 'nextSurvivor'));
    this.root.append(this.sneak, cluster);
    document.body.append(this.root);
  }

  set visible(v: boolean) { this.root.classList.toggle('hidden', !v); document.body.classList.toggle('touch-on', v); if (!v) { this.input.touchMoveX = 0; this.input.touchHeld.clear(); } }
  /** HUD state the buttons reflect: something to use in reach, sneaking on. */
  sync(canUse: boolean, sneaking: boolean): void { this.use.classList.toggle('ready', canUse); this.sneak.classList.toggle('lit', sneaking); }
}
