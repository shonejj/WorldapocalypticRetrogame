import { h } from './dom';
import type { Action, Input } from '../core/input';

/** On-screen controls (input-systems: touch device) — hold buttons for held actions, taps for discrete. */
export class TouchControls {
  readonly root = h('div.touch.hidden');
  constructor(input: Input) {
    const hold = (label: string, cls: string, a: Action | 'L' | 'R') => {
      const b = h(`button.${cls}`, { 'aria-label': label }, label);
      const on = (e: PointerEvent) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on'); if (a === 'L') input.touchMoveX = -1; else if (a === 'R') input.touchMoveX = 1; else input.touchHeld.add(a); };
      const off = () => { b.classList.remove('on'); if (a === 'L' || a === 'R') { if ((a === 'L' && input.touchMoveX < 0) || (a === 'R' && input.touchMoveX > 0)) input.touchMoveX = 0; } else input.touchHeld.delete(a); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off);
      return b;
    };
    const tap = (label: string, cls: string, a: Action) => { const b = h(`button.${cls}`, { 'aria-label': label }, label); b.addEventListener('pointerdown', (e) => { e.preventDefault(); input.tap(a); b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 120); }); return b; };
    this.root.append(hold('◀', 'left', 'L'), hold('▶', 'right', 'R'), hold('RUN', 'run', 'run'), tap('SNEAK', 'crouch', 'crouch'),
      hold('FIRE', 'fire', 'fire'), tap('HIT', 'melee', 'melee'), tap('USE', 'use', 'interact'), tap('RLD', 'reload', 'reload'),
      tap('MED', 'heal', 'heal'), tap('LURE', 'throw', 'throw'), tap('SWAP', 'swap', 'nextSurvivor'));
    document.body.append(this.root);
  }
  set visible(v: boolean) { this.root.classList.toggle('hidden', !v); document.body.classList.toggle('touch-on', v); }
}
