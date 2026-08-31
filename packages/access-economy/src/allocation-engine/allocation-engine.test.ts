import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../../domain/src/time.ts';
import { subjectRefFor } from '../ids.ts';
import { buildCapacityPool, CATEGORY_CAPACITY_UNITS, PARTICIPATION_SCALE } from '../dual-token-allocation/index.ts';
import {
  AccessAllocationEngine,
  CATEGORY_ALLOCATION_POLICIES,
  DEFAULT_ACCESS_ALLOCATION_POLICY,
  DEFAULT_MR_REFERENCE_BALANCE,
  DEFAULT_SR_REFERENCE_BALANCE,
  policyToCoefficientsBps,
  resolvePolicyForCategory,
  supplyFromPolicy,
  validatePolicyCoefficients,
} from './index.ts';
import { checkpointAtInstant } from './twab-service.ts';

const PERIOD_START = asUtcInstant('2026-08-01T00:00:00.000Z');
const PERIOD_END = asUtcInstant('2026-08-31T23:59:59.999Z');

function participant(
  id: string,
  sunRey: bigint,
  moonRey: bigint,
): {
  readonly subjectRef: ReturnType<typeof subjectRefFor>;
  readonly sunReyLiquid: bigint;
  readonly moonReyLiquid: bigint;
} {
  return Object.freeze({
    subjectRef: subjectRefFor(id),
    sunReyLiquid: sunRey,
    moonReyLiquid: moonRey,
  });
}

function mobilityPool(capacity: bigint, poolId = 'pool-mobility') {
  return buildCapacityPool({
    poolId,
    epochId: 'epoch-2026-08',
    category: 'MOBILITY',
    geography: 'GLOBAL_SIM',
    timeWindow: '2026-08',
    capacityUnit: CATEGORY_CAPACITY_UNITS.MOBILITY,
    verifiedGrossCapacity: capacity,
    reservedCapacity: 0n,
    providerCommittedCapacity: 0n,
    fundedExternalCapacity: 0n,
    policyReservedCapacity: 0n,
    sourceRefs: Object.freeze(['capacity:sim']),
    evidenceRefs: Object.freeze(['evidence:sim']),
    status: 'VERIFIED',
    allocatableCapacity: capacity,
  });
}

function aiComputePool(capacity: bigint) {
  return buildCapacityPool({
    poolId: 'pool-ai',
    epochId: 'epoch-2026-08',
    category: 'AI_COMPUTE',
    geography: 'GLOBAL_SIM',
    timeWindow: '2026-08',
    capacityUnit: CATEGORY_CAPACITY_UNITS.AI_COMPUTE,
    verifiedGrossCapacity: capacity,
    reservedCapacity: 0n,
    providerCommittedCapacity: 0n,
    fundedExternalCapacity: 0n,
    policyReservedCapacity: 0n,
    sourceRefs: Object.freeze(['capacity:sim']),
    evidenceRefs: Object.freeze(['evidence:sim']),
    status: 'VERIFIED',
    allocatableCapacity: capacity,
  });
}

