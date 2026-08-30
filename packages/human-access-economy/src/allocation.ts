/**
 * ACCESS-15 BFF projection for dual-token access allocation.
 * Read-only / preview-safe. Does not expose global participant distribution.
 */

import { asUtcInstant } from '../../domain/src/time.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import {
  ACCESS_15_POLICY_VERSION,
  ACCESS_ALLOCATION_CATEGORIES,
  CATEGORY_CAPACITY_UNITS,
  demoEpoch,
  demoParticipants,
  demoPools,
  demoSupply,
  runDualTokenAllocation,
  type AccessAllocationCategory,
  type AllocationRunResult,
} from '../../access-economy/src/dual-token-allocation/index.ts';
import { subjectRefFor } from '../../access-economy/src/ids.ts';
import type { AccessActor } from './access.ts';
import { ACCESS_POSTURE } from './taxonomy.ts';

const USER_SAFE_EXPLANATION =
  'Your Access is based on your time-weighted SunRey and MoonRey participation and the capacity available this period.';

export type AccessEpochView = {
  readonly epochId: string;
  readonly policyVersion: string;
  readonly cadence: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly snapshotCutoff: string;
  readonly status: string;
  readonly explanation: string;
  readonly posture: typeof ACCESS_POSTURE;
};

export type AccessParticipationView = {
  readonly subjectRef: string;
  readonly epochId: string;
  readonly sunReyTwab: string;
  readonly moonReyTwab: string;
  readonly eligibleSunReyTwab: string;
  readonly eligibleMoonReyTwab: string;
  readonly policyVersion: string;
  readonly explanation: string;
  readonly humanScoreExposed: false;
};

export type AccessAllocationCategoryView = {
  readonly category: string;
  readonly capacityUnit: string;
  readonly allocatableCapacity: string;
  readonly policyVersion: string;
};

export type AccessAllocationView = {
  readonly allocationId: string;
  readonly epochId: string;
  readonly category: string;
  readonly allocatedUnits: string;
  readonly capacityUnit: string;
  readonly economicMode: string;
  readonly explanation: string;
};

export type AccessAllocationPreviewInput = {
  readonly epochId?: string;
  readonly categories?: readonly string[];
};

function mapCategory(category: AccessAllocationCategory): string {
  return category;
}

function subjectForActor(actor: AccessActor): string {
  return subjectRefFor(actor.customerId);
}

function findParticipation(result: AllocationRunResult, subjectRef: string) {
  return result.participation.find((row) => row.subjectRef === subjectRef) ?? null;
}

function findAllocations(result: AllocationRunResult, subjectRef: string) {
  return result.allocations.filter((row) => row.subjectRef === subjectRef);
}

export class AccessAllocationProjection {
  private cachedResult: AllocationRunResult | null = null;

  private simulationResult(epochId?: string): AllocationRunResult {
    if (this.cachedResult && (!epochId || this.cachedResult.epoch.epochId === epochId)) {
      return this.cachedResult;
    }
    const epoch = demoEpoch();
    const result = runDualTokenAllocation({
      epoch: epochId ? { ...epoch, epochId } : epoch,
      participants: demoParticipants(),
      supply: demoSupply(),
      pools: demoPools(epoch.epochId),
    });
    this.cachedResult = result;
    return result;
  }

  epoch(actor: AccessActor, epochId?: string): Result<AccessEpochView, { code: string; message: string }> {
    if (actor.restricted) {
      return err({ code: 'FEATURE_DISABLED', message: 'access allocation unavailable for restricted customers' });
    }
    const result = this.simulationResult(epochId);
    return ok(
      Object.freeze({
        epochId: result.epoch.epochId,
        policyVersion: result.epoch.policyVersion,
        cadence: result.epoch.cadence,
        startsAt: result.epoch.startsAt,
        endsAt: result.epoch.endsAt,
        snapshotCutoff: result.epoch.snapshotCutoff,
        status: result.epoch.status,
        explanation: USER_SAFE_EXPLANATION,
        posture: ACCESS_POSTURE,
      }),
    );
  }

