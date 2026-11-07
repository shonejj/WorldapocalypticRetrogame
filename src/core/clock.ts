/**
 * Fixed-timestep simulation clock (physics-tuning pattern 1).
 * - Simulation always advances in STEP increments (60 Hz).
 * - `alpha` (0..1) lets the renderer interpolate between the last two sim states.
 * - Frame delta is clamped to [0, 0.1] so a stall can't launch everything.
 * - `timeScale` implements hit-stop; it is restored on a REAL-TIME timer so a freeze
 *   always ends (game-feel pattern 2), and only the newest hit-stop may restore it.
 */
export const STEP = 1 / 60;
export const MAX_STEPS = 5;

export class SimClock {
  acc = 0;
  alpha = 0;
  timeScale = 1;
  simTime = 0;
  private hitStopUntil = 0;
  private hitStopId = 0;

  /** Returns how many fixed steps to run this frame. */
  advance(frameDt: number, realNow: number): number {
    if (this.hitStopUntil && realNow >= this.hitStopUntil) { this.hitStopUntil = 0; this.timeScale = 1; }
    const dt = Math.min(Math.max(frameDt, 0), 0.1) * this.timeScale;
    this.acc += dt;
    let n = 0;
    while (this.acc >= STEP && n < MAX_STEPS) { this.acc -= STEP; n++; }
    if (n === MAX_STEPS) this.acc = Math.min(this.acc, STEP);   // drop excess after a stall
    this.alpha = this.acc / STEP;
    this.simTime += n * STEP;
    return n;
  }

  /** Brief freeze for impact. Overlapping calls extend; the newest owns the restore. */
  hitStop(realNow: number, seconds = 0.06, scale = 0.05): void {
    this.hitStopId++;
    this.timeScale = scale;
    this.hitStopUntil = Math.max(this.hitStopUntil, realNow + seconds * 1000);
  }
}
