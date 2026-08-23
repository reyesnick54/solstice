import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HinEconomicValueEngine } from '../../../human-economic-contribution/src/hin-value/index.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { subjectRefFor } from '../../../human-economic-contribution/src/ids.ts';
import { acceptHinIssuanceBasis, hinCannotMint } from './human-contribution-bridge/hin-issuance-basis.ts';

const NOW = asUtcInstant('2026-08-23T12:00:00.000Z');

describe('HIN issuance basis cannot mint SunRey Coin', () => {
  it('accepts an economic-value-input proposal without applying supply', () => {
    const engine = new HinEconomicValueEngine();
    const recorded = engine.submitFromAuthorizedSource(
      {
        subject: subjectRefFor('bridge-ada'),
        category: 'RESEARCH_CONTRIBUTION',
        sourceReference: 'research.bridge.1',
        observedAt: NOW,
        createdAt: NOW,
        quantity: 1n,
        qualityBps: 8_000n,
        confidenceBps: 8_000n,
        purpose: 'AGGREGATED_RESEARCH',
        consentReference: 'consent.bridge.1',
      },
      { kind: 'AUTHORIZED_SOURCE', actorId: 'hin.source' },
    );
    assert.equal(recorded.ok, true);
    if (!recorded.ok) {
      throw new Error('authorized HIN submit failed');
    }
    const verified = engine.verify(recorded.value.contributionId, { kind: 'AUTHORIZED_VERIFIER', actorId: 'hin.verifier' }, NOW);
    assert.equal(verified.ok, true);
    engine.computeValueInput(recorded.value.contributionId, NOW);
    const proposal = engine.proposeIssuanceBasis(recorded.value.contributionId);
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      throw new Error('HIN issuance-basis proposal failed');
    }
    const accepted = acceptHinIssuanceBasis(proposal.value);
    assert.equal(accepted.ok, true);
    if (accepted.ok) {
      assert.equal(accepted.minted, false);
      assert.equal(accepted.sunReyQuantity, null);
      assert.equal(accepted.requiresHumanGovernance, true);
      assert.equal(accepted.draft.status, 'AWAITING_GOVERNANCE');
    }
    assert.equal(engine.authorizeMint().ok, false);
    assert.equal(hinCannotMint().code, 'HIN_CANNOT_MINT');
  });
});
