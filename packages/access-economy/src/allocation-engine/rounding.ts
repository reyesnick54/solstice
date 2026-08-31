/**
 * Deterministic rounding for capacity allocation.
 * Never allows total allocations to exceed available capacity.
 */

import type { UnitRoundingMode } from './types.ts';

export const MILLI_UNIT_SCALE = 1_000n as const;

export function unitScaleForMode(mode: UnitRoundingMode): bigint {
  return mode === 'FRACTIONAL_MILLI' ? MILLI_UNIT_SCALE : 1n;
}

export function toScaledUnits(rawUnits: bigint, mode: UnitRoundingMode): bigint {
  return rawUnits * unitScaleForMode(mode);
}

export function fromScaledUnits(scaledUnits: bigint, mode: UnitRoundingMode): bigint {
  const scale = unitScaleForMode(mode);
  return scaledUnits / scale;
}

export function floorProportionalShare(
  weightScaled: bigint,
  totalWeightScaled: bigint,
  capacityScaled: bigint,
): { readonly floorUnits: bigint; readonly remainder: bigint } {
  if (totalWeightScaled === 0n || capacityScaled === 0n) {
    return Object.freeze({ floorUnits: 0n, remainder: 0n });
  }
  const product = weightScaled * capacityScaled;
  return Object.freeze({
    floorUnits: product / totalWeightScaled,
    remainder: product % totalWeightScaled,
  });
}

export function applyParticipantCap(
  units: bigint,
  capacity: bigint,
  maximumShareBps: number | null,
): bigint {
  if (maximumShareBps === null || capacity === 0n) {
    return units;
  }
  const cap = (capacity * BigInt(maximumShareBps)) / 10_000n;
  return units > cap ? cap : units;
}

export function residualCapacity(capacity: bigint, allocated: bigint): bigint {
  return capacity > allocated ? capacity - allocated : 0n;
}
