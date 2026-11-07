import { STORAGE_NAMESPACE } from '../config/game';

/**
 * Persistence (save-systems):
 * - JSON with an explicit `version` and an ordered migration chain.
 * - "Atomic" write for localStorage: write key.tmp → verify parse → copy current to key.bak →
 *   promote tmp. A crash leaves either the old save, the new one, or the .bak.
 * - Defensive load: main → .bak; validate; migrate; refuse newer versions.
 * - Never throws: private mode / quota errors are reported, not fatal.
 */
const k = (key: string) => `${STORAGE_NAMESPACE}:${key}`;
const ls = (): Storage | null => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export const raw = {
  get(key: string): string | null { try { return ls()?.getItem(k(key)) ?? null; } catch { return null; } },
  set(key: string, v: string): boolean { try { ls()?.setItem(k(key), v); return !!ls(); } catch { return false; } },
  del(key: string): void { try { ls()?.removeItem(k(key)); } catch { /* ignore */ } },
};

export type Migration = (d: Record<string, unknown>) => Record<string, unknown>;

export interface Versioned { version: number }

export function writeAtomic(key: string, data: Versioned): boolean {
  const json = JSON.stringify(data);
  if (!raw.set(`${key}.tmp`, json)) return false;
  try { JSON.parse(raw.get(`${key}.tmp`) ?? ''); } catch { return false; }
  const prev = raw.get(key);
  if (prev) raw.set(`${key}.bak`, prev);
  const ok = raw.set(key, json);
  raw.del(`${key}.tmp`);
  return ok;
}

export class NewerSaveError extends Error {}

export function readVersioned<T extends Versioned>(key: string, current: number, migrations: Record<number, Migration>,
  validate: (d: unknown) => d is T): T | null {
  for (const candidate of [key, `${key}.bak`]) {
    const text = raw.get(candidate);
    if (!text) continue;
    try {
      let d = JSON.parse(text) as Record<string, unknown>;
      let v = Number(d.version ?? 1);
      if (v > current) throw new NewerSaveError(`save v${v} is newer than game v${current}`);
      while (v < current) { const m = migrations[v]; if (!m) break; d = m(d); v++; d.version = v; }
      if (v === current && validate(d)) return d as T;
    } catch (e) { if (e instanceof NewerSaveError) throw e; /* corrupt → try .bak */ }
  }
  return null;
}

/** Simple non-critical prefs (settings, bindings): merge onto defaults. */
export function readPrefs<T extends object>(key: string, defaults: T): T {
  try { const t = raw.get(key); return t ? { ...defaults, ...JSON.parse(t) } : { ...defaults }; } catch { return { ...defaults }; }
}
export const writePrefs = (key: string, v: unknown) => raw.set(key, JSON.stringify(v));
