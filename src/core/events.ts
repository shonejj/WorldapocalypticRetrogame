/** Tiny typed event bus. Gameplay emits; HUD/audio/feel subscribe (game-ui-ux: event-driven, not polled). */
export class Emitter<E extends Record<string, unknown>> {
  private map = new Map<keyof E, Set<(p: never) => void>>();
  on<K extends keyof E>(type: K, fn: (p: E[K]) => void): () => void {
    let s = this.map.get(type);
    if (!s) this.map.set(type, (s = new Set()));
    s.add(fn as (p: never) => void);
    return () => s!.delete(fn as (p: never) => void);
  }
  emit<K extends keyof E>(type: K, payload: E[K]): void {
    const s = this.map.get(type);
    if (s) for (const fn of [...s]) (fn as (p: E[K]) => void)(payload);
  }
  clear(): void { this.map.clear(); }
}
