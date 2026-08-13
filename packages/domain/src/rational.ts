/**
 * Exact rational arithmetic. Numerators and denominators are bigint.
 * Floating-point is never used for rates, fees, or amounts.
 */

export type Rational = {
  readonly numerator: bigint;
  readonly denominator: bigint;
};

function abs(n: bigint): bigint {
  return n < 0n ? -n : n;
}

export function gcd(a: bigint, b: bigint): bigint {
  let x = abs(a);
  let y = abs(b);
  while (y !== 0n) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x === 0n ? 1n : x;
}

export function asRational(numerator: bigint, denominator: bigint): Rational {
  if (typeof numerator !== 'bigint' || typeof denominator !== 'bigint') {
    throw new TypeError('Rational requires bigint numerator and denominator');
  }
  if (denominator === 0n) {
    throw new RangeError('Rational denominator cannot be zero');
  }
  const sign = denominator < 0n ? -1n : 1n;
  const n = numerator * sign;
  const d = denominator * sign;
  const g = gcd(n, d);
  return Object.freeze({
    numerator: n / g,
    denominator: d / g,
  });
}

export function integerRational(value: bigint): Rational {
  return asRational(value, 1n);
}

export function multiplyRational(a: Rational, b: Rational): Rational {
  return asRational(a.numerator * b.numerator, a.denominator * b.denominator);
}

export function addRational(a: Rational, b: Rational): Rational {
  return asRational(
    a.numerator * b.denominator + b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
}

export function invertRational(a: Rational): Rational {
  if (a.numerator === 0n) {
    throw new RangeError('Cannot invert a zero rational');
  }
  return asRational(a.denominator, a.numerator);
}

/**
 * Round half away from zero: |remainder| * 2 >= |denominator| bumps
 * the quotient away from zero.
 */
export function roundHalfAwayFromZero(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new RangeError('Division by zero');
  }
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n) {
    return quotient;
  }
  const absRemainder = remainder < 0n ? -remainder : remainder;
  const absDenominator = denominator < 0n ? -denominator : denominator;
  if (absRemainder * 2n >= absDenominator) {
    const positive = (numerator > 0n) === (denominator > 0n);
    return quotient + (positive ? 1n : -1n);
  }
  return quotient;
}

export function applyRational(amount: bigint, rate: Rational): bigint {
  return roundHalfAwayFromZero(amount * rate.numerator, rate.denominator);
}

export function rationalsEqual(a: Rational, b: Rational): boolean {
  return a.numerator * b.denominator === b.numerator * a.denominator;
}

export function formatRational(rate: Rational): string {
  return `${rate.numerator.toString()}/${rate.denominator.toString()}`;
}
