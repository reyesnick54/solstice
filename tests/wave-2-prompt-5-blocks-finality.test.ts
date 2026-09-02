import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  TRANSACTION_LIFECYCLE,
  WAVE2_BLOCKS_CAPABILITY,
  bftQuorumSatisfied,
} from '../packages/sunrey-chain/src/blocks/index.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Wave 2 Prompt 5 — blocks, finality, and canonical state', () => {
  it('extends the canonical sunrey-chain owner', () => {
    assert.equal(WAVE2_BLOCKS_CAPABILITY.owner, 'packages/sunrey-chain');
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/src/blocks/engine.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/src/blocks/blocks.test.ts')), true);
    assert.equal(existsSync(join(ROOT, 'docs/architecture/WAVE2_BLOCKS_FINALITY_STATE.md')), true);
    assert.equal(existsSync(join(ROOT, 'packages/blockchain')), false);
    assert.equal(existsSync(join(ROOT, 'packages/blocks')), false);
  });

  it('defines the full transaction lifecycle vocabulary', () => {
    assert.deepEqual(TRANSACTION_LIFECYCLE, [
      'SUBMITTED',
      'PENDING',
      'INCLUDED',
      'EXECUTED',
      'FINALIZED',
      'FAILED',
    ]);
  });

  it('documents BFT deterministic finality', () => {
    const doc = readFileSync(join(ROOT, 'docs/architecture/WAVE2_BLOCKS_FINALITY_STATE.md'), 'utf8');
    assert.match(doc, /SUBMITTED/);
    assert.match(doc, /FINALIZED/);
    assert.match(doc, /commit certificate/i);
    assert.match(doc, /COMMIT_CERTIFICATE|commit certificate/);
    assert.match(doc, /app_hash|resultingStateCommitment/);
    assert.match(doc, /BFT/);
  });

  it('keeps validator quorum semantics for multi-validator tests', () => {
    assert.equal(bftQuorumSatisfied(3n, 4n), true);
    assert.equal(bftQuorumSatisfied(2n, 4n), false);
  });
});
