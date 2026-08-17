import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import { toIdentityFacts } from '../../kernel/src/regulated/identity-port.ts';
import { evaluateRequiredProviderOutage } from '../../kernel/src/regulated/outage.ts';
import { screeningResponseToFact } from '../../kernel/src/regulated/screening.ts';
import { createSimulationProviders } from '../../kernel/src/compliance/simulation.ts';
import {
  bindWithdrawalPreview,
  changedBytesInvalidateAuthorization,
  destinationMatchesApproval,
  engageControlFromProviderHealth,
  evaluateWithdrawalGate,
  hsmUnavailableSafeOutcome,
  previewBytesStillBound,
  reconcileRegulatedPositions,
  registerDestination,
  sandboxHsm,
  SandboxIdentityKycProvider,
  SandboxTravelRuleProvider,
  transitionDestination,
  verifyCustomerAssetSegregation,
} from './regulated/index.ts';

const NOW = asUtcInstant('2026-08-17T11:00:00.000Z');

function aliceFacts() {
  return toIdentityFacts(
    { subjectRef: 'alice', actorId: 'actor.alice', jurisdiction: 'GB', now: NOW },
    new SandboxIdentityKycProvider().verify({
      subjectRef: 'alice',
      actorId: 'actor.alice',
      jurisdiction: 'GB',
      now: NOW,
    }),
  );
}

function clearScreening(subject = 'alice') {
  const providers = createSimulationProviders();
  const request = { subjectKind: 'PERSON' as const, subjectRef: subject, jurisdiction: 'GB', now: NOW };
  return [
    screeningResponseToFact('SANCTIONS', request, providers.sanctions.screen(request)),
    screeningResponseToFact('PEP', request, providers.pep.screen(request)),
  ];
}

describe('destination control and preview binding', () => {
  it('binds approval to exact chain/address/network and rejects changed bytes', () => {
    let destination = registerDestination({
      destinationId: 'dest-1',
      chainId: 'chn_sunrey_development',
      networkId: 'net_sunrey_development',
      address: 'sr1_alice_out',
    });
    destination = transitionDestination(destination, 'VERIFICATION_REQUIRED');
    destination = transitionDestination(destination, 'APPROVED');
    assert.equal(
      destinationMatchesApproval(destination, 'chn_sunrey_development', 'net_sunrey_development', 'sr1_alice_out'),
      true,
    );
    assert.equal(
      destinationMatchesApproval(destination, 'chn_other', 'net_sunrey_development', 'sr1_alice_out'),
      false,
    );
    const approved = bindWithdrawalPreview({
      withdrawalId: 'wd-1',
      destinationBinding: destination.approvedBinding!,
      assetId: 'SUNREY_COIN',
      quantity: 10n,
      feePolicyId: 'sandbox-fee',
      networkId: destination.networkId,
      chainId: destination.chainId,
      policyResult: 'ELIGIBLE',
      canonicalBytesHex: 'aa',
    });
    assert.equal(previewBytesStillBound(approved, 'aa'), true);
    assert.equal(
      changedBytesInvalidateAuthorization(approved, { ...approved, canonicalBytesHex: 'bb', bindingHash: 'x' }),
      true,
    );
  });
});

describe('withdrawal gate', () => {
  it('requires identity, screening, Travel Rule, destination, dual control, and HSM health', () => {
    const destination = transitionDestination(
      registerDestination({
        destinationId: 'dest-1',
        chainId: 'chn_sunrey_development',
        networkId: 'net_sunrey_development',
        address: 'sr1_alice_out',
      }),
      'APPROVED',
    );
    const travel = new SandboxTravelRuleProvider().exchangeRequiredData({
      withdrawalId: 'wd-1',
      destination: destination.address,
      originatorRef: 'alice',
      beneficiaryRef: 'bob',
    });
    const eligible = evaluateWithdrawalGate({
      identity: aliceFacts(),
      screening: clearScreening(),
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
    assert.equal(eligible.decision, 'ELIGIBLE');

    const oneApprover = evaluateWithdrawalGate({
      identity: aliceFacts(),
      screening: clearScreening(),
      travelRule: null,
      travelRuleRecord: null,
      destination,
      chainId: destination.chainId,
      networkId: destination.networkId,
      address: destination.address,
      velocityExceeded: false,
      riskBlocked: false,
      custodyApproved: true,
      dualControlSatisfied: false,
      requiredApprovals: 2,
      approvalCount: 1,
      signingReady: true,
      securityHalt: false,
      jurisdictionDenied: false,
      providerOutage: null,
      hsm: sandboxHsm(true),
    });
    assert.equal(oneApprover.decision, 'DUAL_CONTROL_REQUIRED');

    const pendingProvider = new SandboxTravelRuleProvider();
    pendingProvider.forcePending(destination.address);
    const pending = evaluateWithdrawalGate({
      identity: aliceFacts(),
      screening: clearScreening(),
      travelRule: {
        applicability: 'REQUIRED_BY_PACK',
        packId: 'pack-gb-travel-rule-simulation',
        packVersion: '1',
        thresholdSource: 'SIMULATION_POLICY_PACK',
        legalStatus: 'RESEARCH_REQUIRED',
        notALegalConclusion: true,
      },
      travelRuleRecord: pendingProvider.exchangeRequiredData({
        withdrawalId: 'wd-2',
        destination: destination.address,
        originatorRef: 'alice',
        beneficiaryRef: 'bob',
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

    const unavailable = evaluateWithdrawalGate({
      identity: aliceFacts(),
      screening: clearScreening(),
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
        providerId: 'sanctions',
        health: 'UNAVAILABLE',
        required: true,
        posture: 'BLOCK',
      }),
      hsm: sandboxHsm(true),
    });
    assert.equal(unavailable.decision, 'UNAVAILABLE');
    assert.ok(unavailable.reasonCodes.includes('NO_SILENT_BYPASS'));

    const hsmDown = evaluateWithdrawalGate({
      identity: aliceFacts(),
      screening: clearScreening(),
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
      hsm: sandboxHsm(false),
    });
    assert.equal(hsmDown.decision, 'SIGNING_NOT_READY');
    assert.equal(hsmUnavailableSafeOutcome(sandboxHsm(false)).signingAllowed, false);
  });
});

describe('segregation and reconciliation', () => {
  it('reports mismatches without auto-balancing', () => {
    const ok = verifyCustomerAssetSegregation({
      chainNativeHoldings: 100n,
      custodyVaultAttribution: 100n,
      customerOwnershipAttribution: 70n,
      exchangeObligations: 10n,
      pendingWithdrawals: 10n,
      lockedAssets: 5n,
      fees: 5n,
    });
    assert.equal(ok.matched, true);
    assert.equal(ok.autoBalancingEntries, false);
    const mismatch = reconcileRegulatedPositions({
      cadence: 'DAILY',
      nativeChain: 100n,
      custodyAttribution: 90n,
      exchangePositions: 70n,
      withdrawalState: 10n,
      settlementState: 5n,
      fees: 5n,
    });
    assert.equal(mismatch.matched, false);
    assert.equal(mismatch.incidents[0]?.autoCorrected, false);
    const halt = engageControlFromProviderHealth('SIGNING_HALT', 'UNAVAILABLE');
    assert.equal(halt.engaged, true);
  });
});
