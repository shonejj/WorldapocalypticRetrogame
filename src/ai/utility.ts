/**
 * Utility AI (ai-behavior-trees-utility-ai): considerations map raw facts through normalized
 * 0..1 response curves, combine as a compensated product, and the evaluator picks the best
 * action with hysteresis so agents don't flip-flop between near-equal options.
 */
export type Curve = (x: number) => number;
const c01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const curves = {
  linear: (m = 1, b = 0): Curve => (x) => c01(m * x + b),
  inverse: (): Curve => (x) => c01(1 - x),
  quad: (k = 2): Curve => (x) => c01(Math.pow(c01(x), k)),
  sigmoid: (mid = 0.5, steep = 10): Curve => (x) => 1 / (1 + Math.exp(-steep * (x - mid))),
  step: (t: number): Curve => (x) => (x >= t ? 1 : 0),
};

export interface Consideration<C> { input: (ctx: C) => number; curve: Curve }
export interface UtilityAction<C, A extends string> { id: A; weight: number; considerations: Consideration<C>[] }

/** Compensated product (Dave Mark): avoids many considerations dragging scores toward 0. */
export function score<C>(ctx: C, cons: Consideration<C>[]): number {
  if (!cons.length) return 0;
  let s = 1;
  for (const c of cons) s *= c01(c.curve(c.input(ctx)));
  const mod = 1 - 1 / cons.length;
  return s + (1 - s) * mod * s;
}

export class Reasoner<C, A extends string> {
  current: A | null = null;
  scores = new Map<A, number>();
  constructor(private actions: UtilityAction<C, A>[], private hysteresis = 0.1) {}
  decide(ctx: C): A {
    let best: A = this.actions[0].id, bestS = -1;
    for (const a of this.actions) {
      let s = a.weight * score(ctx, a.considerations);
      if (a.id === this.current) s += this.hysteresis;           // stick with the current choice
      this.scores.set(a.id, s);
      if (s > bestS) { bestS = s; best = a.id; }
    }
    this.current = best;
    return best;
  }
}
