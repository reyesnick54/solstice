import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { UserAgentMandateEngine, type CreateMandateInput, type ExecutionContext } from './engine.ts';
import { createAgentSandboxScenario } from './sandbox.ts';
import {
  approveAgentProposal,
  createAgentMandate,
  getAgentActivity,
  getAgentMandate,
  getAgentProposal,
  revokeAgentMandate,
} from './sdk.ts';

function engine() {
  return new UserAgentMandateEngine({
    clock: new FrozenClock(asUtcInstant('2026-08-18T00:00:00.000Z')),
    kernel: { submit: () => ({ status: 'ALLOW', evidenceRecordId: 'ev_test' }) },
  });
}

function baseInput(overrides: Partial<CreateMandateInput> = {}): CreateMandateInput {
  const sandbox = createAgentSandboxScenario('mandate-test');
  return {
    owner: { kind: 'USER', ownerId: 'user_1', walletId: 'wallet_1', accountId: sandbox.walletAccountId },
    agentLabel: 'household',
    modelRef: 'model:sim-v1',
    policyRef: 'policy:agent-mandates-v1',
    mode: 'PRODUCTION',
    environment: 'simulation',
    permissions: {
      actionClasses: [
        'READ_FINANCIAL_STATE',
        'PREPARE_PAYMENT',
        'EXECUTE_PREAPPROVED_PAYMENT',
        'PREPARE_EXCHANGE_ORDER',
        'EXECUTE_BOUNDED_EXCHANGE_ORDER',
        'REBALANCE_WITHIN_POLICY',
        'MANAGE_ALLOWED_PRODUCTIVE_SERVICE',
        'REQUEST_HUMAN_APPROVAL',
      ],
      assets: [
        { assetId: 'SUNREY_COIN', wildcard: false },
        { assetId: 'MOONREY_COIN', wildcard: false },
      ],
      markets: [{ marketId: 'mkt_sunrey_moonrey' }],
      destinations: [
        { kind: 'SPECIFIC_ADDRESS', destinationId: 'dest_trusted' },
        { kind: 'MACHINE_SERVICE', destinationId: 'machine_compute' },
      ],
      humanInformationAccess: false,
      allowWildcardAssets: false,
    },
    budget: {
      perTransaction: 100n,
      perPeriod: 250n,
      periodHours: 24,
      perAsset: { SUNREY_COIN: '200' },
      perMarket: { mkt_sunrey_moonrey: '200' },
      perActionClass: { EXECUTE_PREAPPROVED_PAYMENT: '200' },
    },
    approval: { class: 'NO_ADDITIONAL_APPROVAL_WITHIN_MANDATE', highRiskAlwaysHuman: true },
    expiry: asUtcInstant('2030-01-01T00:00:00.000Z'),
    frequencyMaxPerPeriod: 5,
    riskPolicyId: 'risk:sim',
    jurisdictionPackId: 'SIM',
    delegatedSigningKeyId: 'wallet_1.delegated.1',
    createdByActorId: 'user_1',
    ...overrides,
  };
}

function execContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    wallet: {
      walletId: 'wallet_1',
      accountId: 'acct_1',
      networkId: 'net_sunrey_simulation',
      policyHash: 'wallet-policy:wallet_1:acct_1',
      delegatedKeyId: 'wallet_1.delegated.1',
      masterKeyHeldByAgent: false,
    },
    networkId: 'net_sunrey_simulation',
    jurisdiction: { packId: 'SIM', actionAvailable: true },
    risk: { restricted: false, reason: null, isWalletAuthority: false },
    kernelStateHash: 'kernel:sim',
    humanApproved: true,
    actorId: 'user_1',
    signerIsAiIdentity: false,
    usesMasterKey: false,
    walletAuthorize: () => ({ ok: true }),
    ...overrides,
  };
}

