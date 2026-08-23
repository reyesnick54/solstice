import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AGENT_SAFETY_INVARIANT_IDS } from './productization/taxonomy.ts';
import { evaluateAllSafetyInvariants, evaluateSafetyInvariant, invariantFixture } from './productization/invariants.ts';

describe('Phase F safety invariants', () => {
  it('implements the required invariant catalog', () => {
    assert.equal(AGENT_SAFETY_INVARIANT_IDS.length, 20);
    const clean = evaluateAllSafetyInvariants(invariantFixture());
    assert.equal(clean.ok, true);
    if (clean.ok) {
      assert.equal(clean.value.length, 20);
    }
  });

  it('refuses ledger posting, self-approval, Kernel bypass, and production activation', () => {
    assert.equal(evaluateSafetyInvariant('AGENT_CANNOT_POST_LEDGER_ENTRY', invariantFixture({ attemptingLedgerPost: true })).ok, false);
    assert.equal(
      evaluateSafetyInvariant(
        'AGENT_CANNOT_SELF_APPROVE',
        invariantFixture({
          actors: {
            humanRequesterId: 'user_a',
            agentActorId: 'agt_a',
            mandateId: 'man_a',
            proposalId: 'prp_a',
            approverId: 'agt_a',
            approverKind: 'AGENT',
          },
        }),
      ).ok,
      false,
    );
    assert.equal(
      evaluateSafetyInvariant('AGENT_CANNOT_BYPASS_KERNEL', invariantFixture({ attemptingMutation: true, kernelSubmitted: false })).ok,
      false,
    );
    assert.equal(
      evaluateSafetyInvariant('AGENT_CANNOT_ACTIVATE_PRODUCTION', invariantFixture({ attemptingProductionActivation: true })).ok,
      false,
    );
  });

  it('refuses cross-user access, invented money, KYC override, and Agent-marked completion', () => {
    assert.equal(
      evaluateSafetyInvariant('AGENT_CANNOT_ACCESS_OTHER_USER_RESOURCE', invariantFixture({ requestedUserId: 'user_b' })).ok,
      false,
    );
    assert.equal(evaluateSafetyInvariant('AGENT_CANNOT_INVENT_FINANCIAL_NUMBERS', invariantFixture({ inventedMoney: true })).ok, false);
    assert.equal(evaluateSafetyInvariant('AGENT_CANNOT_OVERRIDE_KYC', invariantFixture({ attemptingKycOverride: true })).ok, false);
    assert.equal(
      evaluateSafetyInvariant('AGENT_CANNOT_MARK_FINANCIAL_ACTION_COMPLETE', invariantFixture({ attemptingSelfComplete: true })).ok,
      false,
    );
    assert.equal(
      evaluateSafetyInvariant('AGENT_CANNOT_ISSUE_EXECUTION_AUTHORITY', invariantFixture({ issuerIsAgent: true })).ok,
      false,
    );
  });
});
