import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  agentCannotExecuteProposal,
  compareAlternatives,
  getGrowthPlan,
  getProposal,
  requestProposalModification,
  type GrowthToolPort,
} from './growth-tools.ts';

const port: GrowthToolPort = {
  getPlan: (id) => (id === 'gmp_known' ? { planId: id } : undefined),
  getProposal: (id) => (id === 'fpr_known' ? { proposalId: id, alternatives: [{ kind: 'KEEP_CASH' }] } : undefined),
  explainProposal: (id) => (id === 'fpr_known' ? { whyThisAction: 'structured' } : undefined),
  modifyProposal: (id, patch) => ({ proposalId: `${id}_v2`, patch }),
  alternatives: (id) => (id === 'fpr_known' ? [{ kind: 'DEFER' }] : undefined),
};

describe('growth proposal agent tools', () => {
  it('reads known plans and refuses fabricated proposal ids', () => {
    assert.equal(getGrowthPlan(port, 'gmp_known').ok, true);
    const fabricated = getProposal(port, 'fpr_invented');
    assert.equal(fabricated.ok, false);
    if (fabricated.ok) throw new Error('expected fabricated');
    assert.equal(fabricated.error.code, 'FABRICATED_PROPOSAL_ID');
    assert.equal(getProposal(port, 'fpr_known').ok, true);
    assert.equal(compareAlternatives(port, 'fpr_known').ok, true);
    assert.equal(requestProposalModification(port, 'fpr_known', { amountMinorUnits: '1' }).ok, true);
    assert.equal(agentCannotExecuteProposal().code, 'AGENT_CANNOT_EXECUTE');
  });
});