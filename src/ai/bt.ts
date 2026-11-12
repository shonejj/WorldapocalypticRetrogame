/**
 * Minimal behavior-tree runtime (ai-behavior-trees-utility-ai):
 * three-value Status, a typed Blackboard per agent, Sequence/Selector with memory of the
 * running child, a REACTIVE selector that re-checks higher priorities every tick (so
 * "I see you" interrupts "wander"), and decorators (Inverter, Cooldown, Succeed).
 */
export const enum Status { Success, Failure, Running }

export abstract class Node<B> {
  abstract tick(bb: B, dt: number): Status;
  reset(): void { /* abandoned by parent */ }
}

export class Condition<B> extends Node<B> {
  constructor(private test: (bb: B) => boolean, readonly label = '') { super(); }
  tick(bb: B): Status { return this.test(bb) ? Status.Success : Status.Failure; }
}

/** Leaf action: return Running until done. */
export class Action<B> extends Node<B> {
  constructor(private run: (bb: B, dt: number) => Status, readonly label = '', private onReset?: () => void) { super(); }
  tick(bb: B, dt: number): Status { return this.run(bb, dt); }
  reset(): void { this.onReset?.(); }
}

abstract class Composite<B> extends Node<B> {
  protected current = 0;
  constructor(protected children: Node<B>[]) { super(); }
  reset(): void { this.current = 0; for (const c of this.children) c.reset(); }
}

/** AND: stop at the first non-success; resumes a running child. */
export class Sequence<B> extends Composite<B> {
  tick(bb: B, dt: number): Status {
    for (; this.current < this.children.length; this.current++) {
      const s = this.children[this.current].tick(bb, dt);
      if (s === Status.Running) return s;
      if (s === Status.Failure) { this.reset(); return s; }
    }
    this.reset(); return Status.Success;
  }
}

/**
 * Guarded branch: the condition is re-checked EVERY tick (a memory Sequence would only check it
 * once and then keep resuming the running action forever). Fails — and resets the child — the
 * moment the guard stops holding.
 */
export class When<B> extends Node<B> {
  constructor(private test: (bb: B) => boolean, private child: Node<B>, readonly label = '') { super(); }
  tick(bb: B, dt: number): Status {
    if (!this.test(bb)) { this.child.reset(); return Status.Failure; }
    return this.child.tick(bb, dt);
  }
  reset(): void { this.child.reset(); }
}

/** OR with priorities re-evaluated every tick; abandoning a lower branch resets it. */
export class ReactiveSelector<B> extends Composite<B> {
  private running = -1;
  tick(bb: B, dt: number): Status {
    for (let i = 0; i < this.children.length; i++) {
      const s = this.children[i].tick(bb, dt);
      if (s !== Status.Failure) {
        if (this.running !== -1 && this.running !== i) this.children[this.running].reset();
        this.running = s === Status.Running ? i : -1;
        return s;
      }
    }
    if (this.running !== -1) this.children[this.running].reset();
    this.running = -1;
    return Status.Failure;
  }
}

export class Inverter<B> extends Node<B> {
  constructor(private child: Node<B>) { super(); }
  tick(bb: B, dt: number): Status { const s = this.child.tick(bb, dt); return s === Status.Success ? Status.Failure : s === Status.Failure ? Status.Success : s; }
  reset(): void { this.child.reset(); }
}

/** Fails while cooling down; starts the cooldown when the child succeeds. */
export class Cooldown<B extends { time: number }> extends Node<B> {
  private readyAt = 0;
  constructor(private seconds: number, private child: Node<B>) { super(); }
  tick(bb: B, dt: number): Status {
    if (bb.time < this.readyAt) return Status.Failure;
    const s = this.child.tick(bb, dt);
    if (s === Status.Success) this.readyAt = bb.time + this.seconds;
    return s;
  }
  reset(): void { this.child.reset(); }
}
