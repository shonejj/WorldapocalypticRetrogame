import { describe, expect, it } from 'vitest';
import { Actor, idleIntent, type ActorHost } from '../src/game/actor';
import { InfectedBrain, type AIWorld } from '../src/game/ai';
import { SURVIVORS } from '../src/game/data';
import { Rng } from '../src/core/rng';

const host: ActorHost = { fire() {}, meleeStrike() {}, clawStrike() {}, footstep() {}, ammo: () => 0, takeAmmo: () => 0, sfx() {}, heal() {} };

function scene(survivorX: number, opts: { crouch?: boolean; light?: number } = {}) {
  const s = new Actor({ x: survivorX, survivor: SURVIVORS[0] });
  const z = new Actor({ x: 10, infected: 'common' });
  z.facing = -1; z.state = 'idle';
  const world: AIWorld = {
    survivors: [s], infected: [z], leader: s, holdPosition: false, holdX: 0, levelWidth: 100, rng: new Rng(1),
    partySlot: () => 0, emitNoise() {}, medkits: () => 0, lightAt: () => opts.light ?? 0.15, ammoFor: () => 0, aiFireAllowed: () => false,
  };
  const brain = new InfectedBrain(() => {}, () => {});
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += 1 / 60) {
      const it = idleIntent(); it.crouch = !!opts.crouch;
      s.step(1 / 60, it, host, 100);
      z.step(1 / 60, brain.think(z, world, 1 / 60), host, 100);
    }
  };
  return { s, z, brain, run };
}

describe('infected perception', () => {
  it('spots a standing survivor in front of it and gives chase', () => {
    const { z, run } = scene(5);
    run(3);
    expect(z.state).toBe('chase');
  });

  it('does not notice a survivor crouching in the dark at the same distance', () => {
    const { z, run } = scene(5, { crouch: true });
    run(3);
    expect(z.state).not.toBe('chase');
  });

  it('ignores a survivor standing behind it at range', () => {
    const { z, run } = scene(16);
    run(3);
    expect(z.state).not.toBe('chase');
  });

  it('turns toward and walks to a noise', () => {
    const { z, brain, run } = scene(40);
    brain.hear(z, 20, 0.8);
    expect(z.state).toBe('investigate');
    expect(z.facing).toBe(1);
    run(2);
    expect(z.x).toBeGreaterThan(10.5);
  });
});
