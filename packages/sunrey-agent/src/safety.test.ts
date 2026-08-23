import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import {
  asUserAgentId,
  asUserAgentMandateId,
  asAgentProposalRefId,
  asMandatePolicyVersion,
} from './ids.ts';
import { assertAgentCannotSelfApprove, evaluateAgentHumanApproval } from './safety.ts';
import type { AgentTransactionProposal, UserAgentMandate } from './types.ts';

const NOW = asUtcInstant('2026-08-21T12:00:00.000Z');

function mandate(): UserAgentMandate {
  return {
    mandateId: asUserAgentMandateId('man_1'),
    agentId: asUserAgentId('agt_1'),
    owner: { kind: 'USER', ownerId: 'user_1', walletId: 'wallet_1', accountId: 'acct_1' },
    state: 'ACTIVE',
    assistScopes: ['READ_ACCOUNTS'],
    policy: {
      policyVersion: asMandatePolicyVersion(1),
      mode: 'PRODUCTION',
      environment: 'simulation',
      riskPolicyId: 'risk:sim',
      jurisdictionPackId: 'GB',
      frequencyMaxPerPeriod: 3,
      expiry: asUtcInstant('2030-01-01T00:00:00.000Z'),
      approval: { class: 'MOBILE_CONFIRMATION', highRiskAlwaysHuman: true },
      delegatedSigningKeyId: null,
      revocationPolicy: 'FUTURE_AUTHORIZATION_ONLY',
      pendingAfterRevocation: 'INELIGIBLE',
    },
    permissions: {
      actionClasses: ['EXECUTE_PREAPPROVED_PAYMENT'],
      assets: [{ assetId: 'SUNREY_COIN', wildcard: false }],
      markets: [],
      destinations: [{ kind: 'SPECIFIC_ADDRESS', destinationId: 'dest_1' }],
      humanInformationAccess: false,
      allowWildcardAssets: false,
    },
    budget: {
      perTransaction: 10n,
      perPeriod: 10n,
      periodHours: 24,
      perAsset: {},
      perMarket: {},
      perActionClass: {},
    },
    createdByActorId: 'user_1',
    createdAt: NOW,
    mandateHash: 'hash_1',
  };
}

function proposal(): AgentTransactionProposal {
  return {
    proposalId: asAgentProposalRefId('prp_1'),
    mandateId: asUserAgentMandateId('man_1'),
    mandateHash: 'hash_1',
    policyVersion: asMandatePolicyVersion(1),
    agentId: asUserAgentId('agt_1'),
    intent: 'EXECUTE_PREAPPROVED_PAYMENT',
    reasonCode: 'pay',
    strategyRef: null,
    assetId: 'SUNREY_COIN',
    quantity: 1n,
    destinationOrMarket: 'dest_1',
    fees: 0n,
    riskCheckIds: [],
    expectedOutcomeClass: 'PAYMENT_SUBMITTED_FOR_AUTHORIZATION',
    modelRef: 'model:sim',
    operationalRationale: 'bounded payment',
    guaranteedReturn: false,
    createdAt: NOW,
    state: 'PENDING_APPROVAL',
    proposalHash: 'phash',
    walletId: 'wallet_1',
    networkId: 'net_sim',
  };
}

describe('Agent safety boundary', () => {
  it('refuses an Agent that tries to approve its own proposal', () => {
    const self = assertAgentCannotSelfApprove({
      humanRequesterId: 'user_1',
      agentActorId: 'agt_1',
      mandateId: 'man_1',
      proposalId: 'prp_1',
      approverId: 'agt_1',
      approverKind: 'AGENT',
    });
    assert.equal(self.ok, false);
    if (!self.ok) {
      assert.equal(self.error.code, 'AGENT_CANNOT_SELF_APPROVE');
    }
    const human = evaluateAgentHumanApproval({
      mandate: mandate(),
      proposal: proposal(),
      humanApproved: true,
      actors: {
        humanRequesterId: 'user_1',
        agentActorId: 'agt_1',
        mandateId: 'man_1',
        proposalId: 'prp_1',
        approverId: 'user_1',
        approverKind: 'HUMAN',
      },
    });
    assert.equal(human.ok, true);
  });
});