  participation(
    actor: AccessActor,
    epochId?: string,
  ): Result<AccessParticipationView, { code: string; message: string }> {
    if (actor.restricted) {
      return err({ code: 'FEATURE_DISABLED', message: 'access allocation unavailable for restricted customers' });
    }
    const result = this.simulationResult(epochId);
    const subjectRef = subjectForActor(actor);
    const row = findParticipation(result, subjectRef);
    if (!row) {
      return ok(
        Object.freeze({
          subjectRef,
          epochId: result.epoch.epochId,
          sunReyTwab: '0',
          moonReyTwab: '0',
          eligibleSunReyTwab: '0',
          eligibleMoonReyTwab: '0',
          policyVersion: ACCESS_15_POLICY_VERSION,
          explanation: USER_SAFE_EXPLANATION,
          humanScoreExposed: false as const,
        }),
      );
    }
    return ok(
      Object.freeze({
        subjectRef: row.subjectRef,
        epochId: row.epochId,
        sunReyTwab: row.sunReyTwab.toString(),
        moonReyTwab: row.moonReyTwab.toString(),
        eligibleSunReyTwab: row.eligibleSunReyTwab.toString(),
        eligibleMoonReyTwab: row.eligibleMoonReyTwab.toString(),
        policyVersion: row.policyVersion,
        explanation: USER_SAFE_EXPLANATION,
        humanScoreExposed: false as const,
      }),
    );
  }

  allocationCategories(epochId?: string): Result<readonly AccessAllocationCategoryView[], { code: string; message: string }> {
    const result = this.simulationResult(epochId);
    return ok(
      Object.freeze(
        result.pools.map((pool) =>
          Object.freeze({
            category: mapCategory(pool.category),
            capacityUnit: pool.capacityUnit,
            allocatableCapacity: pool.allocatableCapacity.toString(),
            policyVersion: ACCESS_15_POLICY_VERSION,
          }),
        ),
      ),
    );
  }

  allocation(actor: AccessActor, epochId?: string): Result<readonly AccessAllocationView[], { code: string; message: string }> {
    if (actor.restricted) {
      return err({ code: 'FEATURE_DISABLED', message: 'access allocation unavailable for restricted customers' });
    }
    const result = this.simulationResult(epochId);
    const subjectRef = subjectForActor(actor);
    return ok(
      Object.freeze(
        findAllocations(result, subjectRef).map((row) =>
          Object.freeze({
            allocationId: row.allocationId,
            epochId: row.epochId,
            category: row.category,
            allocatedUnits: row.allocatedUnits.toString(),
            capacityUnit: row.capacityUnit,
            economicMode: row.economicMode,
            explanation: USER_SAFE_EXPLANATION,
          }),
        ),
      ),
    );
  }

  allocationHistory(actor: AccessActor): Result<readonly AccessAllocationView[], { code: string; message: string }> {
    return this.allocation(actor);
  }

  allocationPreview(
    actor: AccessActor,
    input: AccessAllocationPreviewInput = {},
  ): Result<
    {
      readonly epoch: AccessEpochView;
      readonly participation: AccessParticipationView;
      readonly allocations: readonly AccessAllocationView[];
      readonly categories: readonly AccessAllocationCategoryView[];
      readonly explanation: string;
      readonly simulationOnly: true;
      readonly calculatedAt: string;
    },
    { code: string; message: string }
  > {
    if (actor.restricted) {
      return err({ code: 'FEATURE_DISABLED', message: 'access allocation preview unavailable for restricted customers' });
    }
    const epochOutcome = this.epoch(actor, input.epochId);
    if (!epochOutcome.ok) {
      return epochOutcome;
    }
    const participationOutcome = this.participation(actor, input.epochId);
    if (!participationOutcome.ok) {
      return participationOutcome;
    }
    const allocationOutcome = this.allocation(actor, input.epochId);
    if (!allocationOutcome.ok) {
      return allocationOutcome;
    }
    const categoriesOutcome = this.allocationCategories(input.epochId);
    if (!categoriesOutcome.ok) {
      return categoriesOutcome;
    }

    const filteredCategories =
      input.categories && input.categories.length > 0
        ? categoriesOutcome.value.filter((row) => input.categories!.includes(row.category))
        : categoriesOutcome.value;

    const filteredAllocations =
      input.categories && input.categories.length > 0
        ? allocationOutcome.value.filter((row) => input.categories!.includes(row.category))
        : allocationOutcome.value;

    return ok(
      Object.freeze({
        epoch: epochOutcome.value,
        participation: participationOutcome.value,
        allocations: filteredAllocations,
        categories: filteredCategories,
        explanation: USER_SAFE_EXPLANATION,
        simulationOnly: true as const,
        calculatedAt: asUtcInstant('2026-08-31T23:59:59.999Z'),
      }),
    );
  }
}

export const ACCESS_15_BFF_CATEGORIES = ACCESS_ALLOCATION_CATEGORIES;
export const ACCESS_15_CAPACITY_UNITS = CATEGORY_CAPACITY_UNITS;
