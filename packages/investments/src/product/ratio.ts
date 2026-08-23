/**
 * Integer rational arithmetic for performance and allocation.
 * No JavaScript number, no parseFloat, no IEEE-754 intermediate.
 */

export type Ratio = {
  readonly num: bigint;
  readonly den: bigint;
};

export function absBig(value: bigint): bigint {
  return value < 0n ? -value : value;
}

export function gcd(left: bigint, right: bigint): bigint {
  let a = absBig(left);
  let b = absBig(right);
  while (b !== 0n) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a === 0n ? 1n : a;
}

export function ratio(num: bigint, den: bigint): Ratio {
  if (den === 0n) {
    throw new RangeError('ratio denominator must be non-zero');
  }
  const sign = den < 0n ? -1n : 1n;
  const factor = gcd(num, den);
  return Object.freeze({
    num: (num / factor) * sign,
    den: (den / factor) * sign,
  });
}

export function mulRatio(left: Ratio, right: Ratio): Ratio {
  return ratio(left.num * right.num, left.den * right.den);
}

export function addRatio(left: Ratio, right: Ratio): Ratio {
  return ratio(left.num * right.den + right.num * left.den, left.den * right.den);
}

export function ratioToBps(value: Ratio): bigint {
  return (value.num * 10_000n) / value.den;
}

/**
 * Convert a (1 + r) linked product into period return basis points.
 * Example: 1.05 → 500 bps.
 */
export function linkedReturnBps(onePlusR: Ratio): bigint {
  return ratioToBps(onePlusR) - 10_000n;
}

/**
 * Integer square root (Newton). Used only for volatility when enough
 * integer observations exist. Truncates toward zero.
 */
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

/**
 * Proleptic Gregorian day number (Howard Hinnant). UTC date only.
 * Instant format must be `YYYY-MM-DDTHH:mm:ss.sssZ`.
 */
export function utcCivilDay(instant: string): bigint {
  if (instant.length < 10) {
    throw new TypeError('UTC instant must include a calendar date');
  }
  const year = BigInt(instant.slice(0, 4));
  const month = BigInt(instant.slice(5, 7));
  const day = BigInt(instant.slice(8, 10));
  let y = year;
  const m = month;
  const d = day;
  y -= m <= 2n ? 1n : 0n;
  const era = (y >= 0n ? y : y - 399n) / 400n;
  const yoe = y - era * 400n;
  const doy = (153n * (m + (m > 2n ? -3n : 9n)) + 2n) / 5n + d - 1n;
  const doe = yoe * 365n + yoe / 4n - yoe / 100n + doy;
  return era * 146097n + doe - 719468n;
}

export function utcDaySpan(from: string, to: string): bigint {
  const span = utcCivilDay(to) - utcCivilDay(from);
  return span < 0n ? -span : span;
}
