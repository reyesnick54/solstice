/**
 * Deterministic seeded integer stream.
 *
 * Every Monte Carlo or scenario run records its seed. Output is not a
 * future financial prediction.
 */

export class DeterministicRng {
  private state: number;
  readonly seed: number;

  constructor(seed: number) {
    if (!Number.isInteger(seed) || seed < 0) {
      throw new TypeError('seed must be a non-negative integer');
    }
    this.seed = seed;
    this.state = (seed ^ 0x9e3779b9) >>> 0;
  }

  nextUint(): number {
    this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0;
    return this.state;
  }

  nextBps(maxInclusive = 10_000): bigint {
    return BigInt(this.nextUint() % (maxInclusive + 1));
  }

  nextBounded(maxExclusive: number): number {
    if (maxExclusive <= 0) {
      throw new TypeError('maxExclusive must be positive');
    }
    return this.nextUint() % maxExclusive;
  }

  jitterBps(centerBps: bigint, amplitudeBps: bigint): bigint {
    if (amplitudeBps === 0n) {
      return centerBps;
    }
    const span = Number(amplitudeBps * 2n + 1n);
    const delta = BigInt(this.nextBounded(span)) - amplitudeBps;
    const next = centerBps + delta;
    return next < 1n ? 1n : next;
  }
}

export function mulBps(value: bigint, bps: bigint): bigint {
  return (value * bps) / 10_000n;
}

export function ratioBps(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    return 0n;
  }
  return (numerator * 10_000n) / denominator;
}

export function ratioIndex(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    return 0n;
  }
  return (numerator * 1_000_000n) / denominator;
}

export function herfindahl(shares: readonly bigint[]): bigint {
  const total = shares.reduce((sum, share) => sum + share, 0n);
  if (total === 0n) {
    return 0n;
  }
  return shares.reduce((sum, share) => {
    const weight = (share * 10_000n) / total;
    return sum + weight * weight;
  }, 0n);
}

export function assertNoForbiddenLabels(text: string): void {
  const lowered = text.toLowerCase();
  for (const label of ['guaranteed value', 'expected guaranteed return', 'certain appreciation']) {
    if (lowered.includes(label)) {
      throw new Error(`forbidden price/return label: ${label}`);
    }
  }
}
