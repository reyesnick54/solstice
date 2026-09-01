/**
 * ACCESS Wave 1 / Prompt 29 — Access Allocation Engine.
 *
 * Deterministic capacity-share allocation from SR/MR time-weighted participation.
 * Read-only against token balances. No mint, burn, transfer, or fiat peg.
 */

import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import type { SubjectRef } from '../ids.ts';
import { evaluateAntiGaming } from '../dual-token-allocation/anti-gaming.ts';
import { issueEntitlementsFromAllocations } from '../dual-token-allocation/entitlement.ts';
import {
  dualBonusTerm,
  PARTICIPATION_SCALE,
  ratioScaled,
  sqrtTransformScaled,
  weightedParticipation,
} from '../dual-token-allocation/fixed-point.ts';
import { COEFF_BPS_SCALE } from '../dual-token-allocation/fixed-point.ts';
import { buildCapacityPool, CATEGORY_CAPACITY_UNITS } from '../dual-token-allocation/capacity.ts';
import type {
  AccessAllocationCategory,
  AccessAllocationRecord,
  AccessCapacityPool,
  EligibleSupplySnapshot,
  IssuedAccessEntitlement,
} from '../dual-token-allocation/types.ts';
import {
  checkParticipantEligibility,
  defaultEligibilityPort,
  eligibleForCategory,
} from './eligibility.ts';
import type { EligibilityPort } from './types.ts';
import {
  DEFAULT_ACCESS_ALLOCATION_POLICY,
  policyToCoefficientsBps,
  resolvePolicyForCategory,
  validatePolicyCoefficients,
} from './policy.ts';
import {
  applyParticipantCap,
  floorProportionalShare,
  fromScaledUnits,
  residualCapacity,
  toScaledUnits,
  unitScaleForMode,
} from './rounding.ts';
import { AccessAllocationStore } from './store.ts';
import {
  computeTimeWeightedBalance,
  resolveCheckpoints,
  type TimeWeightedBalance,
} from './twab-service.ts';
import type { TokenBalanceReaderPort } from './types.ts';
import type {
  AccessAllocationPolicy,
  AccessAllocationSnapshot,
  AllocationSnapshotResult,
  CategoryAllocationResult,
  GenerateSnapshotInput,
  ParticipantAllocationEvidence,
  ParticipantAllocationInput,
  ParticipantWeightResult,
  UserAllocationPreview,
} from './types.ts';

export type AccessAllocationEngineOptions = {
  readonly eligibilityPort?: EligibilityPort;
  readonly balanceReader?: TokenBalanceReaderPort;
  readonly store?: AccessAllocationStore;
  readonly basePolicy?: AccessAllocationPolicy;
};

function compareSubjectRef(left: SubjectRef, right: SubjectRef): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function diminishingTransform(
  twab: bigint,
  referenceBalance: bigint,
  functionKind: AccessAllocationPolicy['diminishingReturnFunction'],
): bigint {
  if (twab <= 0n || referenceBalance <= 0n) {
    return 0n;
  }
  const normalized = ratioScaled(twab, referenceBalance);
  if (functionKind === 'SQRT') {
    return sqrtTransformScaled(normalized);
  }
  return 0n;
}

function computeWeightFromScores(
  policy: AccessAllocationPolicy,
  sunReyScore: bigint,
  moonReyScore: bigint,
): { readonly dualScore: bigint; readonly weight: bigint } {
  const dualScore = dualBonusTerm(sunReyScore, moonReyScore);
  const coeffs = policyToCoefficientsBps(policy);
  const weight = weightedParticipation(
    coeffs.alphaBps,
    sunReyScore,
    coeffs.betaBps,
    moonReyScore,
    coeffs.gammaBps,
    dualScore,
  );
  return Object.freeze({ dualScore, weight });
}

