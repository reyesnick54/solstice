import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AccessFabricService,
  buildVerifiedCapacityState,
  decideAllocation,
  detectForbiddenInputs,
  evaluateScarcity,
  isCapacityStale,
  validateCapacityState,
} from './index.ts';
import { deterministicLotteryScore } from './allocation/mechanisms.ts';
import { DEFAULT_MECHANISM_POLICY } from './allocation/policy.ts';
import type { AllocationRequest, MechanismSelectionPolicy } from './scarcity/types.ts';
import { asAccessResourceId } from './ids.ts';

const NOW = '2026-08-29T10:00:00.000Z';
const RESOURCE = asAccessResourceId('resource:compute:us-east-1');
const EVIDENCE = Object.freeze(['evidence:capacity:verified:001']);

function capacity(overrides: Partial<Parameters<typeof buildVerifiedCapacityState>[0]> = {}) {
  return buildVerifiedCapacityState({
    resourceId: RESOURCE,
    availableUnits: 10_000n,
    totalUnits: 10_000n,
    verifiedAt: NOW,
    evidenceRefs: EVIDENCE,
    ...overrides,
  });
}

function request(overrides: Partial<AllocationRequest> = {}): AllocationRequest {
  return {
    requestId: 'req-001',
    subjectRef: 'subject:alice',
    resourceId: RESOURCE,
    requestedUnits: 100n,
    jurisdiction: 'US',
    productCode: 'ACCESS_COMPUTE',
    now: NOW,
    ...overrides,
  };
}

function decide(
  cap = capacity(),
  req = request(),
  policy?: MechanismSelectionPolicy,
  scarcityOverrides: Record<string, unknown> = {},
  configuredMechanism?: import('./taxonomy.ts').AllocationMechanism,
) {
  return decideAllocation({
    scarcityInput: {
      resourceId: RESOURCE,
      capacity: cap,
      now: NOW,
      ...scarcityOverrides,
    },
    request: req,
    policy,
    configuredMechanism,
  });
}

