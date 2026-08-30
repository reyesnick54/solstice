/**
 * ACCESS-15 Dual-Token Access Allocation engine.
 */

import { asUtcInstant } from '../../../domain/src/time.ts';
import { subjectRefFor, type SubjectRef } from '../ids.ts';
import { allocateProportional, assertNoOverAllocation } from './allocate.ts';
import { evaluateAntiGaming } from './anti-gaming.ts';
import { buildCapacityPool, CATEGORY_CAPACITY_UNITS } from './capacity.ts';
import { issueEntitlementsFromAllocations } from './entitlement.ts';
import { PARTICIPATION_SCALE } from './fixed-point.ts';
import { modeAllowsEpochAllocation } from './modes.ts';
import { computeNormalizedWeight } from './participation.ts';
import {
  assertCoefficientConstraints,
  DEFAULT_SQRT_TRANSFORM,
  SIMULATION_DUAL_PARTICIPATION_POLICY,
} from './policy.ts';
import { computeTwab, flatEpochCheckpoints } from './twab.ts';
import type {
  AccessAllocationCategory,
  AccessCapacityPool,
  AccessCommitmentKind,
  AccessEconomicMode,
  AccessEpoch,
  AllocationRunResult,
  BalanceCheckpoint,
  EligibleSupplySnapshot,
  TokenParticipationSnapshot,
} from './types.ts';
import { ACCESS_15_POLICY_VERSION } from './types.ts';
import { SIMULATION_COMMITMENT_POLICIES } from './policy.ts';

export type ParticipantInput = {
  readonly subjectRef: SubjectRef;
  readonly checkpoints?: readonly BalanceCheckpoint[];
  readonly sunReyLiquid?: bigint;
  readonly moonReyLiquid?: bigint;
  readonly custodySources?: readonly string[];
  readonly commitmentKind?: AccessCommitmentKind;
};

export type RunAllocationInput = {
  readonly epoch: AccessEpoch;
  readonly participants: readonly ParticipantInput[];
  readonly supply: EligibleSupplySnapshot;
  readonly pools: readonly (Omit<AccessCapacityPool, 'allocatableCapacity'> & {
    readonly allocatableCapacity?: bigint;
  })[];
  readonly categories?: readonly AccessAllocationCategory[];
  readonly economicMode?: AccessEconomicMode;
  readonly calculatedAt?: string;
};

function commitmentMultiplier(kind: AccessCommitmentKind | undefined): bigint {
  const policy =
    SIMULATION_COMMITMENT_POLICIES.find((row) => row.kind === (kind ?? 'LIQUID')) ??
    SIMULATION_COMMITMENT_POLICIES[0]!;
  return policy.participationMultiplierScaled > policy.maximumMultiplierScaled
    ? policy.maximumMultiplierScaled
    : policy.participationMultiplierScaled;
}

export function buildParticipationSnapshots(
  epoch: AccessEpoch,
  participants: readonly ParticipantInput[],
  supply: EligibleSupplySnapshot,
  calculatedAt: string,
): readonly TokenParticipationSnapshot[] {
  return Object.freeze(
    participants.map((participant) => {
      const checkpoints =
        participant.checkpoints ??
        flatEpochCheckpoints(
          participant.subjectRef,
          epoch,
          participant.sunReyLiquid ?? 0n,
          participant.moonReyLiquid ?? 0n,
        );
      const gaming = evaluateAntiGaming(
        participant.subjectRef,
        checkpoints,
        participant.custodySources ?? ['canonical-custody'],
      );
      const twab = computeTwab(epoch, gaming.excludedFromAllocation ? [] : checkpoints);
      return Object.freeze({
        subjectRef: participant.subjectRef,
        epochId: epoch.epochId,
        sunReyTwab: twab.sunReyTwab,
        moonReyTwab: twab.moonReyTwab,
        eligibleSunReyTwab: gaming.excludedFromAllocation ? 0n : twab.eligibleSunReyTwab,
        eligibleMoonReyTwab: gaming.excludedFromAllocation ? 0n : twab.eligibleMoonReyTwab,
        policyVersion: ACCESS_15_POLICY_VERSION,
        sourceStateCommitment: supply.sourceStateCommitment,
        calculatedAt: asUtcInstant(calculatedAt),
      });
    }),
  );
}