function allocateWithRounding(input: {
  readonly pool: AccessCapacityPool;
  readonly weights: readonly ParticipantWeightResult[];
  readonly policy: AccessAllocationPolicy;
  readonly snapshotId: string;
  readonly policyVersion: string;
}): {
  readonly records: readonly AccessAllocationRecord[];
  readonly evidence: readonly ParticipantAllocationEvidence[];
} {
  const capacity = input.pool.allocatableCapacity;
  if (capacity === 0n) {
    return Object.freeze({ records: Object.freeze([]), evidence: Object.freeze([]) });
  }

  const eligible = eligibleForCategory(input.weights, input.pool.category);
  const totalWeight = eligible.reduce((sum, row) => sum + row.participantWeightScaled, 0n);
  if (totalWeight === 0n) {
    return Object.freeze({ records: Object.freeze([]), evidence: Object.freeze([]) });
  }

  const scale = unitScaleForMode(input.policy.unitRoundingMode);
  const capacityScaled = toScaledUnits(capacity, input.policy.unitRoundingMode);

  type Candidate = {
    readonly row: ParticipantWeightResult;
    readonly floorUnits: bigint;
    readonly remainder: bigint;
  };

  const candidates: Candidate[] = eligible.map((row) => {
    const share = floorProportionalShare(row.participantWeightScaled, totalWeight, capacityScaled);
    let floorUnits = share.floorUnits;
    if (input.policy.maximumAllocationShareBps !== null) {
      const capped = applyParticipantCap(
        fromScaledUnits(floorUnits, input.policy.unitRoundingMode),
        capacity,
        input.policy.maximumAllocationShareBps,
      );
      floorUnits = toScaledUnits(capped, input.policy.unitRoundingMode);
    }
    return Object.freeze({ row, floorUnits, remainder: share.remainder });
  });

  let distributed = candidates.reduce((sum, row) => sum + row.floorUnits, 0n);
  let remaining = capacityScaled - distributed;

  const ranked = [...candidates].sort((left, right) => {
    if (left.remainder !== right.remainder) {
      return left.remainder > right.remainder ? -1 : 1;
    }
    return compareSubjectRef(left.row.subjectRef, right.row.subjectRef);
  });

  const bonus = new Map<string, bigint>();
  for (const candidate of ranked) {
    if (remaining === 0n) {
      break;
    }
    if (candidate.floorUnits === 0n && candidate.remainder === 0n) {
      continue;
    }
    let next = (bonus.get(candidate.row.subjectRef) ?? 0n) + 1n;
    if (input.policy.maximumAllocationShareBps !== null) {
      const current = candidate.floorUnits + (bonus.get(candidate.row.subjectRef) ?? 0n);
      const capped = applyParticipantCap(
        fromScaledUnits(current + 1n, input.policy.unitRoundingMode),
        capacity,
        input.policy.maximumAllocationShareBps,
      );
      const cappedScaled = toScaledUnits(capped, input.policy.unitRoundingMode);
      if (cappedScaled <= current) {
        continue;
      }
      next = cappedScaled - candidate.floorUnits;
    }
    bonus.set(candidate.row.subjectRef, next);
    remaining -= 1n;
    distributed += 1n;
  }

  const records: AccessAllocationRecord[] = [];
  const evidence: ParticipantAllocationEvidence[] = [];

  for (const candidate of candidates) {
    const scaledUnits = candidate.floorUnits + (bonus.get(candidate.row.subjectRef) ?? 0n);
    const units = fromScaledUnits(scaledUnits, input.policy.unitRoundingMode);
    if (units === 0n) {
      evidence.push(
        Object.freeze({
          evidenceId: `evidence-${input.snapshotId}-${candidate.row.subjectRef}-${input.pool.category}`,
          snapshotId: input.snapshotId,
          subjectRef: candidate.row.subjectRef,
          category: input.pool.category,
          sunReyTwab: candidate.row.sunReyTwab,
          moonReyTwab: candidate.row.moonReyTwab,
          normalizedSunReyScoreScaled: candidate.row.normalizedSunReyScoreScaled,
          normalizedMoonReyScoreScaled: candidate.row.normalizedMoonReyScoreScaled,
          dualScoreScaled: candidate.row.dualScoreScaled,
          participantWeightScaled: candidate.row.participantWeightScaled,
          totalCategoryWeightScaled: totalWeight,
          availableCapacity: capacity,
          allocatedUnits: 0n,
          capacityUnit: input.pool.capacityUnit,
          policyId: input.policy.policyId,
          policyVersion: input.policy.version,
          allocationId: null,
        }),
      );
      continue;
    }
    const allocationId = `alloc-${input.snapshotId}-${input.pool.poolId}-${candidate.row.subjectRef}`;
    records.push(
      Object.freeze({
        allocationId,
        subjectRef: candidate.row.subjectRef,
        epochId: input.snapshotId,
        poolId: input.pool.poolId,
        category: input.pool.category,
        allocatedUnits: units,
        capacityUnit: input.pool.capacityUnit,
        weightScaled: candidate.row.participantWeightScaled,
        economicMode: 'INCLUDED_ACCESS',
        policyVersion: input.policyVersion,
        remainderRank: bonus.has(candidate.row.subjectRef) ? 1 : null,
      }),
    );
    evidence.push(
      Object.freeze({
        evidenceId: `evidence-${input.snapshotId}-${candidate.row.subjectRef}-${input.pool.category}`,
        snapshotId: input.snapshotId,
        subjectRef: candidate.row.subjectRef,
        category: input.pool.category,
        sunReyTwab: candidate.row.sunReyTwab,
        moonReyTwab: candidate.row.moonReyTwab,
        normalizedSunReyScoreScaled: candidate.row.normalizedSunReyScoreScaled,
        normalizedMoonReyScoreScaled: candidate.row.normalizedMoonReyScoreScaled,
        dualScoreScaled: candidate.row.dualScoreScaled,
        participantWeightScaled: candidate.row.participantWeightScaled,
        totalCategoryWeightScaled: totalWeight,
        availableCapacity: capacity,
        allocatedUnits: units,
        capacityUnit: input.pool.capacityUnit,
        policyId: input.policy.policyId,
        policyVersion: input.policy.version,
        allocationId,
      }),
    );
  }

  const totalAllocated = records.reduce((sum, row) => sum + row.allocatedUnits, 0n);
  if (totalAllocated > capacity) {
    throw new RangeError(
      `allocation ${totalAllocated} exceeds capacity ${capacity} for pool ${input.pool.poolId}`,
    );
  }

  return Object.freeze({ records: Object.freeze(records), evidence: Object.freeze(evidence) });
}

