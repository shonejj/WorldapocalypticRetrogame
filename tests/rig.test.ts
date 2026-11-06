import { describe, expect, it } from 'vitest';
import { DIMS, PART_ORDER, solve, targetPose, zeroPose, type AnimInput } from '../src/game/rig';

const anim = (o: Partial<AnimInput> = {}): AnimInput => ({ speed: 0, run: false, crouch: false, aim: false, hold: 'none', meleeT: -1, recoil: 0, hurt: 0, attackT: -1, time: 0, phase: 0, gait: 'human', dormant: false, lean: 0, ...o });

describe('rig forward kinematics', () => {
  it('standing pose puts the hips at full leg length and the head on top', () => {
    const s = solve(zeroPose(), 1, 1);
    expect(s.hipY).toBeCloseTo(DIMS.uLegF.len + DIMS.lLegF.len, 5);
    expect(s.head.y).toBeGreaterThan(s.torso.y + 0.5);
  });

  it('the lowest foot always touches the ground, whatever the pose', () => {
    for (const o of [{ speed: 1.5, phase: 0.7 }, { speed: 4, run: true, phase: 2.1 }, { crouch: true }, { dormant: true }]) {
      const p = targetPose(anim(o));
      const s = solve(p, 1, 1);
      const foot = (l: 'lLegF' | 'lLegB') => s[l].y - DIMS[l].len * Math.cos(s[l].a);
      expect(Math.min(foot('lLegF'), foot('lLegB')) - p.bob).toBeCloseTo(0, 5);
    }
  });

  it('facing left mirrors x and negates angles', () => {
    const p = targetPose(anim({ speed: 1.5, phase: 1.2, aim: true, hold: 'pistol' }));
    const r = solve(p, 1, 1), l = solve(p, 1, -1);
    for (const n of PART_ORDER) { expect(l[n].x).toBeCloseTo(-r[n].x, 6); expect(l[n].a).toBeCloseTo(-r[n].a, 6); expect(l[n].y).toBeCloseTo(r[n].y, 6); }
  });

  it('pistol aim holds the trigger arm horizontal', () => {
    const s = solve(targetPose(anim({ aim: true, hold: 'pistol' })), 1, 1);
    expect(s.uArmF.a).toBeCloseTo(Math.PI / 2, 1);
  });
});