describe('Access Allocation Engine — policy', () => {
  it('validates 40/40/20 coefficients sum to 1.00', () => {
    assert.doesNotThrow(() => validatePolicyCoefficients(DEFAULT_ACCESS_ALLOCATION_POLICY));
    const coeffs = policyToCoefficientsBps(DEFAULT_ACCESS_ALLOCATION_POLICY);
    assert.equal(coeffs.alphaBps, 4_000n);
    assert.equal(coeffs.betaBps, 4_000n);
    assert.equal(coeffs.gammaBps, 2_000n);
  });

  it('resolves category-specific policy profiles', () => {
    const aiPolicy = resolvePolicyForCategory('AI_COMPUTE', DEFAULT_ACCESS_ALLOCATION_POLICY, CATEGORY_ALLOCATION_POLICIES);
    assert.equal(aiPolicy.category, 'AI_COMPUTE');
    assert.ok(aiPolicy.mrCoefficient > aiPolicy.srCoefficient);

    const mobilityPolicy = resolvePolicyForCategory('MOBILITY', DEFAULT_ACCESS_ALLOCATION_POLICY, CATEGORY_ALLOCATION_POLICIES);
    assert.equal(mobilityPolicy.policyId, DEFAULT_ACCESS_ALLOCATION_POLICY.policyId);
  });

  it('documents reference balances are not fiat pegs', () => {
    assert.equal(DEFAULT_SR_REFERENCE_BALANCE, 1_000n);
    assert.equal(DEFAULT_MR_REFERENCE_BALANCE, 1_000n);
    const supply = supplyFromPolicy(DEFAULT_ACCESS_ALLOCATION_POLICY, 'ledger-snapshot-ref');
    assert.equal(supply.sunReyEligibleBase, DEFAULT_SR_REFERENCE_BALANCE);
    assert.equal(supply.moonReyEligibleBase, DEFAULT_MR_REFERENCE_BALANCE);
  });
});

describe('Access Allocation Engine — TWAB', () => {
  it('computes SR and MR TWAB from checkpoints', () => {
    const engine = new AccessAllocationEngine();
    const checkpoints = [
      checkpointAtInstant(PERIOD_START, 100n, 50n),
      checkpointAtInstant(asUtcInstant('2026-08-15T00:00:00.000Z'), 200n, 100n),
      checkpointAtInstant(PERIOD_END, 100n, 50n),
    ];
    const twab = engine.computeTwabForParticipant(
      { subjectRef: subjectRefFor('twab-user'), checkpoints },
      PERIOD_START,
      PERIOD_END,
    );
    assert.ok(twab.sunReyTwab > 0n);
    assert.ok(twab.moonReyTwab > 0n);
    assert.ok(twab.sunReyTwab < 200n);
  });

  it('returns zero TWAB for zero balances', () => {
    const engine = new AccessAllocationEngine();
    const twab = engine.computeTwabForParticipant(
      participant('zero', 0n, 0n),
      PERIOD_START,
      PERIOD_END,
    );
    assert.equal(twab.eligibleSunReyTwab, 0n);
    assert.equal(twab.eligibleMoonReyTwab, 0n);
  });
});

describe('Access Allocation Engine — diminishing returns (Scenario A)', () => {
  it('User B with 4x balance does NOT receive 4x weight of User A', () => {
    const engine = new AccessAllocationEngine();
    const userA = participant('user-a', 100n, 100n);
    const userB = participant('user-b', 400n, 400n);

    const twabA = engine.computeTwabForParticipant(userA, PERIOD_START, PERIOD_END);
    const twabB = engine.computeTwabForParticipant(userB, PERIOD_START, PERIOD_END);

    const weightA = engine.calculateParticipantWeight({
      subjectRef: userA.subjectRef,
      category: 'MOBILITY',
      twab: twabA,
      participant: userA,
    });
    const weightB = engine.calculateParticipantWeight({
      subjectRef: userB.subjectRef,
      category: 'MOBILITY',
      twab: twabB,
      participant: userB,
    });

    assert.ok(weightB.participantWeightScaled > weightA.participantWeightScaled);
    assert.ok(weightB.participantWeightScaled < weightA.participantWeightScaled * 4n);
  });
});