export class AccessAllocationEngine {
  private readonly eligibilityPort: EligibilityPort;
  private readonly balanceReader?: TokenBalanceReaderPort;
  private readonly store: AccessAllocationStore;
  private readonly basePolicy: AccessAllocationPolicy;

  constructor(options: AccessAllocationEngineOptions = {}) {
    this.eligibilityPort = options.eligibilityPort ?? defaultEligibilityPort();
    this.balanceReader = options.balanceReader;
    this.store = options.store ?? new AccessAllocationStore();
    this.basePolicy = options.basePolicy ?? DEFAULT_ACCESS_ALLOCATION_POLICY;
    validatePolicyCoefficients(this.basePolicy);
  }

  calculateParticipantWeight(input: {
    readonly subjectRef: SubjectRef;
    readonly category: AccessAllocationCategory;
    readonly twab: TimeWeightedBalance;
    readonly policy?: AccessAllocationPolicy;
    readonly participant?: ParticipantAllocationInput;
  }): ParticipantWeightResult {
    const policy = input.policy ?? resolvePolicyForCategory(input.category, this.basePolicy);
    validatePolicyCoefficients(policy);

    const sunReyScore = diminishingTransform(
      input.twab.eligibleSunReyTwab,
      policy.srReferenceBalance,
      policy.diminishingReturnFunction,
    );
    const moonReyScore = diminishingTransform(
      input.twab.eligibleMoonReyTwab,
      policy.mrReferenceBalance,
      policy.diminishingReturnFunction,
    );
    const { dualScore, weight } = computeWeightFromScores(policy, sunReyScore, moonReyScore);

    const eligibility = checkParticipantEligibility({
      subjectRef: input.subjectRef,
      participant: input.participant ?? { subjectRef: input.subjectRef },
      policy,
      sunReyTwab: input.twab.eligibleSunReyTwab,
      moonReyTwab: input.twab.eligibleMoonReyTwab,
      participantWeightScaled: weight,
      eligibilityPort: this.eligibilityPort,
    });

    return Object.freeze({
      subjectRef: input.subjectRef,
      category: input.category,
      sunReyTwab: input.twab.eligibleSunReyTwab,
      moonReyTwab: input.twab.eligibleMoonReyTwab,
      normalizedSunReyScoreScaled: sunReyScore,
      normalizedMoonReyScoreScaled: moonReyScore,
      dualScoreScaled: dualScore,
      participantWeightScaled: weight,
      eligible: eligibility.eligible,
      ineligibleReason: eligibility.reason,
      policyId: policy.policyId,
      policyVersion: policy.version,
    });
  }

