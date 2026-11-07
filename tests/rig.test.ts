import { describe, expect, it } from 'vitest';
import { PARTS, SEG, hipHeight, solve, targetPose, type AnimIn } from '../src/game/rig';

const anim = (o: Partial<AnimIn> = {}): AnimIn => ({ t: 0, phase: 0, speed: 0, run: false, crouch: false, gait: 'survivor', stance: 'none', aim: 0, recoil: 0, melee: 0, reload: 0, heal: 0, hurt: 0, attack: 0, throwT: 0, dormant: false, drawn: false, ...o });

describe('rig', () => {
  it('standing pose has full leg height and the head above the torso', () => {
    const s = solve(targetPose(anim()));
    expect(s.hipY).toBeGreaterThan(0.9); expect(s.hipY).toBeLessThan(0.97);
    expect(s.head.y).toBeCloseTo(s.hipY + SEG.torso * Math.cos(s.torso.a), 3);
  });
  it('keeps the lowest foot on the ground for every gait', () => {
    for (const o of [{ speed: 1.6, phase: 0.8 }, { speed: 4.2, run: true, phase: 2.1 }, { crouch: true }, { gait: 'shamble' as const, speed: 0.7, phase: 1 }, { gait: 'sprint' as const, speed: 4.5, run: true, phase: 3 }]) {
      const p = targetPose(anim(o)), s = solve(p);
      const foot = (sh: 'shinF' | 'shinB') => s[sh].y - SEG.shin * Math.cos(s[sh].a) - SEG.ankle;
      expect(Math.min(foot('shinF'), foot('shinB')) - p.bob).toBeCloseTo(0, 5);
      expect(hipHeight(p)).toBeCloseTo(s.hipY, 6);
    }
  });
  it('aiming a long gun raises the weapon to horizontal', () => {
    expect(Math.abs(targetPose(anim({ stance: 'long', aim: 1, drawn: true })).gun)).toBeLessThan(0.05);
    expect(targetPose(anim({ stance: 'long', aim: 0, drawn: true })).gun).toBeLessThan(-0.4);
  });
  it('produces every part', () => { const s = solve(targetPose(anim())); for (const p of PARTS) expect(Number.isFinite(s[p].x + s[p].y + s[p].a)).toBe(true); });
});
