import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { runMainnetCommand, runMainnetCandidateRehearsal } from '../packages/sunrey-chain/src/mainnet/index.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Chunk 65 exit criteria', () => {
  it('runs the simulation rehearsal without launching production', () => {
    const rehearsal = runMainnetCandidateRehearsal(ROOT);
    assert.equal(rehearsal.deterministic, true);
    assert.equal(rehearsal.productionServicesActivated, false);
    assert.equal(rehearsal.evidenceIncomplete, true);
    assert.equal(rehearsal.validatorCount, 7);
    assert.match(rehearsal.genesisHash, /^[0-9a-f]{64}$/);
  });

  it('exposes the readiness CLI', () => {
    const readiness = runMainnetCommand(['readiness']);
    assert.equal(readiness.ok, true);
    const plan = runMainnetCommand(['activation-plan']);
    assert.equal(plan.ok, true);
  });

  it('publishes the required documentation', () => {
    for (const relative of [
      'docs/mainnet/chunk-65-readiness.md',
      'docs/mainnet/readiness-framework.md',
      'docs/mainnet/genesis-candidate.md',
      'docs/mainnet/validator-candidates.md',
      'docs/mainnet/asset-allocation.md',
      'docs/mainnet/capability-activation.md',
      'docs/mainnet/external-evidence.md',
      'docs/mainnet/activation-plan.md',
      'docs/architecture/chunk-65-mainnet-readiness.md',
      'docs/architecture/chunks/chunk-65-mainnet-readiness.json',
    ]) {
      assert.equal(existsSync(join(ROOT, relative)), true, relative);
    }
    assert.equal(existsSync(join(ROOT, 'packages/mainnet')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-mainnet')), false);
  });
});
