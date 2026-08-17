import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { createSimulationProviders } from '../packages/kernel/src/compliance/simulation.ts';
import { InMemoryCaseManagementPort } from '../packages/kernel/src/regulated/case-management.ts';
import { toIdentityFacts } from '../packages/kernel/src/regulated/identity-port.ts';
import { evaluateRequiredProviderOutage } from '../packages/kernel/src/regulated/outage.ts';
import { screeningResponseToFact } from '../packages/kernel/src/regulated/screening.ts';
import {
  bindWithdrawalPreview,
  changedBytesInvalidateAuthorization,
  evaluateWithdrawalGate,
  reconcileRegulatedPositions,
  registerDestination,
  sandboxHsm,
  SandboxIdentityKycProvider,
  SandboxTravelRuleProvider,
  transitionDestination,
  verifyCustomerAssetSegregation,
} from '../packages/custody/src/regulated/index.ts';
import { MOONREY_COIN_NATIVE_ASSET_ID, SUNREY_COIN_NATIVE_ASSET_ID } from '../packages/sunrey-exchange/src/ids.ts';
import { NativeClearingEngine } from '../packages/sunrey-exchange/src/native-clearing/engine.ts';
import { exportSurveillanceCases } from '../packages/sunrey-exchange/src/regulated/surveillance-export.ts';

const NOW = asUtcInstant('2026-08-17T11:00:00.000Z');

function identity(subject = 'alice') {
  const response = new SandboxIdentityKycProvider().verify({
    subjectRef: subject,
    actorId: `actor.${subject}`,
    jurisdiction: 'GB',
    now: NOW,
  });
  return toIdentityFacts(
    { subjectRef: subject, actorId: `actor.${subject}`, jurisdiction: 'GB', now: NOW },
    response,
  );
}

function screening(subject: string) {
  const providers = createSimulationProviders();
  const request = { subjectKind: 'PERSON' as const, subjectRef: subject, jurisdiction: 'GB', now: NOW };
  return [
    screeningResponseToFact('SANCTIONS', request, providers.sanctions.screen(request)),
    screeningResponseToFact('PEP', request, providers.pep.screen(request)),
    screeningResponseToFact('FRAUD', request, providers.fraud.evaluate(request)),
  ];
}

