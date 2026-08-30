/**
 * ACCESS-15-style dual-economy access allocation with diminishing returns.
 *
 * Token market price does not directly alter allocation weight. Only holdings
 * and relative participation matter. Dual holders receive a bounded bonus.
 * Small holders retain a non-zero floor after integer rounding.
 */

import { DeterministicRng, mulBps, ratioBps } from '../seed.ts';
import type { AccessAllocationRow, ParticipantTokenDistribution, TokenPricePath } from './types.ts';

/** Square-root diminishing returns on token weight (bps scale). */
function diminishingWeightBps(holdingsMinor: bigint, scaleMinor: bigint): bigint {
  if (holdingsMinor <= 0n) {
    return 0n;
  }
  const normalized = (holdingsMinor * 10_000n) / (scaleMinor > 0n ? scaleMinor : 1n);
  const root = bigintSqrt(normalized);
  return root * 100n;
}

function bigintSqrt(value: bigint): bigint {
  if (value < 0n) {
    throw new RangeError('sqrt of negative');
  }
  if (value < 2n) {
    return value;
  }
  let x0 = value;
  let x1 = (x0 + value / x0) / 2n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + value / x0) / 2n;
  }
  return x0;
}

/** Dual-holder bonus is additive and capped — not a fixed SR/MR ratio. */
const DUAL_HOLDER_BONUS_BPS = 1_500n;
const SMALL_HOLDER_FLOOR_UNITS = 1n;

export type AllocationInput = Readonly<{
  readonly participants: readonly ParticipantTokenDistribution[];
  readonly allocatableUnits: bigint;
  readonly tokenPricePath: TokenPricePath;
  readonly seed: number;
}>;

export type AllocationOutput = Readonly<{
  readonly allocations: readonly AccessAllocationRow[];
  readonly totalAllocatedUnits: bigint;
  readonly totalWeightBps: bigint;
  readonly priceInfluencedAllocation: false;
}>;

/**
 * Compute access allocation from SR/MR holdings.
 *
 * Price path is observed for invariant checks only — it must not enter the
 * weight function. Data quantity and productive contribution do not multiply
 * access directly.
 */
export function computeDualEconomyAccessAllocation(input: AllocationInput): AllocationOutput {
  if (input.allocatableUnits < 0n) {
    throw new RangeError('allocatableUnits must be non-negative');
  }
  if (input.participants.length === 0) {
    return Object.freeze({
      allocations: Object.freeze([]),
      totalAllocatedUnits: 0n,
      totalWeightBps: 0n,
      priceInfluencedAllocation: false,
    });
  }

  const maxSr = input.participants.reduce((max, row) => (row.sunreyMinor > max ? row.sunreyMinor : max), 1n);
  const maxMr = input.participants.reduce((max, row) => (row.moonreyMinor > max ? row.moonreyMinor : max), 1n);

  const weights: { subjectId: string; weightBps: bigint; participant: ParticipantTokenDistribution }[] = [];
  for (const participant of input.participants) {
    let weightBps = diminishingWeightBps(participant.sunreyMinor, maxSr) + diminishingWeightBps(participant.moonreyMinor, maxMr);
    if (participant.dualHolder) {
      weightBps += DUAL_HOLDER_BONUS_BPS;
    }
    weights.push({ subjectId: participant.subjectId, weightBps, participant });
  }

  const totalWeightBps = weights.reduce((sum, row) => sum + row.weightBps, 0n);
  const rng = new DeterministicRng(input.seed);

  const provisional: { subjectId: string; units: bigint; weightBps: bigint; participant: ParticipantTokenDistribution }[] = [];
  let allocated = 0n;

  for (const row of weights) {
    const shareBps = totalWeightBps > 0n ? ratioBps(row.weightBps, totalWeightBps) : 0n;
    let units = mulBps(input.allocatableUnits, shareBps);
    if (units === 0n && row.weightBps > 0n && input.allocatableUnits >= SMALL_HOLDER_FLOOR_UNITS) {
      units = SMALL_HOLDER_FLOOR_UNITS;
    }
    provisional.push({ subjectId: row.subjectId, units, weightBps: row.weightBps, participant: row.participant });
    allocated += units;
  }

  if (allocated > input.allocatableUnits) {
    const sorted = [...provisional].sort((left, right) => {
      const leftRoll = rng.nextBps();
      const rightRoll = rng.nextBps();
      if (left.units !== right.units) {
        return left.units > right.units ? -1 : 1;
      }
      return leftRoll < rightRoll ? -1 : 1;
    });
    let excess = allocated - input.allocatableUnits;
    for (const row of sorted) {
      if (excess === 0n) {
        break;
      }
      const reducible = row.units > SMALL_HOLDER_FLOOR_UNITS ? row.units - SMALL_HOLDER_FLOOR_UNITS : 0n;
      const take = reducible < excess ? reducible : excess;
      row.units -= take;
      excess -= take;
    }
    allocated = input.allocatableUnits;
  }

  const allocations: AccessAllocationRow[] = provisional.map((row) =>
    Object.freeze({
      subjectId: row.subjectId,
      allocatedUnits: row.units,
      allocationWeightBps: row.weightBps,
      sunreyMinor: row.participant.sunreyMinor,
      moonreyMinor: row.participant.moonreyMinor,
      dualHolder: row.participant.dualHolder,
    }),
  );

  return Object.freeze({
    allocations: Object.freeze(allocations),
    totalAllocatedUnits: allocations.reduce((sum, row) => sum + row.allocatedUnits, 0n),
    totalWeightBps,
    priceInfluencedAllocation: false,
  });
}

/** Verify price path change alone does not change allocation. */
export function allocationInvariantToPrice(
  participants: readonly ParticipantTokenDistribution[],
  allocatableUnits: bigint,
  priceA: TokenPricePath,
  priceB: TokenPricePath,
  seed: number,
): boolean {
  const a = computeDualEconomyAccessAllocation({ participants, allocatableUnits, tokenPricePath: priceA, seed });
  const b = computeDualEconomyAccessAllocation({ participants, allocatableUnits, tokenPricePath: priceB, seed });
  if (a.allocations.length !== b.allocations.length) {
    return false;
  }
  for (let index = 0; index < a.allocations.length; index += 1) {
    if (a.allocations[index]!.allocatedUnits !== b.allocations[index]!.allocatedUnits) {
      return false;
    }
  }
  return true;
}