  computeTwabForParticipant(
    participant: ParticipantAllocationInput,
    periodStart: UtcInstant,
    periodEnd: UtcInstant,
  ): TimeWeightedBalance {
    const checkpoints = resolveCheckpoints(
      participant,
      periodStart,
      periodEnd,
      this.balanceReader,
    );
    const gaming = evaluateAntiGaming(
      participant.subjectRef,
      checkpoints,
      participant.custodySources ?? ['canonical-custody'],
    );
    const twab = computeTimeWeightedBalance({
      subjectRef: participant.subjectRef,
      checkpoints: gaming.excludedFromAllocation ? [] : checkpoints,
      periodStart,
      periodEnd,
    });
    if (gaming.excludedFromAllocation) {
      return Object.freeze({
        ...twab,
        eligibleSunReyTwab: 0n,
        eligibleMoonReyTwab: 0n,
      });
    }
    return twab;
  }

  calculateCategoryAllocation(input: {
    readonly snapshotId: string;
    readonly category: AccessAllocationCategory;
    readonly pool: AccessCapacityPool;
    readonly weights: readonly ParticipantWeightResult[];
    readonly policy?: AccessAllocationPolicy;
    readonly policyVersion?: string;
  }): CategoryAllocationResult {
    const policy = input.policy ?? resolvePolicyForCategory(input.category, this.basePolicy);
    const { records, evidence } = allocateWithRounding({
      pool: input.pool,
      weights: input.weights,
      policy,
      snapshotId: input.snapshotId,
      policyVersion: input.policyVersion ?? policy.version,
    });
    const totalAllocated = records.reduce((sum, row) => sum + row.allocatedUnits, 0n);
    return Object.freeze({
      category: input.category,
      pool: input.pool,
      evidence,
      totalAllocated,
      residualCapacity: residualCapacity(input.pool.allocatableCapacity, totalAllocated),
      totalParticipantWeightScaled: eligibleForCategory(input.weights, input.category).reduce(
        (sum, row) => sum + row.participantWeightScaled,
        0n,
      ),
    });
  }

