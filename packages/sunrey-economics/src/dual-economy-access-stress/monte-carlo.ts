/**
 * Seeded Monte Carlo property stream for ACCESS-22.
 */

import { DeterministicRng } from '../seed.ts';
import { computeDualEconomyAccessAllocation } from './allocation.ts';
import { benchmarkParticipant } from './participants.ts';
import type { TokenPricePath } from './types.ts';

const DEFAULT_PRICE: TokenPricePath = Object.freeze({
  srPriceBps: 10_000n,
  mrPriceBps: 10_000n,
  srPriceChangeBps: 0n,
  mrPriceChangeBps: 0n,
});

export function runMonteCarloStream(runs: number, seed: number): Readonly<{ readonly violations: number; readonly runs: number }> {
  const rng = new DeterministicRng(seed);
  let violations = 0;
  for (let index = 0; index < runs; index += 1) {
    const allocatableUnits = BigInt(10_000 + rng.nextBounded(90_000));
    const price: TokenPricePath = Object.freeze({
      srPriceBps: BigInt(1_000 + rng.nextBounded(50_000)),
      mrPriceBps: BigInt(1_000 + rng.nextBounded(50_000)),
      srPriceChangeBps: BigInt(rng.nextBounded(20_000) - 10_000),
      mrPriceChangeBps: BigInt(rng.nextBounded(20_000) - 10_000),
    });
    const participant = Object.freeze({
      ...benchmarkParticipant(),
      sunreyMinor: BigInt(10 + rng.nextBounded(1_000)),
      moonreyMinor: BigInt(10 + rng.nextBounded(1_000)),
      dualHolder: true,
    });
    const a = computeDualEconomyAccessAllocation({
      participants: [participant],
      allocatableUnits,
      tokenPricePath: DEFAULT_PRICE,
      seed: seed + index,
    });
    const b = computeDualEconomyAccessAllocation({
      participants: [participant],
      allocatableUnits,
      tokenPricePath: price,
      seed: seed + index,
    });
    if (a.totalAllocatedUnits !== b.totalAllocatedUnits) {
      violations += 1;
    }
    if (a.totalAllocatedUnits > allocatableUnits) {
      violations += 1;
    }
  }
  return Object.freeze({ violations, runs });
}
