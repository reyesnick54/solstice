/**
 * Access capacity pool derivation.
 * ALLOCATABLE_ACCESS <= VERIFIED_AND_FUNDED_CAPACITY — never invent capacity.
 */

import type { AccessCapacityPool, AccessAllocationCategory } from './types.ts';

export function deriveAllocatableCapacity(pool: Omit<AccessCapacityPool, 'allocatableCapacity'>): bigint {
  const verifiedAndFunded =
    pool.verifiedGrossCapacity + pool.fundedExternalCapacity + pool.providerCommittedCapacity;
  const committed =
    pool.reservedCapacity + pool.policyReservedCapacity;
  const remaining = verifiedAndFunded - committed;
  return remaining > 0n ? remaining : 0n;
}

export function buildCapacityPool(
  input: Omit<AccessCapacityPool, 'allocatableCapacity'> & { readonly allocatableCapacity?: bigint },
): AccessCapacityPool {
  const allocatable = input.allocatableCapacity ?? deriveAllocatableCapacity(input);
  const verifiedAndFunded =
    input.verifiedGrossCapacity + input.fundedExternalCapacity + input.providerCommittedCapacity;
  if (allocatable > verifiedAndFunded) {
    throw new RangeError('allocatable capacity cannot exceed verified and funded capacity');
  }
  return Object.freeze({
    ...input,
    allocatableCapacity: allocatable,
  });
}

export const CATEGORY_CAPACITY_UNITS: Readonly<Record<AccessAllocationCategory, string>> = Object.freeze({
  MOBILITY: 'VEHICLE_DAY',
  TRAVEL: 'TRAVEL_UNIT',
  STAY: 'ROOM_NIGHT',
  FOOD: 'MEAL_UNIT',
  SHOP: 'COMMERCE_UNIT',
  EXPERIENCES: 'EXPERIENCE_UNIT',
  AI_COMPUTE: 'GPU_HOUR',
  ROBOTICS: 'ROBOT_HOUR',
  ENERGY: 'KWH',
});
