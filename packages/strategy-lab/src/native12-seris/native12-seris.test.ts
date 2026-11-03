import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isValidSerisStyleStrategyName, reviewStrategySource } from './source-review.ts';
import { SERIS_NATIVE12_PIPELINE_STAGES } from './taxonomy.ts';

describe('native12 seris assimilation guards', () => {
  it('enforces Seris-style strategy naming', () => {
    assert.equal(isValidSerisStyleStrategyName('ma-trail-stop'), true);
    assert.equal(isValidSerisStyleStrategyName('Bad_Name'), false);
  });

  it('declares full research pipeline stage order', () => {
    assert.deepEqual([...SERIS_NATIVE12_PIPELINE_STAGES], [
      'AI_PROPOSAL',
      'GENOME_VALIDATION',
      'FEATURE_VALIDITY',
      'HISTORICAL_TEST',
      'HOLDOUT',
      'WALK_FORWARD',
      'SHADOW',
      'PAPER',
    ]);
  });

  it('rejects deploy from source review', () => {
    const review = reviewStrategySource({
      strategyName: 'demo-strategy',
      researchAgentRef: 'agent/research/x',
      deployRequested: true,
    });
    assert.equal(review.ok, false);
  });
});