export function runDualTokenAllocation(input: RunAllocationInput): AllocationRunResult {
  assertCoefficientConstraints(SIMULATION_DUAL_PARTICIPATION_POLICY);
  const calculatedAt = input.calculatedAt ?? input.epoch.endsAt;
  const economicMode = input.economicMode ?? 'INCLUDED_ACCESS';
  const categories =
    input.categories ??
    (Object.keys(CATEGORY_CAPACITY_UNITS) as AccessAllocationCategory[]);

  const participation = buildParticipationSnapshots(
    input.epoch,
    input.participants,
    input.supply,
    calculatedAt,
  );

  const builtPools = input.pools.map((pool) => buildCapacityPool(pool));
  const normalized = categories.flatMap((category) =>
    participation.map((snapshot) =>
      computeNormalizedWeight(
        snapshot.subjectRef,
        input.epoch.epochId,
        category,
        snapshot,
        input.supply,
        DEFAULT_SQRT_TRANSFORM,
        SIMULATION_DUAL_PARTICIPATION_POLICY,
        commitmentMultiplier(
          input.participants.find((row) => row.subjectRef === snapshot.subjectRef)?.commitmentKind,
        ),
      ),
    ),
  );

  const allocations = builtPools.flatMap((pool) => {
    const poolParticipants = normalized.filter((row) => row.category === pool.category);
    const records = modeAllowsEpochAllocation(economicMode)
      ? allocateProportional({
          epochId: input.epoch.epochId,
          pool,
          participants: poolParticipants,
          policyVersion: ACCESS_15_POLICY_VERSION,
          economicMode,
        })
      : [];
    assertNoOverAllocation(pool, records);
    return records;
  });

  const entitlements = issueEntitlementsFromAllocations({
    allocations,
    expiresAt: input.epoch.endsAt,
    economicMode,
  });

  return Object.freeze({
    epoch: input.epoch,
    participation,
    normalized,
    allocations,
    entitlements,
    pools: builtPools,
    policyVersion: ACCESS_15_POLICY_VERSION,
    sourceStateCommitment: input.supply.sourceStateCommitment,
  });
}

export function demoEpoch(): AccessEpoch {
  return Object.freeze({
    epochId: 'epoch-2026-08',
    policyVersion: ACCESS_15_POLICY_VERSION,
    cadence: 'MONTHLY',
    startsAt: asUtcInstant('2026-08-01T00:00:00.000Z'),
    endsAt: asUtcInstant('2026-08-31T23:59:59.999Z'),
    snapshotCutoff: asUtcInstant('2026-08-31T23:59:59.999Z'),
    allocationFinalizedAt: null,
    status: 'ALLOCATING',
  });
}

export function demoSupply(): EligibleSupplySnapshot {
  return Object.freeze({
    sunReyEligibleBase: 10_000n,
    moonReyEligibleBase: 10_000n,
    sourceStateCommitment: 'sim-supply-commitment-v1',
    observedAt: asUtcInstant('2026-08-31T23:59:59.999Z'),
  });
}

export function demoParticipants(): ParticipantInput[] {
  return [
    { subjectRef: subjectRefFor('participant-a'), sunReyLiquid: 100n, moonReyLiquid: 100n },
    { subjectRef: subjectRefFor('participant-b'), sunReyLiquid: 1_000n, moonReyLiquid: 10n },
    { subjectRef: subjectRefFor('participant-c'), sunReyLiquid: 10n, moonReyLiquid: 1_000n },
    { subjectRef: subjectRefFor('participant-d'), sunReyLiquid: 400n, moonReyLiquid: 400n },
  ];
}

export function demoPools(epochId: string): ReturnType<typeof buildCapacityPool>[] {
  const categories = Object.keys(CATEGORY_CAPACITY_UNITS) as AccessAllocationCategory[];
  return categories.map((category) =>
    buildCapacityPool({
      poolId: `pool-${epochId}-${category.toLowerCase()}`,
      epochId,
      category,
      geography: 'GLOBAL_SIM',
      timeWindow: epochId,
      capacityUnit: CATEGORY_CAPACITY_UNITS[category],
      verifiedGrossCapacity: 1_000n,
      reservedCapacity: 50n,
      providerCommittedCapacity: 100n,
      fundedExternalCapacity: 0n,
      policyReservedCapacity: 50n,
      sourceRefs: Object.freeze(['sunrey-access-fabric:productive-capacity']),
      evidenceRefs: Object.freeze(['evidence:capacity-verified-sim']),
      status: 'VERIFIED',
    }),
  );
}

export function syntheticParticipants(count: number, seed: number): ParticipantInput[] {
  const rows: ParticipantInput[] = [];
  let state = BigInt(seed);
  for (let index = 0; index < count; index += 1) {
    state = (state * 1_103_515_245n + 12_345n) % 2_147_483_647n;
    const sunRey = (state % 5_000n) + 1n;
    state = (state * 1_103_515_245n + 12_345n) % 2_147_483_647n;
    const moonRey = (state % 5_000n) + 1n;
    rows.push({
      subjectRef: subjectRefFor(`synthetic-${index}`),
      sunReyLiquid: sunRey,
      moonReyLiquid: moonRey,
    });
  }
  return rows;
}

export function eligibleSupplyForParticipants(
  participants: readonly ParticipantInput[],
  commitment: string,
): EligibleSupplySnapshot {
  const sunRey = participants.reduce((sum, row) => sum + (row.sunReyLiquid ?? 0n), 0n);
  const moonRey = participants.reduce((sum, row) => sum + (row.moonReyLiquid ?? 0n), 0n);
  const base = sunRey > moonRey ? sunRey : moonRey;
  return Object.freeze({
    sunReyEligibleBase: base > 0n ? base : PARTICIPATION_SCALE,
    moonReyEligibleBase: base > 0n ? base : PARTICIPATION_SCALE,
    sourceStateCommitment: commitment,
    observedAt: asUtcInstant('2026-08-31T23:59:59.999Z'),
  });
}