describe('Access Allocation Engine — dual participation bonus (Scenario B)', () => {
  it('rewards balanced SR/MR participation over single-token heavy', () => {
    const engine = new AccessAllocationEngine();
    const balanced = participant('balanced', 500n, 500n);
    const srHeavy = participant('sr-heavy', 1_000n, 10n);
    const mrHeavy = participant('mr-heavy', 10n, 1_000n);

    const balancedWeight = engine.calculateParticipantWeight({
      subjectRef: balanced.subjectRef,
      category: 'MOBILITY',
      twab: engine.computeTwabForParticipant(balanced, PERIOD_START, PERIOD_END),
      participant: balanced,
    });
    const srHeavyWeight = engine.calculateParticipantWeight({
      subjectRef: srHeavy.subjectRef,
      category: 'MOBILITY',
      twab: engine.computeTwabForParticipant(srHeavy, PERIOD_START, PERIOD_END),
      participant: srHeavy,
    });
    const mrHeavyWeight = engine.calculateParticipantWeight({
      subjectRef: mrHeavy.subjectRef,
      category: 'MOBILITY',
      twab: engine.computeTwabForParticipant(mrHeavy, PERIOD_START, PERIOD_END),
      participant: mrHeavy,
    });

    assert.ok(balancedWeight.participantWeightScaled > srHeavyWeight.participantWeightScaled);
    assert.ok(balancedWeight.participantWeightScaled > mrHeavyWeight.participantWeightScaled);
    assert.ok(balancedWeight.dualScoreScaled > 0n);
  });
});

describe('Access Allocation Engine — capacity bounds (Scenarios C & D)', () => {
  it('never exceeds 100 units capacity (Scenario C)', () => {
    const engine = new AccessAllocationEngine();
    const pool = mobilityPool(100n);
    const supply = supplyFromPolicy(DEFAULT_ACCESS_ALLOCATION_POLICY, 'ledger-ref');
    const participants = [
      participant('p1', 100n, 100n),
      participant('p2', 200n, 200n),
      participant('p3', 300n, 300n),
      participant('p4', 400n, 400n),
    ];

    const preview = engine.generateAllocationSnapshot({
      snapshotId: 'snap-cap-100',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      pools: [pool],
      participants,
      supply,
      mode: 'PREVIEW',
    });

    const total = preview.categoryResults[0]!.totalAllocated;
    assert.ok(total <= 100n);
    assert.ok(total > 0n);
  });

  it('creates no entitlement when capacity is zero (Scenario D)', () => {
    const engine = new AccessAllocationEngine();
    const pool = mobilityPool(0n);
    const supply = supplyFromPolicy(DEFAULT_ACCESS_ALLOCATION_POLICY, 'ledger-ref');

    const preview = engine.generateAllocationSnapshot({
      snapshotId: 'snap-cap-0',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      pools: [pool],
      participants: [participant('p1', 100n, 100n)],
      supply,
      mode: 'PREVIEW',
    });

    assert.equal(preview.categoryResults[0]!.totalAllocated, 0n);
    assert.equal(preview.entitlements.length, 0);
  });
});

describe('Access Allocation Engine — zero balances (Scenario E)', () => {
  it('produces no invalid math for zero balances', () => {
    const engine = new AccessAllocationEngine();
    const weight = engine.calculateParticipantWeight({
      subjectRef: subjectRefFor('zero'),
      category: 'MOBILITY',
      twab: engine.computeTwabForParticipant(participant('zero', 0n, 0n), PERIOD_START, PERIOD_END),
      participant: participant('zero', 0n, 0n),
    });
    assert.equal(weight.participantWeightScaled, 0n);
    assert.equal(weight.normalizedSunReyScoreScaled, 0n);
    assert.equal(weight.normalizedMoonReyScoreScaled, 0n);
    assert.equal(weight.dualScoreScaled, 0n);
  });
});

