import { CARRY_LIMIT, ITEMS, RECIPES, type ItemId, type Recipe, type Role } from './data';

/**
 * Shared squad stash (survival-crafting): stacks capped per item, total weight capped,
 * crafting validates inputs AND space before consuming anything (atomic).
 */
export class Stash {
  readonly items = new Map<ItemId, number>();
  constructor(init: Partial<Record<ItemId, number>> = {}, public limit = CARRY_LIMIT) { for (const [k, v] of Object.entries(init)) if (v) this.items.set(k as ItemId, v); }
  count(id: ItemId): number { return this.items.get(id) ?? 0; }
  get weight(): number { let w = 0; for (const [k, v] of this.items) w += ITEMS[k].weight * v; return Math.round(w * 100) / 100; }
  /** How many of `id` fit (stack + weight). */
  room(id: ItemId, extraFree = 0): number {
    const byStack = ITEMS[id].stack - this.count(id);
    const byWeight = Math.floor((this.limit - this.weight + extraFree + 1e-9) / ITEMS[id].weight);
    return Math.max(0, Math.min(byStack, byWeight));
  }
  /** Add up to n; returns how many were added. */
  add(id: ItemId, n: number): number { const k = Math.min(n, this.room(id)); if (k > 0) this.items.set(id, this.count(id) + k); return k; }
  take(id: ItemId, n: number): number { const k = Math.min(n, this.count(id)); if (k > 0) { const left = this.count(id) - k; if (left) this.items.set(id, left); else this.items.delete(id); } return k; }

  canCraft(r: Recipe, roles: Role[]): { ok: boolean; why?: string } {
    if (r.requires && !roles.includes(r.requires)) return { ok: false, why: `Needs the ${r.requires}` };
    for (const [k, n] of Object.entries(r.inputs) as [ItemId, number][]) if (this.count(k) < n) return { ok: false, why: `Missing ${ITEMS[k].name}` };
    let freed = 0; for (const [k, n] of Object.entries(r.inputs) as [ItemId, number][]) freed += ITEMS[k].weight * n;
    const [out, n] = r.output;
    if (ITEMS[out].stack - this.count(out) + (r.inputs[out] ?? 0) < n) return { ok: false, why: 'Stack full' };
    if (this.weight - freed + ITEMS[out].weight * n > this.limit + 1e-9) return { ok: false, why: 'Too heavy to carry' };
    return { ok: true };
  }
  craft(r: Recipe, roles: Role[]): boolean {
    if (!this.canCraft(r, roles).ok) return false;
    for (const [k, n] of Object.entries(r.inputs) as [ItemId, number][]) this.take(k, n);
    this.items.set(r.output[0], this.count(r.output[0]) + r.output[1]);
    return true;
  }
  toJSON(): Partial<Record<ItemId, number>> { return Object.fromEntries(this.items); }
}
export { RECIPES };
