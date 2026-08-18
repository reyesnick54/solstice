import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AGENT_MANDATE_SAFETY, createAgentMandateSafetyModel, exploreAgentMandateSafety } from './formal.ts';

describe('AGENT_MANDATE_SAFETY', () => {
  it('explores without counterexample', () => {
    const result = exploreAgentMandateSafety();
    assert.equal(result.modelId, AGENT_MANDATE_SAFETY);
    assert.equal(result.verified, true);
    assert.ok(result.states > 1);
  });

  it('forbids expansion, overspend, unapproved asset/market, revoked auth, AI sign, and human bypass', () => {
    const model = createAgentMandateSafetyModel();
    for (const transition of model.next(model.init)) {
      if (
        transition.name === 'ExpandMandate' ||
        transition.name === 'ExceedBudget' ||
        transition.name === 'UseUnapprovedAsset' ||
        transition.name === 'UseUnapprovedMarket' ||
        transition.name === 'UseRevokedMandate' ||
        transition.name === 'AiIdentitySign' ||
        transition.name === 'ExecuteWithoutHuman'
      ) {
        assert.equal(transition.next, null, transition.name);
      }
    }
  });
});
