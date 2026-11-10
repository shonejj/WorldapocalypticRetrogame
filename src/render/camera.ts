import { clamp, damp, noise2 } from '../core/math';

/**
 * Side-scroller camera rig (camera-systems): box deadzone → eased look-ahead in the facing/
 * velocity direction → level-bounds clamp (on the VIEW, not the centre) → frame-rate
 * independent smoothing. Shake is an additive offset from decaying trauma² (game-feel).
 */
export class CameraRig {
  x = 0; y = 1.9; private focusX = 0; private lead = 0;
  trauma = 0; shakeScale = 1;
  readonly offset = { x: 0, y: 0, roll: 0 };
  deadzone = 0.6; lookAhead = 2.2; rate = 4.5;

  snap(x: number): void { this.x = this.focusX = x; this.lead = 0; }
  addTrauma(a: number): void { this.trauma = Math.min(1, this.trauma + a); }

  update(dt: number, targetX: number, facing: number, vx: number, halfW: number, x0: number, x1: number, t: number): void {
    const to = targetX - this.focusX;
    if (Math.abs(to) > this.deadzone) this.focusX += (Math.abs(to) - this.deadzone) * Math.sign(to);
    this.lead = damp(this.lead, facing * this.lookAhead + vx * 0.35, 2.2, dt);
    // a place narrower than the view (small rooms) is simply centred
    const goal = x1 - x0 < halfW * 2 - 2 ? (x0 + x1) / 2 : clamp(this.focusX + this.lead, x0 + halfW - 1, x1 - halfW + 1);
    this.x = damp(this.x, goal, this.rate, dt);
    // trauma shake: smooth noise, decays, quadratic response
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    const s = this.trauma * this.trauma * this.shakeScale;
    this.offset.x = (noise2(t * 22, 1) - 0.5) * 0.7 * s;
    this.offset.y = (noise2(t * 22, 7) - 0.5) * 0.5 * s;
    this.offset.roll = (noise2(t * 18, 13) - 0.5) * 0.05 * s;
  }
}
