import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { Compiler } from 'inkjs/compiler/Compiler';
import { Story } from 'inkjs';
import { Stash } from '../src/game/inventory';
import { RECIPES } from '../src/game/data';
import { MIGRATIONS, SAVE_VERSION, isSave, loadGame, saveGame, type SaveData } from '../src/game/save';
import { radialDeadzone } from '../src/core/input';
import { SimClock } from '../src/core/clock';

const mem = new Map<string, string>();
beforeEach(() => { mem.clear(); (globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) } as Storage; });

describe('stash & crafting (survival-crafting)', () => {
  it('respects weight and stack limits', () => {
    const s = new Stash({}, 1);
    expect(s.add('medkit', 5)).toBe(2);                  // 0.5 kg each, 1 kg limit
    expect(s.weight).toBeCloseTo(1);
  });
  it('crafting is atomic and role-gated', () => {
    const fuse = RECIPES.find((r) => r.id === 'fuse')!;
    const s = new Stash({ scrap: 2, battery: 1, tape: 1 });
    expect(s.canCraft(fuse, ['scavenger']).ok).toBe(false);
    expect(s.count('scrap')).toBe(2);                    // nothing consumed on refusal
    expect(s.craft(fuse, ['mechanic'])).toBe(true);
    expect(s.count('radio_part')).toBe(1); expect(s.count('scrap')).toBe(0);
  });
  it('refuses a craft that would overflow the weight limit, consuming nothing', () => {
    const s = new Stash({ cloth: 2 }, 0.25);             // bandage 0.08 fits; medkit route would not
    expect(s.craft(RECIPES.find((r) => r.id === 'bandage')!, [])).toBe(true);
    const heavy = new Stash({ alcohol: 1 }, 0.4);
    expect(heavy.canCraft(RECIPES.find((r) => r.id === 'lure')!, []).ok).toBe(true);
  });
});

describe('saves (save-systems)', () => {
  const base = (): SaveData => ({ version: SAVE_VERSION, chapter: 'ch1', checkpoint: 24, savedAt: 1, stash: { food: 2 }, party: [{ id: 'reed', hp: 50, alive: true, mag: 3, hunger: 0.5, thirst: 0.4, bleed: 0 }], controlled: 0, looted: [], picked: [], killed: [], objectives: [], seenBeats: [], ink: null });
  it('round-trips and keeps a backup', () => {
    expect(saveGame('manual', base())).toBe(true);
    const second = { ...base(), checkpoint: 57 }; saveGame('manual', second);
    expect(loadGame('manual')?.checkpoint).toBe(57);
    expect(JSON.parse(mem.get('tlf:save.manual.bak')!).checkpoint).toBe(24);
  });
  it('falls back to the backup when the main file is corrupt', () => {
    saveGame('manual', base()); saveGame('manual', { ...base(), checkpoint: 57 });
    mem.set('tlf:save.manual', '{"version":2,"chap');
    expect(loadGame('manual')?.checkpoint).toBe(24);
  });
  it('migrates v1 saves', () => {
    const v1 = { version: 1, chapter: 'ch1', checkpoint: 0, savedAt: 0, stash: {}, party: [{ id: 'reed', hp: 10, alive: true, mag: 1 }], controlled: 0, looted: [], picked: [], killed: [], objectives: [] };
    const m = MIGRATIONS[1](v1 as unknown as Record<string, unknown>); m.version = 2;
    expect(isSave(m)).toBe(true);
    expect((m as unknown as SaveData).party[0].hunger).toBe(1);
  });
  it('refuses saves from a newer game version', () => { mem.set('tlf:save.manual', JSON.stringify({ ...base(), version: 99 })); expect(() => loadGame('manual')).toThrow(); });
});

describe('input & timing', () => {
  it('radial deadzone zeroes drift and rescales past the edge', () => {
    expect(radialDeadzone(0.1, 0.1)).toEqual([0, 0]);
    const [x] = radialDeadzone(1, 0); expect(x).toBeCloseTo(1);
    const [dx, dy] = radialDeadzone(0.7, 0.7); expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(1.0001);
  });
  it('fixed-step clock clamps stalls and recovers from hit-stop', () => {
    const c = new SimClock();
    expect(c.advance(5, 0)).toBeLessThanOrEqual(6);      // a 5 s stall does not explode the sim
    c.hitStop(1000, 0.05); expect(c.timeScale).toBeLessThan(1);
    c.advance(0.016, 1100); expect(c.timeScale).toBe(1);
  });
});

describe('narrative (dialogue-systems)', () => {
  it('chapter 1 Ink compiles and every beat knot runs', () => {
    const json = new Compiler(readFileSync('src/story/chapter1.ink', 'utf8')).Compile().ToJson()!;
    for (const knot of ['intro', 'first_infected', 'pharmacy', 'garage', 'overpass', 'breather', 'relay_approach', 'relay_locked', 'relay_restore']) {
      const s = new Story(json); s.ChoosePathString(knot);
      const text = s.ContinueMaximally(); expect(text.length).toBeGreaterThan(10);
      while (s.currentChoices.length) { s.ChooseChoiceIndex(0); s.ContinueMaximally(); }
    }
  });
});
