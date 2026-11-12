import { describe, expect, it } from 'vitest';
import { HOUSES } from '../src/house/plans';
import { NOTES } from '../src/game/data';
import { CAMPAIGN } from '../src/game/campaign';

const SOLID = new Set(['#', 'w', ' ', 'T', 'S', 'B', 'K', 'H']);
describe('3D houses', () => {
  for (const h of Object.values(HOUSES)) {
    it(`${h.id}: rectangular, one entrance, every spot and locked door reachable`, () => {
      const W = h.plan[0].length;
      expect(h.plan.every((r) => r.length === W)).toBe(true);
      const cells = h.plan.flatMap((r, j) => [...r].map((c, i) => ({ c, i, j })));
      const start = cells.filter((q) => q.c === 'P');
      expect(start).toHaveLength(1);
      // flood fill from the entrance, treating locked doors as openable
      const seen = new Set<string>(), q = [[start[0].i, start[0].j]];
      while (q.length) {
        const [i, j] = q.pop()!; const k = `${i},${j}`; if (seen.has(k)) continue; seen.add(k);
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = h.plan[j + dj]?.[i + di]; if (c !== undefined && !SOLID.has(c) && !h.spots[c]) q.push([i + di, j + dj]); }
      }
      const near = (i: number, j: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => seen.has(`${i + di},${j + dj}`));
      for (const key of Object.keys(h.spots)) {
        const at = cells.find((q) => q.c === key);
        expect(at, `spot ${key}`).toBeTruthy();
        expect(near(at!.i, at!.j), `spot ${key} reachable`).toBe(true);
        const n = h.spots[key].note; if (n) expect(NOTES[n]).toBeTruthy();
      }
    });
  }
  it('every house is entered from some chapter', () => {
    const used = new Set(CAMPAIGN.flatMap((l) => l.caches.map((c) => c.house).filter(Boolean)));
    for (const id of Object.keys(HOUSES)) expect(used.has(id)).toBe(true);
  });
});