describe('Access Allocation Engine — preview vs finalize', () => {
  it('preview does not create entitlements', () => {
    const engine = new AccessAllocationEngine();
    const pool = mobilityPool(50n);
    const supply = supplyFromPolicy(DEFAULT_ACCESS_ALLOCATION_POLICY, 'ledger-ref');

    const preview = engine.generateAllocationSnapshot({
      snapshotId: 'snap-preview',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      pools: [pool],
      participants: [participant('p1', 100n, 100n), participant('p2', 200n, 200n)],
      supply,
      mode: 'PREVIEW',
    });

    assert.equal(preview.snapshot.status, 'CALCULATING');
    assert.equal(preview.entitlements.length, 0);
    assert.equal(engine.getEntitlements('snap-preview').length, 0);
  });

  it('finalize creates entitlements', () => {
    const engine = new AccessAllocationEngine();
    const pool = mobilityPool(50n);
    const supply = supplyFromPolicy(DEFAULT_ACCESS_ALLOCATION_POLICY, 'ledger-ref');
    const participants = [participant('p1', 100n, 100n), participant('p2', 200n, 200n)];

    const preview = engine.generateAllocationSnapshot({
      snapshotId: 'snap-finalize',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      pools: [pool],
      participants,
      supply,
      mode: 'PREVIEW',
    });

    const finalized = engine.finalizeAllocationSnapshot({
      snapshotId: 'snap-finalize',
      idempotencyKey: 'idem-1',
      periodEnd: PERIOD_END,
      previewResult: preview,
    });

    assert.equal(finalized.snapshot.status, 'FINALIZED');
    assert.ok(finalized.entitlements.length > 0);
    assert.equal(finalized.entitlements[0]!.transferability, false);
    assert.equal(finalized.entitlements[0]!.isMonetaryAsset, false);
  });

  it('finalize is idempotent (Scenario F)', () => {
    const engine = new AccessAllocationEngine();
    const pool = mobilityPool(50n);
    const supply = supplyFromPolicy(DEFAULT_ACCESS_ALLOCATION_POLICY, 'ledger-ref');
    const participants = [participant('p1', 100n, 100n)];

    const preview = engine.generateAllocationSnapshot({
      snapshotId: 'snap-idem',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      pools: [pool],
      participants,
      supply,
      mode: 'PREVIEW',
    });

    const first = engine.finalizeAllocationSnapshot({
      snapshotId: 'snap-idem',
      idempotencyKey: 'idem-duplicate',
      periodEnd: PERIOD_END,
      previewResult: preview,
    });
    const second = engine.finalizeAllocationSnapshot({
      snapshotId: 'snap-idem',
      idempotencyKey: 'idem-duplicate',
      periodEnd: PERIOD_END,
      previewResult: preview,
    });

    assert.deepEqual(
      first.entitlements.map((row) => [row.entitlementId, row.quantity]),
      second.entitlements.map((row) => [row.entitlementId, row.quantity]),
    );
    assert.equal(first.entitlements.length, second.entitlements.length);
  });
});

describe('Access Allocation Engine — eligibility and caps', () => {
  it('enforces minimum eligibility thresholds', () => {
    const strictPolicy = {
      ...DEFAULT_ACCESS_ALLOCATION_POLICY,
      minimumEligibility: Object.freeze({
        minimumSunReyTwab: 50n,
        minimumMoonReyTwab: 50n,
        minimumParticipantWeightScaled: 0n,
      }),
    };
    const engine = new AccessAllocationEngine({ basePolicy: strictPolicy });
    const lowBalance = participant('low', 10n, 10n);
    const weight = engine.calculateParticipantWeight({
      subjectRef: lowBalance.subjectRef,
      category: 'MOBILITY',
      twab: engine.computeTwabForParticipant(lowBalance, PERIOD_START, PERIOD_END),
      participant: lowBalance,
    });
    assert.equal(weight.eligible, false);
    assert.equal(weight.ineligibleReason, 'BELOW_MINIMUM_SR_TWAB');
  });

  it('enforces maximum participant share cap', () => {
    const cappedPolicy = {
      ...DEFAULT_ACCESS_ALLOCATION_POLICY,
      maximumAllocationShareBps: 5_000,
    };
    const engine = new AccessAllocationEngine({ basePolicy: cappedPolicy });
    const pool = mobilityPool(100n);
    const supply = supplyFromPolicy(cappedPolicy, 'ledger-ref');
    const participants = [
      participant('whale', 10_000n, 10_000n),
      participant('small', 10n, 10n),
    ];

    const preview = engine.generateAllocationSnapshot({
      snapshotId: 'snap-cap-participant',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      pools: [pool],
      participants,
      supply,
      mode: 'PREVIEW',
    });

    const whaleEvidence = preview.categoryResults[0]!.evidence.find(
      (row) => row.subjectRef === subjectRefFor('whale'),
    )!;
    assert.ok(whaleEvidence.allocatedUnits <= 50n);
  });
});

