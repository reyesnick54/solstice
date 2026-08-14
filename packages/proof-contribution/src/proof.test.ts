import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  asActionIntentId,
  asActorId,
  asIdempotencyKey,
  asUtcInstant,
} from '@solstice/domain';
import { ComplianceKernel, freezeIntent } from '@solstice/kernel';
import { SimulatedChain } from '@solstice/chain-gateway';
import { ProofOfContributionRegistry } from './proof.ts';

const NOW = asUtcInstant('2026-08-14T16:00:00.000Z');

describe('Proof of Contribution', () => {
  it('verifies independently and contains no raw data', () => {
    const kernel = new ComplianceKernel();
    const chain = new SimulatedChain();
    const registry = new ProofOfContributionRegistry();
    const evaluated = kernel.evaluate(
      freezeIntent({
        id: asActionIntentId('int_poc'),
        kind: 'ISSUE_PROOF_OF_CONTRIBUTION',
        actor: { type: 'SYSTEM', id: asActorId('system') },
        payload: { contributionId: 'contrib_1' },
        idempotencyKey: asIdempotencyKey('idem_poc'),
        occurredAt: NOW,
        sourceJurisdiction: 'US',
      }),
    );
    assert.equal(evaluated.ok, true);
    if (!evaluated.ok || evaluated.value.outcome !== 'AUTHORIZED') {
      throw new Error('expected AUTHORIZED');
    }
    const proof = registry.issue(evaluated.value.authorization, {
      contributionId: 'contrib_1',
      consentReference: 'consent_jane_req',
      buyer: 'sponsor_demo_wellness_lab',
      purpose: 'wellness cohort aggregate research (simulation)',
      dataCategories: ['WELLNESS'],
      computeJobReference: 'job_req_wellness_cohort_us',
      completionState: 'COMPLETED',
      compensationMinorUnits: 5000n,
      pyrSettlementReference: 'settle_1',
      at: NOW,
      seal: (payload, at) => kernel.vault.seal(payload, at),
      chain,
    });
    assert.equal(proof.compensationAsset, 'PYR');
    assert.equal('raw' in proof, false);
    assert.equal('personalData' in proof, false);
    const tx = chain.query(proof.chainTxId);
    assert.equal(tx?.reference.kind, 'HASH');
    assert.equal(tx?.reference.value, proof.cryptographicHash);
    const ids = new Set(kernel.vault.list().map((row) => row.id));
    const verified = registry.verify(proof, chain, ids);
    assert.equal(verified.ok, true);
  });
});