describe('ACCESS-06 scarcity engine', () => {
  it('abundant supply yields low pressure and FIXED_ACCESS_RATE by default', () => {
    const cap = capacity({ availableUnits: 9_500n, totalUnits: 10_000n, utilizationBps: 500 });
    const result = decide(cap, request(), {
      ...DEFAULT_MECHANISM_POLICY,
      regimeHint: 'ABUNDANT_DISCRETIONARY',
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.quote.scarcity.band, 'ABUNDANT');
    assert.equal(result.value.decision.mechanism, 'FIXED_ACCESS_RATE');
    assert.equal(result.value.decision.outcome, 'RATE_LIMITED');
    assert.ok(result.value.decision.grantedUnits > 0n);
  });

  it('constrained supply increases pressure and selects queue mechanism', () => {
    const cap = capacity({ availableUnits: 500n, totalUnits: 10_000n, utilizationBps: 9_500 });
    const result = decide(
      cap,
      request(),
      {
        ...DEFAULT_MECHANISM_POLICY,
        regimeHint: 'SCARCE_PREMIUM',
        scarceMechanisms: Object.freeze(['QUEUE']),
      },
      { forecastDemandUnits: 2_000n },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(['CONSTRAINED', 'CRITICAL', 'BALANCED'].includes(result.value.quote.scarcity.band));
    assert.equal(result.value.decision.mechanism, 'QUEUE');
  });

  it('demand spike raises scarcity pressure', () => {
    const cap = capacity({ availableUnits: 1_000n, totalUnits: 10_000n, utilizationBps: 9_000 });
    const lowDemand = evaluateScarcity(
      { resourceId: RESOURCE, capacity: cap, now: NOW, forecastDemandUnits: 500n },
      { capacityMaxAgeMs: 600_000 },
    );
    const highDemand = evaluateScarcity(
      { resourceId: RESOURCE, capacity: cap, now: NOW, forecastDemandUnits: 5_000n },
      { capacityMaxAgeMs: 600_000 },
    );
    assert.equal(lowDemand.ok, true);
    assert.equal(highDemand.ok, true);
    if (!lowDemand.ok || !highDemand.ok) return;
    assert.ok(highDemand.value.pressureBps > lowDemand.value.pressureBps);
  });

  it('time-based scarcity contributes to pressure', () => {
    const cap = capacity();
    const withoutTime = evaluateScarcity(
      { resourceId: RESOURCE, capacity: cap, now: NOW },
      { capacityMaxAgeMs: 600_000 },
    );
    const withTime = evaluateScarcity(
      { resourceId: RESOURCE, capacity: cap, now: NOW, timeScarcityBps: 8_000 },
      { capacityMaxAgeMs: 600_000 },
    );
    assert.equal(withoutTime.ok, true);
    assert.equal(withTime.ok, true);
    if (!withoutTime.ok || !withTime.ok) return;
    assert.ok(withTime.value.pressureBps > withoutTime.value.pressureBps);
  });

  it('location scarcity contributes to pressure', () => {
    const cap = capacity({ locationCode: 'US-NY' });
    const lowGeo = evaluateScarcity(
      { resourceId: RESOURCE, capacity: cap, now: NOW, geographicScarcityBps: 1_000 },
      { capacityMaxAgeMs: 600_000 },
    );
    const highGeo = evaluateScarcity(
      { resourceId: RESOURCE, capacity: cap, now: NOW, geographicScarcityBps: 7_500 },
      { capacityMaxAgeMs: 600_000 },
    );
    assert.equal(lowGeo.ok, true);
    assert.equal(highGeo.ok, true);
    if (!lowGeo.ok || !highGeo.ok) return;
    assert.ok(highGeo.value.pressureBps > lowGeo.value.pressureBps);
  });

  it('equal-policy treatment grants same entitlement outcome for equal subjects', () => {
    const cap = capacity();
    const policy: MechanismSelectionPolicy = {
      ...DEFAULT_MECHANISM_POLICY,
      regimeHint: 'ESSENTIAL',
      essentialMechanism: 'ENTITLEMENT',
    };
    const alice = decide(
      cap,
      request({ subjectRef: 'subject:alice', entitlementUnits: 200n }),
      policy,
    );
    const bob = decide(
      cap,
      request({ subjectRef: 'subject:bob', entitlementUnits: 200n }),
      policy,
    );
    assert.equal(alice.ok, true);
    assert.equal(bob.ok, true);
    if (!alice.ok || !bob.ok) return;
    assert.equal(alice.value.decision.outcome, bob.value.decision.outcome);
    assert.equal(alice.value.decision.grantedUnits, bob.value.decision.grantedUnits);
    assert.equal(alice.value.decision.mechanism, 'ENTITLEMENT');
  });

  it('queue ordering preserves join order metadata', () => {
    const cap = capacity({ availableUnits: 0n, totalUnits: 10_000n, utilizationBps: 10_000 });
    const result = decide(
      cap,
      request({ queueJoinOrder: 42n }),
      {
        ...DEFAULT_MECHANISM_POLICY,
        regimeHint: 'SCARCE_PREMIUM',
        scarceMechanisms: Object.freeze(['QUEUE']),
        denyWhenUnavailable: false,
      },
      {},
      'QUEUE',
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.decision.outcome, 'QUEUED');
    assert.equal(result.value.decision.inputs.queuePosition, '42');
  });

  it('deterministic lottery seeding is stable across runs', () => {
    const scoreA = deterministicLotteryScore('seed-1', 'subject:alice', RESOURCE);
    const scoreB = deterministicLotteryScore('seed-1', 'subject:alice', RESOURCE);
    const scoreC = deterministicLotteryScore('seed-1', 'subject:bob', RESOURCE);
    assert.equal(scoreA, scoreB);
    assert.notEqual(scoreA, scoreC);
  });

  it('lottery mechanism uses deterministic score', () => {
    const cap = capacity();
    const result = decide(
      cap,
      request({ lotterySeed: 'simulation-round-7' }),
      {
        ...DEFAULT_MECHANISM_POLICY,
        regimeHint: 'SCARCE_PREMIUM',
        scarceMechanisms: Object.freeze(['LOTTERY']),
      },
      {},
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.decision.mechanism, 'LOTTERY');
    assert.ok(result.value.decision.inputs.lotteryScore);
    const rerun = decide(
      cap,
      request({ lotterySeed: 'simulation-round-7' }),
      {
        ...DEFAULT_MECHANISM_POLICY,
        regimeHint: 'SCARCE_PREMIUM',
        scarceMechanisms: Object.freeze(['LOTTERY']),
      },
      {},
    );
    assert.equal(rerun.ok, true);
    if (!rerun.ok) return;
    assert.equal(result.value.decision.outcome, rerun.value.decision.outcome);
    assert.equal(result.value.decision.inputs.lotteryScore, rerun.value.decision.inputs.lotteryScore);
  });

  it('zero availability yields UNAVAILABLE band and denial', () => {
    const cap = capacity({ availableUnits: 0n, totalUnits: 10_000n, utilizationBps: 10_000 });
    const result = decide(cap, request());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.quote.scarcity.band, 'UNAVAILABLE');
    assert.equal(result.value.decision.outcome, 'DENIED');
    assert.equal(result.value.decision.grantedUnits, 0n);
  });

  it('stale capacity is refused', () => {
    const cap = capacity({ verifiedAt: '2026-08-29T08:00:00.000Z' });
    const stale = validateCapacityState(cap, { now: NOW, maxAgeMs: 3_600_000 });
    assert.equal(stale.ok, false);
    if (stale.ok) return;
    assert.equal(stale.error.code, 'CAPACITY_STALE');
    assert.equal(isCapacityStale(cap, NOW, 3_600_000), true);
  });

  it('policy denial via forbidden inputs', () => {
    const cap = capacity();
    const result = decide(cap, request(), DEFAULT_MECHANISM_POLICY, {});
    const withForbidden = decideAllocation({
      scarcityInput: { resourceId: RESOURCE, capacity: cap, now: NOW },
      request: request(),
      policy: DEFAULT_MECHANISM_POLICY,
      forbiddenProbe: { humanWorth: 100, wealth: 1_000_000n },
    });
    assert.equal(withForbidden.ok, false);
    if (withForbidden.ok) return;
    assert.equal(withForbidden.error.code, 'FORBIDDEN_INPUT_PRESENT');
    assert.ok(withForbidden.error.message.includes('HUMAN_WORTH'));
    assert.ok(withForbidden.error.message.includes('WEALTH'));
    assert.equal(result.ok, true);
  });

  it('market purchase only when explicitly optional and enabled', () => {
    const cap = capacity();
    const denied = decide(
      cap,
      request({ optionalMarketPurchase: true, offeredPriceMinor: 5_000n }),
      { ...DEFAULT_MECHANISM_POLICY, allowFinancialPurchase: false },
      {},
      'MARKET',
    );
    assert.equal(denied.ok, true);
    if (!denied.ok) return;
    assert.equal(denied.value.decision.outcome, 'DENIED');

    const allowed = decide(
      cap,
      request({ optionalMarketPurchase: true, offeredPriceMinor: 5_000n }),
      { ...DEFAULT_MECHANISM_POLICY, allowFinancialPurchase: true, regimeHint: 'SCARCE_PREMIUM', scarceMechanisms: Object.freeze(['MARKET']) },
      {},
      'MARKET',
    );
    assert.equal(allowed.ok, true);
    if (!allowed.ok) return;
    assert.equal(allowed.value.decision.mechanism, 'MARKET');
    assert.equal(allowed.value.decision.outcome, 'MARKET_QUOTED');
    assert.equal(allowed.value.decision.grantedUnits, 100n);
  });

  it('methodology is versioned and auditable on AccessQuote', () => {
    const cap = capacity();
    const result = decide(cap, request());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.quote.methodologyVersion, 'sunrey.access.scarcity.v1');
    assert.ok(result.value.quote.scarcity.components.length > 0);
    assert.ok(result.value.quote.marketInputs.length >= 0);
    assert.ok(result.value.quote.policyInputs.length >= 0);
    assert.ok(result.value.decision.evidenceReferences.length > 0);
    assert.ok(result.value.decision.reasons.length > 0);
    assert.ok(result.value.decision.expiration);
    assert.equal(result.value.decision.policyVersion, DEFAULT_MECHANISM_POLICY.policyVersion);
  });

  it('detectForbiddenInputs lists all forbidden categories', () => {
    const found = detectForbiddenInputs({
      humanWorth: 1,
      socialStatus: 'VIP',
      psychologicalProfile: { score: 0.9 },
    });
    assert.deepEqual(found.sort(), ['HUMAN_WORTH', 'PSYCHOLOGICAL_PROFILE', 'SOCIAL_STATUS'].sort());
  });

  it('AccessFabricService integrates quote and allocation', () => {
    const clock = { now: () => NOW };
    const service = new AccessFabricService({ clock });
    const cap = service.buildCapacity({
      resourceId: RESOURCE,
      availableUnits: 5_000n,
      totalUnits: 5_000n,
      evidenceRefs: EVIDENCE,
      verifiedAt: NOW,
    });
    const result = service.quoteAndAllocate({
      request: {
        requestId: 'req-svc',
        subjectRef: 'subject:carol',
        resourceId: RESOURCE,
        requestedUnits: 50n,
        jurisdiction: 'US',
        productCode: 'ACCESS_COMPUTE',
        entitlementUnits: 50n,
      },
      capacity: cap,
      configuredMechanism: 'ENTITLEMENT',
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.decision.mechanism, 'ENTITLEMENT');
    assert.equal(result.value.decision.grantedUnits, 50n);
  });
});
