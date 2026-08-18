import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  CANDIDATE_V2_CHAIN_ID,
  CANDIDATE_V2_ID,
  CANDIDATE_V2_NETWORK_ID,
  createProductionNetworkCandidateV2,
  verifyProductionNetworkCandidateV2,
} from '../packages/sunrey-chain/src/mainnet/candidate-v2/index.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Chunk 81 repository declaration', () => {
  it('declares docs, owner path, and forbids competing packages', () => {
    assert.equal(existsSync(join(ROOT, 'docs/mainnet/chunk-81-production-network-candidate-v2.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/mainnet/production-network-manifest.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/mainnet/production-topology.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/mainnet/production-service-manifest.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/mainnet/production-candidate-comparison.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/architecture/chunks/chunk-81-production-network-candidate-v2.json')), true);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/src/mainnet/candidate-v2/index.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/production-network')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-production-network')), false);
    assert.equal(existsSync(join(ROOT, 'packages/candidate-v2')), false);
    assert.equal(existsSync(join(ROOT, 'packages/mainnet-v2')), false);
  });

  it('verifies the assembled candidate without authorizing production', () => {
    const candidate = createProductionNetworkCandidateV2(ROOT);
    assert.equal(candidate.candidateId, CANDIDATE_V2_ID);
    assert.equal(candidate.configuration.networkId, CANDIDATE_V2_NETWORK_ID);
    assert.equal(candidate.configuration.chainId, CANDIDATE_V2_CHAIN_ID);
    assert.equal(candidate.productionAuthorized, false);
    const report = verifyProductionNetworkCandidateV2(candidate, ROOT);
    assert.equal(report.ok, true);
    assert.equal(report.productionAuthorized, false);
  });
});
