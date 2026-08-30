/**
 * Deterministic proportional allocation with largest-remainder method.
 */

import type { SubjectRef } from '../ids.ts';
import type {
  AccessAllocationCategory,
  AccessAllocationRecord,
  AccessCapacityPool,
  AccessEconomicMode,
  NormalizedParticipation,
} from './types.ts';

export type AllocationConstraints = {
  readonly minimumAllocation: bigint;
  readonly maximumAllocation: bigint | null;
  readonly categoryCap: bigint | null;
};

export const DEFAULT_ALLOCATION_CONSTRAINTS: AllocationConstraints = Object.freeze({
  minimumAllocation: 0n,
  maximumAllocation: null,
  categoryCap: null,
});

type RemainderCandidate = {
  readonly subjectRef: SubjectRef;
  readonly weightScaled: bigint;
  readonly floorUnits: bigint;
  readonly remainder: bigint;
};

function compareSubjectRef(left: SubjectRef, right: SubjectRef): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function allocateProportional(input: {
  readonly epochId: string;
  readonly pool: AccessCapacityPool;
  readonly participants: readonly NormalizedParticipation[];
  readonly policyVersion: string;
  readonly economicMode?: AccessEconomicMode;
  readonly constraints?: AllocationConstraints;
  readonly allocationIdPrefix?: string;
}): readonly AccessAllocationRecord[] {
  const constraints = input.constraints ?? DEFAULT_ALLOCATION_CONSTRAINTS;
  const economicMode = input.economicMode ?? 'INCLUDED_ACCESS';
  const capacity = input.pool.allocatableCapacity;
  if (capacity === 0n) {
    return Object.freeze([]);
  }

  const eligible = input.participants.filter((row) => row.weightScaled > 0n);
  const totalWeight = eligible.reduce((sum, row) => sum + row.weightScaled, 0n);
  if (totalWeight === 0n) {
    return Object.freeze([]);
  }

  const effectiveCapacity =
    constraints.categoryCap !== null && constraints.categoryCap < capacity
      ? constraints.categoryCap
      : capacity;

  const candidates: RemainderCandidate[] = eligible.map((row) => {
    const product = row.weightScaled * effectiveCapacity;
    const floorUnits = product / totalWeight;
    const remainder = product % totalWeight;
    return {
      subjectRef: row.subjectRef,
      weightScaled: row.weightScaled,
      floorUnits,
      remainder,
    };
  });

  let distributed = candidates.reduce((sum, row) => sum + row.floorUnits, 0n);
  let remaining = effectiveCapacity - distributed;
  const ranked = [...candidates].sort((left, right) => {
    if (left.remainder !== right.remainder) {
      return left.remainder > right.remainder ? -1 : 1;
    }
    return compareSubjectRef(left.subjectRef, right.subjectRef);
  });

  const bonusUnits = new Map<string, bigint>();
  const remainderRank = new Map<string, number>();
  let rank = 0;
  for (const candidate of ranked) {
    if (remaining === 0n) {
      break;
    }
    if (candidate.floorUnits === 0n && candidate.remainder === 0n) {
      continue;
    }
    rank += 1;
    bonusUnits.set(candidate.subjectRef, (bonusUnits.get(candidate.subjectRef) ?? 0n) + 1n);
    remainderRank.set(candidate.subjectRef, rank);
    remaining -= 1n;
    distributed += 1n;
  }

  const candidateBySubject = new Map(candidates.map((row) => [row.subjectRef, row]));

  const prefix = input.allocationIdPrefix ?? 'alloc';
  const records: AccessAllocationRecord[] = [];

  for (const row of eligible) {
    const candidate = candidateBySubject.get(row.subjectRef)!;
    let units = candidate.floorUnits + (bonusUnits.get(row.subjectRef) ?? 0n);
    if (units < constraints.minimumAllocation) {
      units = 0n;
    }
    if (constraints.maximumAllocation !== null && units > constraints.maximumAllocation) {
      units = constraints.maximumAllocation;
    }
    if (units === 0n) {
      continue;
    }
    records.push(
      Object.freeze({
        allocationId: `${prefix}-${input.epochId}-${input.pool.poolId}-${row.subjectRef}`,
        subjectRef: row.subjectRef,
        epochId: input.epochId,
        poolId: input.pool.poolId,
        category: input.pool.category as AccessAllocationCategory,
        allocatedUnits: units,
        capacityUnit: input.pool.capacityUnit,
        weightScaled: row.weightScaled,
        economicMode,
        policyVersion: input.policyVersion,
        remainderRank: remainderRank.get(row.subjectRef) ?? null,
      }),
    );
  }

  return Object.freeze(records);
}

export function totalAllocated(allocations: readonly AccessAllocationRecord[]): bigint {
  return allocations.reduce((sum, row) => sum + row.allocatedUnits, 0n);
}

export function assertNoOverAllocation(
  pool: AccessCapacityPool,
  allocations: readonly AccessAllocationRecord[],
): void {
  const total = totalAllocated(allocations);
  if (total > pool.allocatableCapacity) {
    throw new RangeError(
      `allocation ${total} exceeds pool allocatable capacity ${pool.allocatableCapacity}`,
    );
  }
}
