import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { rotateModelSpace } from '../src/art/skinned';

describe('procedural bone offsets', () => {
  it('do not accumulate when the mixer skips writing an unchanged bone', () => {
    // model → (turned) parent → bone; the mixer "writes" nothing each frame (constant track)
    const model = new THREE.Group(), parent = new THREE.Group(), bone = new THREE.Object3D();
    parent.quaternion.setFromEuler(new THREE.Euler(0.3, 0.8, 0)); model.add(parent); parent.add(bone);
    const base = bone.quaternion.clone(), undo = new Map<THREE.Object3D, THREE.Quaternion>();
    for (let frame = 0; frame < 120; frame++) {
      for (const [b, q] of undo) b.quaternion.copy(q);   // what SkinnedView.animate does before mixer.update
      undo.clear();
      rotateModelSpace(bone, model, new THREE.Vector3(1, 0, 0), 0.12, undo);
    }
    expect(bone.quaternion.angleTo(base)).toBeCloseTo(0.12, 3);   // one offset, not 120 of them
  });
});