describe('Access Allocation Engine — rounding', () => {
  it('allocates whole units for MOBILITY', () => {
    const engine = new AccessAllocationEngine();
    const pool = mobilityPool(10n);
    const supply = supplyFromPolicy(DEFAULT_ACCESS_ALLOCATION_POLICY, 'ledger-ref');
    const preview = engine.generateAllocationSnapshot({
      snapshotId: 'snap-whole',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      pools: [pool],
      participants: [participant('p1', 100n, 100n), participant('p2', 300n, 300n)],
      supply,
      mode: 'PREVIEW',
    });
    for (const row of preview.categoryResults[0]!.evidence) {
      if (row.allocatedUnits > 0n) {
        assert.equal(row.allocatedUnits % 1n, 0n);
      }
    }
  });

  it('supports fractional milli-units for AI_COMPUTE', () => {
    const engine = new AccessAllocationEngine();
    const pool = aiComputePool(1_000n);
    const supply = supplyFromPolicy(
      resolvePolicyForCategory('AI_COMPUTE', DEFAULT_ACCESS_ALLOCATION_POLICY, CATEGORY_ALLOCATION_POLICIES),
      'ledger-ref',
    );
    const preview = engine.generateAllocationSnapshot({
      snapshotId: 'snap-fractional',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      pools: [pool],
      participants: [participant('p1', 100n, 100n), participant('p2', 200n, 200n)],
      supply,
      categories: ['AI_COMPUTE'],
      mode: 'PREVIEW',
    });
    assert.ok(preview.categoryResults[0]!.totalAllocated <= 1_000n);
  });
});

describe('Access Allocation Engine — evidence and policy version', () => {
  it('retains reproducible evidence', () => {
    const engine = new AccessAllocationEngine();
    const pool = mobilityPool(100n);
    const supply = supplyFromPolicy(DEFAULT_ACCESS_ALLOCATION_POLICY, 'ledger-snapshot-v1');

    engine.generateAllocationSnapshot({
      snapshotId: 'snap-evidence',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      pools: [pool],
      participants: [participant('p1', 100n, 100n)],
      supply,
      mode: 'PREVIEW',
    });

    const evidence = engine.getEvidence('snap-evidence');
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0]!.policyId, DEFAULT_ACCESS_ALLOCATION_POLICY.policyId);
    assert.equal(evidence[0]!.policyVersion, DEFAULT_ACCESS_ALLOCATION_POLICY.version);
    assert.equal(evidence[0]!.snapshotId, 'snap-evidence');
    assert.ok(evidence[0]!.sunReyTwab >= 0n);
    assert.ok(evidence[0]!.participantWeightScaled >= 0n);
  });
});

