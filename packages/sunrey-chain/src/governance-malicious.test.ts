import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { developmentGovernancePolicy, createDraftPlan, validateProposal } from './governance/engine.ts';
import type { UpgradePlan } from './governance/types.ts';

function plan(payload: Readonly<Record<string, unknown>>, kind: UpgradePlan['upgradeKind'] = 'PARAMETER_CHANGE'): UpgradePlan {
  const policy = developmentGovernancePolicy();
  return createDraftPlan({
    upgradeId: `upg_${Object.keys(payload)[0] ?? 'x'}`,
    upgradeKind: kind,
    currentProtocolVersion: 1,
    targetProtocolVersion: 1,
    proposalHeight: 1,
    activationHeight: 8,
    policy,
    payload,
  });
}

describe('malicious upgrade refusals', () => {
  const policy = developmentGovernancePolicy();

  it('rejects enabling the production-network flag through an arbitrary payload', () => {
    assert.match(
      validateProposal(plan({ production_network_enabled: true }), policy, 1, 1) ?? '',
      /forbidden/,
    );
  });

  it('rejects customer ledger authority changes', () => {
    assert.match(
      validateProposal(plan({ CUSTOMER_LEDGER_AUTHORITY: 'kernel-bypass' }), policy, 1, 1) ?? '',
      /forbidden/,
    );
  });

  it('rejects granting AI governance rights', () => {
    assert.match(validateProposal(plan({ AI_GOVERNANCE: true }), policy, 1, 1) ?? '', /forbidden/);
  });

  it('rejects Evidence Vault replacement', () => {
    assert.match(
      validateProposal(plan({ EVIDENCE_VAULT_REPLACEMENT: 'other' }), policy, 1, 1) ?? '',
      /forbidden/,
    );
  });

  it('rejects disabling signature verification', () => {
    assert.match(
      validateProposal(plan({ DISABLE_SIGNATURE_VERIFICATION: true }), policy, 1, 1) ?? '',
      /forbidden/,
    );
  });

  it('rejects an unknown CryptoSuite', () => {
    const drafted = createDraftPlan({
      upgradeId: 'upg_unknown_suite',
      upgradeKind: 'CRYPTO_POLICY_CHANGE',
      currentProtocolVersion: 1,
      targetProtocolVersion: 1,
      proposalHeight: 1,
      activationHeight: 8,
      policy,
      cryptoSchedule: {
        suiteId: 'cs_unknown_invented',
        targetState: 'AVAILABLE',
        activationHeight: 8,
        preserveHistoricalVerify: true,
      },
    });
    assert.match(validateProposal(drafted, policy, 1, 1) ?? '', /unknown CryptoSuite/);
  });

  it('rejects removing validator accountability', () => {
    assert.match(
      validateProposal(plan({ REMOVE_VALIDATOR_ACCOUNTABILITY: true }), policy, 1, 1) ?? '',
      /forbidden/,
    );
  });

  it('rejects SunRey Coin supply mutation from an unrelated parameter update', () => {
    assert.match(
      validateProposal(plan({ sunrey_coin_supply: 1 }), policy, 1, 1) ?? '',
      /forbidden/,
    );
  });

  it('rejects MoonRey issuance from an unrelated parameter update', () => {
    assert.match(validateProposal(plan({ moonrey_issuance: true }), policy, 1, 1) ?? '', /forbidden/);
  });

  it('rejects modification of finalized historical blocks', () => {
    assert.match(
      validateProposal(plan({ finalized_history_rewrite: true }), policy, 1, 1) ?? '',
      /forbidden/,
    );
  });
});
