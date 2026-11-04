import type { UtcInstant } from '@solstice/domain';

/** Ratio helpers — money stays bigint; ratios use basis points (10_000 = 100%). */

export function growthBps(current: bigint, prior: bigint): bigint | null {
  if (prior === 0n) {
    return null;
  }
  return ((current - prior) * 10_000n) / prior;
}

export function ratioBps(numerator: bigint, denominator: bigint): bigint | null {
  if (denominator === 0n) {
    return null;
  }
  return (numerator * 10_000n) / denominator;
}

export function marginBps(numerator: bigint, revenue: bigint): bigint | null {
  return ratioBps(numerator, revenue);
}

export function absBig(n: bigint): bigint {
  return n < 0n ? -n : n;
}

export function maxKnowableAt(times: readonly (string | null | undefined)[], fallback: string): string {
  let max = Date.parse(fallback);
  for (const row of times) {
    if (!row) continue;
    const parsed = Date.parse(row);
    if (parsed > max) {
      max = parsed;
    }
  }
  return new Date(max).toISOString().replace(/\.\d{3}Z$/, '.000Z') as UtcInstant;
}
