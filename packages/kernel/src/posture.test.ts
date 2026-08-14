import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { escalate, foldPostures, POSTURE_RANK, wouldRelax, type Posture } from './posture.ts';

describe('monotonic posture escalation', () => {
  const postures: readonly Posture[] = ['CLEAR', 'REVIEW', 'HOLD', 'BLOCK'];

  it('escalate never returns a weaker posture', () => {
    for (const current of postures) {
      for (const incoming of postures) {
        const next = escalate(current, incoming);
        assert.ok(
          POSTURE_RANK[next] >= POSTURE_RANK[current],
          `escalate(${current}, ${incoming}) relaxed to ${next}`,
        );
      }
    }
  });

  it('once BLOCK, later CLEAR cannot relax', () => {
    const afterBlock = escalate('BLOCK', 'CLEAR');
    assert.equal(afterBlock, 'BLOCK');
    assert.equal(wouldRelax('BLOCK', 'CLEAR'), true);
    assert.equal(escalate(afterBlock, 'REVIEW'), 'BLOCK');
    assert.equal(escalate(afterBlock, 'HOLD'), 'BLOCK');
  });

  it('HOLD cannot be relaxed to REVIEW or CLEAR', () => {
    assert.equal(escalate('HOLD', 'REVIEW'), 'HOLD');
    assert.equal(escalate('HOLD', 'CLEAR'), 'HOLD');
    assert.equal(escalate('HOLD', 'BLOCK'), 'BLOCK');
  });

  it('foldPostures is order-independent for the max', () => {
    const a = foldPostures(['CLEAR', 'REVIEW', 'BLOCK', 'CLEAR']);
    const b = foldPostures(['BLOCK', 'CLEAR', 'REVIEW']);
    const c = foldPostures(['REVIEW', 'CLEAR', 'HOLD', 'BLOCK']);
    assert.equal(a, 'BLOCK');
    assert.equal(b, 'BLOCK');
    assert.equal(c, 'BLOCK');
  });

  it('CLEAR then REVIEW stays REVIEW', () => {
    assert.equal(escalate('CLEAR', 'REVIEW'), 'REVIEW');
    assert.equal(escalate('REVIEW', 'CLEAR'), 'REVIEW');
  });
});
