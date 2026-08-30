/**
 * ACCESS-15 fixed-point arithmetic.
 * Canonical allocation logic uses bigint only — no floating point.
 */

/** Normalized participation and transform outputs use 1e6 scale. */
export const PARTICIPATION_SCALE = 1_000_000n as const;

/** Policy coefficients are basis points; alpha + beta + gamma <= COEFF_BPS_SCALE. */
export const COEFF_BPS_SCALE = 10_000n as const;

export function isqrt(value: bigint): bigint {
  if (value < 0n) {
    throw new RangeError('isqrt of a negative value is undefined');
  }
  if (value < 2n) {
    return value;
  }
  let x0 = value;
  let x1 = (value >> 1n) + 1n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x1 + value / x1) >> 1n;
  }
  return x0;
}

/** Fixed-point ratio: (numerator * PARTICIPATION_SCALE) / denominator, truncating toward zero. */
export function ratioScaled(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new RangeError('ratio denominator must be non-zero');
  }
  return (numerator * PARTICIPATION_SCALE) / denominator;
}

/**
 * Concave transform g(x) = sqrt(x) over fixed-point participation x_scaled.
 * x_scaled represents x * PARTICIPATION_SCALE.
 */
export function sqrtTransformScaled(xScaled: bigint): bigint {
  if (xScaled < 0n) {
    throw new RangeError('participation cannot be negative');
  }
  if (xScaled === 0n) {
    return 0n;
  }
  return isqrt(xScaled * PARTICIPATION_SCALE);
}

/** sqrt(g(s) * g(m)) when g outputs are PARTICIPATION_SCALE-scaled. */
export function dualBonusTerm(gSunReyScaled: bigint, gMoonReyScaled: bigint): bigint {
  if (gSunReyScaled === 0n || gMoonReyScaled === 0n) {
    return 0n;
  }
  return isqrt(gSunReyScaled * gMoonReyScaled);
}

/** Weighted sum of three PARTICIPATION_SCALE-scaled terms with bps coefficients. */
export function weightedParticipation(
  alphaBps: bigint,
  gSunReyScaled: bigint,
  betaBps: bigint,
  gMoonReyScaled: bigint,
  gammaBps: bigint,
  dualBonusScaled: bigint,
): bigint {
  return (
    alphaBps * gSunReyScaled + betaBps * gMoonReyScaled + gammaBps * dualBonusScaled
  ) / COEFF_BPS_SCALE;
}