  generateAllocationSnapshot(input: GenerateSnapshotInput): AllocationSnapshotResult {
    const generatedAt = input.generatedAt ?? asUtcInstant(new Date().toISOString());
    const policy = input.policy ?? this.basePolicy;
    validatePolicyCoefficients(policy);
    const categories =
      input.categories ??
      (input.pools.map((pool) => pool.category) as AccessAllocationCategory[]);

    const twabs = input.participants.map((participant) =>
      this.computeTwabForParticipant(participant, input.periodStart, input.periodEnd),
    );

    const weights: ParticipantWeightResult[] = [];
    for (const category of categories) {
      const categoryPolicy = resolvePolicyForCategory(category, policy);
      for (const participant of input.participants) {
        const twab = twabs.find((row) => row.subjectRef === participant.subjectRef)!;
        weights.push(
          this.calculateParticipantWeight({
            subjectRef: participant.subjectRef,
            category,
            twab,
            policy: categoryPolicy,
            participant,
          }),
        );
      }
    }

    const categoryResults: CategoryAllocationResult[] = [];
    const allEvidence: ParticipantAllocationEvidence[] = [];

    for (const pool of input.pools) {
      const categoryPolicy = resolvePolicyForCategory(pool.category, policy);
      const builtPool = buildCapacityPool(pool);
      const result = this.calculateCategoryAllocation({
        snapshotId: input.snapshotId,
        category: pool.category,
        pool: builtPool,
        weights,
        policy: categoryPolicy,
      });
      categoryResults.push(result);
      allEvidence.push(...result.evidence);
    }

    const primaryPool = input.pools[0];
    if (!primaryPool) {
      throw new RangeError('at least one capacity pool is required');
    }

    const totalWeight = weights
      .filter((row) => row.category === primaryPool.category && row.eligible)
      .reduce((sum, row) => sum + row.participantWeightScaled, 0n);

    const snapshot: AccessAllocationSnapshot = Object.freeze({
      snapshotId: input.snapshotId,
      category: primaryPool.category,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      capacityId: primaryPool.poolId,
      totalCapacity: primaryPool.verifiedGrossCapacity,
      eligibleCapacity: primaryPool.allocatableCapacity ?? 0n,
      participantCount: input.participants.length,
      totalParticipantWeightScaled: totalWeight,
      policyId: policy.policyId,
      policyVersion: policy.version,
      generatedAt,
      inputLedgerSnapshotReference: input.supply.sourceStateCommitment,
      status: input.mode === 'FINALIZE' ? 'FINALIZED' : 'CALCULATING',
      mode: input.mode,
    });

    const entitlements =
      input.mode === 'FINALIZE'
        ? this.createEntitlements({
            snapshotId: input.snapshotId,
            categoryResults,
            expiresAt: input.periodEnd,
          })
        : Object.freeze([]);

    const result: AllocationSnapshotResult = Object.freeze({
      snapshot,
      categoryResults,
      entitlements,
    });

    this.store.saveSnapshot(snapshot);
    this.store.saveEvidence(input.snapshotId, allEvidence);
    if (input.mode === 'FINALIZE') {
      this.store.saveEntitlements(input.snapshotId, entitlements);
    }

    return result;
  }

  finalizeAllocationSnapshot(input: {
    readonly snapshotId: string;
    readonly idempotencyKey: string;
    readonly periodEnd: UtcInstant;
    readonly previewResult: AllocationSnapshotResult;
  }): AllocationSnapshotResult {
    const existing = this.store.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      return existing.result;
    }
    if (this.store.isFinalized(input.snapshotId)) {
      const record = this.store.getFinalizeRecord(input.snapshotId);
      if (record) {
        return record.result;
      }
    }

    const entitlements = this.createEntitlements({
      snapshotId: input.snapshotId,
      categoryResults: input.previewResult.categoryResults,
      expiresAt: input.periodEnd,
    });

    const finalizedSnapshot: AccessAllocationSnapshot = Object.freeze({
      ...input.previewResult.snapshot,
      status: 'FINALIZED',
      mode: 'FINALIZE',
    });

    const result: AllocationSnapshotResult = Object.freeze({
      snapshot: finalizedSnapshot,
      categoryResults: input.previewResult.categoryResults,
      entitlements,
    });