describe('user agent mandates', () => {
  it('creates an owned mandate and exposes SDK reads', () => {
    const svc = engine();
    const created = createAgentMandate(svc, baseInput());
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('expected mandate');
    }
    assert.equal(getAgentMandate(svc, created.value.mandateId)?.owner.walletId, 'wallet_1');
    assert.equal(created.value.permissions.allowWildcardAssets, false);
  });

  it('refuses an orphaned agent', () => {
    const created = engine().createMandate(
      baseInput({
        owner: { kind: 'USER', ownerId: '', walletId: '', accountId: '' },
      }),
    );
    assert.equal(created.ok, false);
    if (created.ok) {
      throw new Error('expected refusal');
    }
    assert.equal(created.error.code, 'ORPHAN_AGENT');
  });

  it('enforces budget, asset, market, and destination permissions', () => {
    const svc = engine();
    const created = svc.createMandate(baseInput());
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('expected mandate');
    }
    const overBudget = svc.createProposal({
      mandateId: created.value.mandateId,
      intent: 'EXECUTE_PREAPPROVED_PAYMENT',
      reasonCode: 'PAY',
      strategyRef: null,
      assetId: 'SUNREY_COIN',
      quantity: 101n,
      destinationOrMarket: 'dest_trusted',
      fees: 0n,
      expectedOutcomeClass: 'PAYMENT_SUBMITTED_FOR_AUTHORIZATION',
      operationalRationale: 'pay a trusted destination',
      modelRef: 'model:sim-v1',
      networkId: 'net_sunrey_simulation',
    });
    assert.equal(overBudget.ok, false);
    const badAsset = svc.createProposal({
      mandateId: created.value.mandateId,
      intent: 'EXECUTE_PREAPPROVED_PAYMENT',
      reasonCode: 'PAY',
      strategyRef: null,
      assetId: 'UNKNOWN_COIN',
      quantity: 1n,
      destinationOrMarket: 'dest_trusted',
      fees: 0n,
      expectedOutcomeClass: 'PAYMENT_SUBMITTED_FOR_AUTHORIZATION',
      operationalRationale: 'pay with unapproved asset',
      modelRef: 'model:sim-v1',
      networkId: 'net_sunrey_simulation',
    });
    assert.equal(badAsset.ok, false);
    const badMarket = svc.createProposal({
      mandateId: created.value.mandateId,
      intent: 'EXECUTE_BOUNDED_EXCHANGE_ORDER',
      reasonCode: 'TRADE',
      strategyRef: 'lab:shadow-only',
      assetId: 'SUNREY_COIN',
      quantity: 1n,
      destinationOrMarket: 'mkt_newly_listed',
      fees: 0n,
      expectedOutcomeClass: 'EXCHANGE_ORDER_SUBMITTED_FOR_AUTHORIZATION',
      operationalRationale: 'trade a newly listed market',
      modelRef: 'model:sim-v1',
      networkId: 'net_sunrey_simulation',
    });
    assert.equal(badMarket.ok, false);
    const badDest = svc.createProposal({
      mandateId: created.value.mandateId,
      intent: 'EXECUTE_PREAPPROVED_PAYMENT',
      reasonCode: 'PAY',
      strategyRef: null,
      assetId: 'SUNREY_COIN',
      quantity: 1n,
      destinationOrMarket: 'dest_unknown',
      fees: 0n,
      expectedOutcomeClass: 'PAYMENT_SUBMITTED_FOR_AUTHORIZATION',
      operationalRationale: 'pay an unknown destination',
      modelRef: 'model:sim-v1',
      networkId: 'net_sunrey_simulation',
    });
    assert.equal(badDest.ok, false);
  });

  it('executes a bounded payment through kernel and wallet ports', () => {
    const svc = engine();
    const created = svc.createMandate(baseInput());
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('expected mandate');
    }
    const proposal = svc.createProposal({
      mandateId: created.value.mandateId,
      intent: 'EXECUTE_PREAPPROVED_PAYMENT',
      reasonCode: 'PAY',
      strategyRef: null,
      assetId: 'SUNREY_COIN',
      quantity: 10n,
      destinationOrMarket: 'dest_trusted',
      fees: 1n,
      expectedOutcomeClass: 'PAYMENT_SUBMITTED_FOR_AUTHORIZATION',
      operationalRationale: 'pay a trusted destination',
      modelRef: 'model:sim-v1',
      networkId: 'net_sunrey_simulation',
    });
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      throw new Error('expected proposal');
    }
    const executed = svc.requestExecution(proposal.value.proposalId, execContext());
    if (!executed.ok) {
      throw new Error(executed.error.detail);
    }
    assert.equal(executed.ok, true);
    assert.equal(executed.value.finality, 'SUBMITTED');
    assert.equal(getAgentProposal(svc, proposal.value.proposalId)?.state, 'EXECUTED');
  });

  it('revokes a mandate and makes pending proposals ineligible', () => {
    const svc = engine();
    const created = createAgentMandate(svc, baseInput({ approval: { class: 'MOBILE_CONFIRMATION', highRiskAlwaysHuman: true } }));
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('expected mandate');
    }
    const proposal = svc.createProposal({
      mandateId: created.value.mandateId,
      intent: 'EXECUTE_PREAPPROVED_PAYMENT',
      reasonCode: 'PAY',
      strategyRef: null,
      assetId: 'SUNREY_COIN',
      quantity: 5n,
      destinationOrMarket: 'dest_trusted',
      fees: 0n,
      expectedOutcomeClass: 'PAYMENT_SUBMITTED_FOR_AUTHORIZATION',
      operationalRationale: 'awaiting mobile confirmation',
      modelRef: 'model:sim-v1',
      networkId: 'net_sunrey_simulation',
    });
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      throw new Error('expected proposal');
    }
    const revoked = revokeAgentMandate(svc, created.value.mandateId, 'user_1');
    assert.equal(revoked.ok, true);
    const later = svc.requestExecution(proposal.value.proposalId, execContext());
    assert.equal(later.ok, false);
    if (later.ok) {
      throw new Error('expected ineligible');
    }
    assert.equal(later.error.code, 'PENDING_INELIGIBLE_AFTER_REVOCATION');
    assert.equal(getAgentActivity(svc, 'wallet_1').entries.length > 0, true);
  });

  it('keeps SIMULATION_ONLY from submitting real transactions', () => {
    const svc = engine();
    const created = svc.createMandate(baseInput({ mode: 'SIMULATION_ONLY' }));
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('expected mandate');
    }
    const proposal = svc.createProposal({
      mandateId: created.value.mandateId,
      intent: 'EXECUTE_PREAPPROVED_PAYMENT',
      reasonCode: 'PAY',
      strategyRef: null,
      assetId: 'SUNREY_COIN',
      quantity: 5n,
      destinationOrMarket: 'dest_trusted',
      fees: 0n,
      expectedOutcomeClass: 'SIMULATION_EVALUATION',
      operationalRationale: 'simulation only',
      modelRef: 'model:sim-v1',
      networkId: 'net_sunrey_simulation',
    });
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      throw new Error('expected proposal');
    }
    const executed = svc.requestExecution(proposal.value.proposalId, execContext());
    assert.equal(executed.ok, false);
  });

  it('separates Human Information rights from a generic financial mandate', () => {
    const svc = engine();
    const created = svc.createMandate(baseInput());
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('expected mandate');
    }
    assert.equal(svc.humanInformationAccess(created.value.mandateId), false);
    assert.deepEqual(svc.portfolioView(created.value.mandateId, ['SUNREY_COIN', 'SECRET_PDV']), ['SUNREY_COIN']);
  });

  it('approves a mobile confirmation proposal through the SDK', () => {
    const svc = engine();
    const created = svc.createMandate(baseInput({ approval: { class: 'MOBILE_CONFIRMATION', highRiskAlwaysHuman: true } }));
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('expected mandate');
    }
    const proposal = svc.createProposal({
      mandateId: created.value.mandateId,
      intent: 'EXECUTE_PREAPPROVED_PAYMENT',
      reasonCode: 'PAY',
      strategyRef: null,
      assetId: 'SUNREY_COIN',
      quantity: 5n,
      destinationOrMarket: 'dest_trusted',
      fees: 0n,
      expectedOutcomeClass: 'PAYMENT_SUBMITTED_FOR_AUTHORIZATION',
      operationalRationale: 'needs mobile confirmation',
      modelRef: 'model:sim-v1',
      networkId: 'net_sunrey_simulation',
    });
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      throw new Error('expected proposal');
    }
    const approved = approveAgentProposal(svc, {
      proposalId: proposal.value.proposalId,
      actorId: 'user_1',
      approvalClass: 'MOBILE_CONFIRMATION',
      nonce: 'nonce-1',
    });
    assert.equal(approved.ok, true);
  });
});
