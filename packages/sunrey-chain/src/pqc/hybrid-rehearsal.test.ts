import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { containsPrivateMaterial } from '../wallet/keys.ts';
import { runCryptoCommand } from '../ops/crypto-cli.ts';
import { assertP2pMessageBound } from './consensus-bounds.ts';
import { runHybridTestnetRehearsal } from './hybrid-rehearsal.ts';

describe('Chunk 60 hybrid testnet rehearsal', () => {
  it('finalizes seven validators through the hybrid migration and rejects downgrade', () => {
    const report = runHybridTestnetRehearsal();
    assert.equal(report.phases.length, 7);
    assert.equal(report.identicalBlocks, true);
    assert.equal(report.identicalCryptoPolicy, true);
    assert.equal(report.identicalStateRoots, true);
    assert.equal(report.governanceAiCannotVote, true);
    assert.equal(report.governanceHybridScheduled, true);
    assert.equal(report.wrongSuiteRejected, true);
    assert.equal(report.historicalVerifyRetained, true);
    assert.equal(report.providerFailureFailClosed, true);
    assert.equal(report.p2pOversizedRejected, true);
    assert.equal(report.multiAuthHeterogeneous, true);
    assert.ok(report.downgradeRejected.includes('missing-pq-component'));
    assert.ok(report.downgradeRejected.includes('classical-only-during-hybrid-required'));
    assert.ok(report.downgradeRejected.includes('changed-algorithm-id'));
    assert.ok(report.walletTransfers.length === 3);
    assert.ok(report.oracleFacts.some((fact) => fact.provider === 'ora_a' && fact.suite === 'sunrey-ed25519-v1' && fact.admitted === false));
    assert.ok(report.oracleFacts.some((fact) => fact.suite === 'sunrey-hybrid-ed25519-mldsa-v1' && fact.admitted === true));
    assert.equal(report.sizes.mlDsaSignatureBytes, 3309);
    assert.equal(containsPrivateMaterial(JSON.stringify(report)), false);
    assert.match(report.claimLanguage, /standardized post-quantum/);
    assert.equal(/quantum-proof|unbreakable|fully quantum secure/i.test(JSON.stringify(report)), false);
  });

  it('exposes crypto CLI surfaces without private keys', () => {
    const suites = runCryptoCommand(['suites']);
    const policy = runCryptoCommand(['policy', '40']);
    const inventory = runCryptoCommand(['inventory']);
    const readiness = runCryptoCommand(['readiness']);
    assert.equal(suites.ok, true);
    assert.equal(policy.ok, true);
    assert.equal(inventory.ok, true);
    assert.equal(readiness.ok, true);
    const text = JSON.stringify({ suites, policy, inventory, readiness });
    assert.equal(containsPrivateMaterial(text), false);
    assert.match(text, /noble-post-quantum-0.5.4/);
    assert.match(text, /HYBRID_REQUIRED_SELECTED_ROLES/);
  });

  it('rejects oversized P2P PQ messages', () => {
    const ok = assertP2pMessageBound('ok');
    const bad = assertP2pMessageBound('x'.repeat(1_048_577));
    assert.equal(ok.ok, true);
    assert.equal(bad.ok, false);
  });
});