describe('chunk 69 sandbox end-to-end', () => {
  it('runs Alice KYC through native DVP, dual-control withdrawal, HSM simulation, and recon', () => {
    const facts = identity('alice');
    assert.equal(facts.kycState, 'VERIFIED');
    const screens = screening('alice');
    assert.ok(screens.every((fact) => fact.outcome === 'CLEAR'));

    const clearing = new NativeClearingEngine();
    const alice = clearing.openExchangeAccount('alice');
    const bob = clearing.openExchangeAccount('bob');
    clearing.faucetToCustody(alice, MOONREY_COIN_NATIVE_ASSET_ID, 25n);
    clearing.faucetToCustody(bob, SUNREY_COIN_NATIVE_ASSET_ID, 10n);
    clearing.placeOrder({ accountId: bob, side: 'SELL', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
    clearing.placeOrder({ accountId: alice, side: 'BUY', quantity: 10n, priceUnits: 2_500_000n, now: NOW });
    const settlement = [...clearing.settlements.values()][0]!;
    const finalized = clearing.submitSettlement(settlement.settlementId);
    assert.equal(finalized.status, 'FINALIZED');
    assert.equal(clearing.position(alice, SUNREY_COIN_NATIVE_ASSET_ID).available, 10n);

    let destination = registerDestination({
      destinationId: 'dest-alice',
      chainId: clearing.chainId,
      networkId: clearing.networkId,
      address: 'sr1_alice_external',
    });
    destination = transitionDestination(destination, 'VERIFICATION_REQUIRED');
    destination = transitionDestination(destination, 'APPROVED');
    const travel = new SandboxTravelRuleProvider().exchangeRequiredData({
      withdrawalId: 'wd-alice',
      destination: destination.address,
      originatorRef: 'alice',
      beneficiaryRef: 'external',
    });
    assert.equal(travel.state, 'DELIVERED');
    const gate = evaluateWithdrawalGate({
      identity: facts,
      screening: screens,
      travelRule: {
        applicability: 'REQUIRED_BY_PACK',
        packId: 'pack-gb-travel-rule-simulation',
        packVersion: '1',
        thresholdSource: 'SIMULATION_POLICY_PACK',
        legalStatus: 'RESEARCH_REQUIRED',
        notALegalConclusion: true,
      },
      travelRuleRecord: travel,
      destination,
      chainId: destination.chainId,
      networkId: destination.networkId,
      address: destination.address,
      velocityExceeded: false,
      riskBlocked: false,
      custodyApproved: true,
      dualControlSatisfied: true,
      requiredApprovals: 2,
      approvalCount: 2,
      signingReady: true,
      securityHalt: false,
      jurisdictionDenied: false,
      providerOutage: null,
      hsm: sandboxHsm(true),
    });
    assert.equal(gate.decision, 'ELIGIBLE');
    const requested = clearing.requestWithdrawal(alice, SUNREY_COIN_NATIVE_ASSET_ID, 4n, destination.address);
    const submitted = clearing.submitWithdrawal(requested.withdrawalId);
    assert.equal(submitted.status, 'FINALIZED');
    assert.ok(submitted.transactionId);
    const segregation = verifyCustomerAssetSegregation({
      chainNativeHoldings: 10n,
      custodyVaultAttribution: 10n,
      customerOwnershipAttribution: 6n,
      exchangeObligations: 0n,
      pendingWithdrawals: 0n,
      lockedAssets: 0n,
      fees: 4n,
    });
    assert.equal(segregation.matched, true);
    const recon = reconcileRegulatedPositions({
      cadence: 'CONTINUOUS',
      nativeChain: 10n,
      custodyAttribution: 10n,
      exchangePositions: 6n,
      withdrawalState: 0n,
      settlementState: 0n,
      fees: 4n,
    });
    assert.equal(recon.matched, true);
    const cases = new InMemoryCaseManagementPort();
    const exported = exportSurveillanceCases(
      { marketId: 'mkt_alice', selfTrades: [] },
      NOW,
      cases,
      'alice',
    );
    assert.equal(exported.length, 0);
  });

  it('blocks screening hits, pending Travel Rule, unavailable HSM, and ambiguous submission', () => {
    const destination = transitionDestination(
      registerDestination({
        destinationId: 'dest-2',
        chainId: 'chn_sunrey_development',
        networkId: 'net_sunrey_development',
        address: 'sr1_out',
      }),
      'APPROVED',
    );
    const hit = evaluateWithdrawalGate({
      identity: identity('alice'),
      screening: screening('sim_block'),
      travelRule: null,
      travelRuleRecord: null,
      destination,
      chainId: destination.chainId,
      networkId: destination.networkId,
      address: destination.address,
      velocityExceeded: false,
      riskBlocked: false,
      custodyApproved: true,
      dualControlSatisfied: true,
      requiredApprovals: 2,
      approvalCount: 2,
      signingReady: true,
      securityHalt: false,
      jurisdictionDenied: false,
      providerOutage: null,
      hsm: sandboxHsm(true),
    });
    assert.equal(hit.decision, 'REJECTED');
    assert.ok(hit.reasonCodes.includes('SCREENING_HIT'));

    const travel = new SandboxTravelRuleProvider();
    travel.forcePending(destination.address);
    const pending = evaluateWithdrawalGate({
      identity: identity('alice'),
      screening: screening('alice'),
      travelRule: {
        applicability: 'REQUIRED_BY_PACK',
        packId: 'pack-gb-travel-rule-simulation',
        packVersion: '1',
        thresholdSource: 'SIMULATION_POLICY_PACK',
        legalStatus: 'RESEARCH_REQUIRED',
        notALegalConclusion: true,
      },
      travelRuleRecord: travel.exchangeRequiredData({
        withdrawalId: 'wd-pending',
        destination: destination.address,
        originatorRef: 'alice',
        beneficiaryRef: 'ext',
      }),
      destination,
      chainId: destination.chainId,
      networkId: destination.networkId,
      address: destination.address,
      velocityExceeded: false,
      riskBlocked: false,
      custodyApproved: true,
      dualControlSatisfied: true,
      requiredApprovals: 2,
      approvalCount: 2,
      signingReady: true,
      securityHalt: false,
      jurisdictionDenied: false,
      providerOutage: null,
      hsm: sandboxHsm(true),
    });
    assert.equal(pending.decision, 'TRAVEL_RULE_PENDING');

    const hsmDown = evaluateWithdrawalGate({
      identity: identity('alice'),
      screening: screening('alice'),
      travelRule: null,
      travelRuleRecord: null,
      destination,
      chainId: destination.chainId,
      networkId: destination.networkId,
      address: destination.address,
      velocityExceeded: false,
      riskBlocked: false,
      custodyApproved: true,
      dualControlSatisfied: true,
      requiredApprovals: 2,
      approvalCount: 2,
      signingReady: true,
      securityHalt: false,
      jurisdictionDenied: false,
      providerOutage: evaluateRequiredProviderOutage({
        providerId: 'hsm',
        health: 'UNAVAILABLE',
        required: true,
        posture: 'BLOCK',
      }),
      hsm: sandboxHsm(false),
    });
    assert.equal(hsmDown.decision, 'UNAVAILABLE');

    const clearing = new NativeClearingEngine();
    const alice = clearing.openExchangeAccount('alice');
    clearing.faucetToCustody(alice, SUNREY_COIN_NATIVE_ASSET_ID, 5n);
    const requested = clearing.requestWithdrawal(alice, SUNREY_COIN_NATIVE_ASSET_ID, 2n, 'sr1_out');
    const unknown = clearing.submitWithdrawal(requested.withdrawalId, true);
    assert.equal(unknown.status, 'SUBMISSION_UNKNOWN');
    const again = clearing.submitWithdrawal(requested.withdrawalId, true);
    assert.equal(again.submittedOnce, true);
    assert.equal(again.withdrawalId, unknown.withdrawalId);
    const resolved = clearing.queryWithdrawal(requested.withdrawalId);
    assert.equal(resolved.status, 'FINALIZED');
  });

  it('rejects changed withdrawal bytes after approval', () => {
    const approved = bindWithdrawalPreview({
      withdrawalId: 'wd-bytes',
      destinationBinding: 'chn/net/addr',
      assetId: 'SUNREY_COIN',
      quantity: 2n,
      feePolicyId: 'sandbox-fee',
      networkId: 'net_sunrey_development',
      chainId: 'chn_sunrey_development',
      policyResult: 'ELIGIBLE',
      canonicalBytesHex: 'deadbeef',
    });
    assert.equal(
      changedBytesInvalidateAuthorization(approved, { ...approved, canonicalBytesHex: 'cafebabe', bindingHash: 'no' }),
      true,
    );
  });
});