    this.store.saveSnapshot(finalizedSnapshot);
    this.store.saveEntitlements(input.snapshotId, entitlements);
    this.store.recordFinalize(
      Object.freeze({
        snapshotId: input.snapshotId,
        idempotencyKey: input.idempotencyKey,
        finalizedAt: new Date().toISOString(),
        result,
      }),
    );

    return result;
  }

  createEntitlements(input: {
    readonly snapshotId: string;
    readonly categoryResults: readonly CategoryAllocationResult[];
    readonly expiresAt: UtcInstant;
  }): readonly IssuedAccessEntitlement[] {
    const allocations: AccessAllocationRecord[] = [];
    for (const categoryResult of input.categoryResults) {
      for (const evidence of categoryResult.evidence) {
        if (evidence.allocatedUnits === 0n || !evidence.allocationId) {
          continue;
        }
        allocations.push(
          Object.freeze({
            allocationId: evidence.allocationId,
            subjectRef: evidence.subjectRef,
            epochId: input.snapshotId,
            poolId: categoryResult.pool.poolId,
            category: evidence.category,
            allocatedUnits: evidence.allocatedUnits,
            capacityUnit: evidence.capacityUnit,
            weightScaled: evidence.participantWeightScaled,
            economicMode: 'INCLUDED_ACCESS' as const,
            policyVersion: evidence.policyVersion,
            remainderRank: null,
          }),
        );
      }
    }
    return issueEntitlementsFromAllocations({
      allocations,
      expiresAt: input.expiresAt,
    });
  }

  previewUserAllocation(input: {
    readonly subjectRef: SubjectRef;
    readonly category: AccessAllocationCategory;
    readonly snapshotId?: string;
    readonly participant: ParticipantAllocationInput;
    readonly periodStart: UtcInstant;
    readonly periodEnd: UtcInstant;
    readonly pool: AccessCapacityPool;
    readonly supply: EligibleSupplySnapshot;
  }): UserAllocationPreview {
    void input.supply;
    const twab = this.computeTwabForParticipant(input.participant, input.periodStart, input.periodEnd);
    const weight = this.calculateParticipantWeight({
      subjectRef: input.subjectRef,
      category: input.category,
      twab,
      participant: input.participant,
    });

    const builtPool = buildCapacityPool(input.pool);
    const categoryResult = this.calculateCategoryAllocation({
      snapshotId: input.snapshotId ?? 'preview',
      category: input.category,
      pool: builtPool,
      weights: [weight],
    });
    const evidence = categoryResult.evidence.find((row) => row.subjectRef === input.subjectRef);

    return Object.freeze({
      subjectRef: input.subjectRef,
      category: input.category,
      participantWeightScaled: weight.participantWeightScaled,
      estimatedAllocatedUnits: evidence?.allocatedUnits ?? 0n,
      capacityUnit: builtPool.capacityUnit,
      policyId: weight.policyId,
      policyVersion: weight.policyVersion,
      snapshotId: input.snapshotId ?? null,
    });
  }

  getSnapshot(snapshotId: string): AccessAllocationSnapshot | null {
    return this.store.getSnapshot(snapshotId);
  }

  getEvidence(snapshotId: string): readonly ParticipantAllocationEvidence[] {
    return this.store.getEvidence(snapshotId);
  }

  getEntitlements(snapshotId: string): readonly IssuedAccessEntitlement[] {
    return this.store.getEntitlements(snapshotId);
  }
}

export function supplyFromPolicy(policy: AccessAllocationPolicy, commitment: string): EligibleSupplySnapshot {
  return Object.freeze({
    sunReyEligibleBase: policy.srReferenceBalance,
    moonReyEligibleBase: policy.mrReferenceBalance,
    sourceStateCommitment: commitment,
    observedAt: asUtcInstant(new Date().toISOString()),
  });
}

export { CATEGORY_CAPACITY_UNITS, PARTICIPATION_SCALE, COEFF_BPS_SCALE };