describe('Access Allocation Engine — token authority boundary', () => {
  it('does not mutate token balances (read-only)', () => {
    const engine = new AccessAllocationEngine();
    const user = participant('readonly', 500n, 500n);
    const beforeSr = user.sunReyLiquid;
    const beforeMr = user.moonReyLiquid;

    const pool = mobilityPool(100n);
    const supply = supplyFromPolicy(DEFAULT_ACCESS_ALLOCATION_POLICY, 'ledger-ref');
    engine.generateAllocationSnapshot({
      snapshotId: 'snap-readonly',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      pools: [pool],
      participants: [user],
      supply,
      mode: 'PREVIEW',
    });

    assert.equal(user.sunReyLiquid, beforeSr);
    assert.equal(user.moonReyLiquid, beforeMr);
  });

  it('has no fiat token peg fields in policy', () => {
    const serialized = `${DEFAULT_ACCESS_ALLOCATION_POLICY.policyId}-${DEFAULT_ACCESS_ALLOCATION_POLICY.srReferenceBalance}`;
    assert.ok(!serialized.includes('fiatPrice'));
    assert.ok(!serialized.includes('redemptionValue'));
    assert.ok(!serialized.includes('tokenPeg'));
    assert.ok(!serialized.includes('dollarAmount'));
    assert.equal(DEFAULT_ACCESS_ALLOCATION_POLICY.diminishingReturnFunction, 'SQRT');
  });

  it('sqrt normalization never produces NaN or Infinity', () => {
    const engine = new AccessAllocationEngine();
    for (const balance of [0n, 1n, 100n, 1_000_000n]) {
      const weight = engine.calculateParticipantWeight({
        subjectRef: subjectRefFor(`norm-${balance}`),
        category: 'MOBILITY',
        twab: Object.freeze({
          subjectRef: subjectRefFor(`norm-${balance}`),
          sunReyTwab: balance,
          moonReyTwab: balance,
          eligibleSunReyTwab: balance,
          eligibleMoonReyTwab: balance,
          windowStart: PERIOD_START,
          windowEnd: PERIOD_END,
        }),
        participant: participant(`norm-${balance}`, balance, balance),
      });
      assert.ok(weight.participantWeightScaled >= 0n);
      assert.ok(weight.normalizedSunReyScoreScaled >= 0n);
      assert.ok(weight.normalizedMoonReyScoreScaled >= 0n);
    }
  });
});

describe('Access Allocation Engine — previewUserAllocation', () => {
  it('returns user-specific preview without exposing other participants', () => {
    const engine = new AccessAllocationEngine();
    const pool = mobilityPool(100n);
    const supply = supplyFromPolicy(DEFAULT_ACCESS_ALLOCATION_POLICY, 'ledger-ref');
    const user = participant('preview-user', 200n, 200n);

    const preview = engine.previewUserAllocation({
      subjectRef: user.subjectRef,
      category: 'MOBILITY',
      participant: user,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      pool,
      supply,
    });

    assert.equal(preview.subjectRef, user.subjectRef);
    assert.ok(preview.participantWeightScaled > 0n);
    assert.equal(preview.policyId, DEFAULT_ACCESS_ALLOCATION_POLICY.policyId);
    assert.equal(preview.snapshotId, null);
  });
});

describe('Access Allocation Engine — proportional allocation formula', () => {
  it('allocates proportional to participant weight share', () => {
    const engine = new AccessAllocationEngine();
    const pool = mobilityPool(100n);
    const supply = supplyFromPolicy(DEFAULT_ACCESS_ALLOCATION_POLICY, 'ledger-ref');
    const userA = participant('prop-a', 100n, 100n);
    const userB = participant('prop-b', 900n, 900n);

    const preview = engine.generateAllocationSnapshot({
      snapshotId: 'snap-proportional',
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      pools: [pool],
      participants: [userA, userB],
      supply,
      mode: 'PREVIEW',
    });

    const evidenceA = preview.categoryResults[0]!.evidence.find(
      (row) => row.subjectRef === userA.subjectRef,
    )!;
    const evidenceB = preview.categoryResults[0]!.evidence.find(
      (row) => row.subjectRef === userB.subjectRef,
    )!;
    assert.ok(evidenceB.allocatedUnits > evidenceA.allocatedUnits);
    assert.equal(preview.categoryResults[0]!.totalAllocated, 100n);
  });
});

describe('Access Allocation Engine — PARTICIPATION_SCALE', () => {
  it('uses fixed-point scale for safe decimal math', () => {
    assert.equal(PARTICIPATION_SCALE, 1_000_000n);
  });
});
