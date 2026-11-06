import { h } from './dom';
import type { Input } from '../core/input';

/** On-screen controls: hold-buttons for movement/fire, tap buttons for actions. */
export class TouchControls {
  readonly root = h('div.touch.hidden');
  constructor(input: Input) {
    const hold = (label: string, style: string, on: () => void, off: () => void) => {
      const b = h('button', { style }, label);
      const down = (e: PointerEvent) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('on'); on(); };
      const up = () => { b.classList.remove('on'); off(); };
      b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
      return b;
    };
    const tap = (label: string, style: string, fn: () => void) => {
      const b = h('button', { style }, label);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('on'); fn(); setTimeout(() => b.classList.remove('on'), 120); });
      return b;
    };
    const size = 'width:64px;height:64px;font-size:22px;';
    let runOn = false;
    const runBtn = tap('RUN', 'left:166px;bottom:34px;width:46px;height:46px;', () => { runOn = !runOn; input.touch.run = runOn; runBtn.classList.toggle('on', runOn); });
    this.root.append(
      hold('◀', `left:18px;bottom:22px;${size}`, () => { input.touch.moveX = -1; }, () => { if (input.touch.moveX < 0) input.touch.moveX = 0; }),
      hold('▶', `left:92px;bottom:22px;${size}`, () => { input.touch.moveX = 1; }, () => { if (input.touch.moveX > 0) input.touch.moveX = 0; }),
      runBtn,
      tap('SNEAK', 'left:166px;bottom:88px;width:46px;height:46px;font-size:9px', () => input.press('crouch')),
      hold('FIRE', 'right:20px;bottom:24px;width:78px;height:78px;font-size:13px;', () => { input.touch.fire = true; }, () => { input.touch.fire = false; }),
      tap('HIT', 'right:108px;bottom:20px;width:56px;height:56px;', () => input.press('melee')),
      tap('USE', 'right:30px;bottom:112px;width:56px;height:56px;', () => input.press('interact')),
      tap('RLD', 'right:108px;bottom:86px;width:44px;height:44px;font-size:10px', () => input.press('reload')),
      tap('MED', 'right:168px;bottom:30px;width:44px;height:44px;font-size:10px', () => input.press('heal')),
      tap('SWAP', 'right:162px;bottom:86px;width:44px;height:44px;font-size:9px', () => input.press('next')),
    );
    document.body.append(this.root);
  }
  set visible(v: boolean) { this.root.classList.toggle('hidden', !v); document.body.classList.toggle('touch-on', v); }
}
