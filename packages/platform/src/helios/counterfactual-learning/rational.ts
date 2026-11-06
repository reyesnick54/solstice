import type { ProbabilityRational } from './types.ts';

function parseBigint(s: string): bigint {
  return BigInt(s);
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x === 0n ? 1n : x;
}

export function normalizeRational(input: ProbabilityRational): ProbabilityRational {
  let n = parseBigint(input.numerator);
  let d = parseBigint(input.denominator);
  if (d <= 0n) {
    throw new Error('rational denominator must be positive');
  }
  if (n < 0n) {
    throw new Error('rational numerator must be non-negative');
  }
  const g = gcd(n, d);
  n /= g;
  d /= g;
  return { numerator: n.toString(), denominator: d.toString() };
}

export function rationalCompare(a: ProbabilityRational, b: ProbabilityRational): number {
  const an = parseBigint(a.numerator);
  const ad = parseBigint(a.denominator);
  const bn = parseBigint(b.numerator);
  const bd = parseBigint(b.denominator);
  const left = an * bd;
  const right = bn * ad;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function mulRational(a: ProbabilityRational, b: ProbabilityRational): ProbabilityRational {
  return normalizeRational({
    numerator: (parseBigint(a.numerator) * parseBigint(b.numerator)).toString(),
    denominator: (parseBigint(a.denominator) * parseBigint(b.denominator)).toString(),
  });
}

export function divRational(a: ProbabilityRational, b: ProbabilityRational): ProbabilityRational {
  const bn = parseBigint(b.numerator);
  const bd = parseBigint(b.denominator);
  if (bn === 0n) {
    throw new Error('division by zero rational');
  }
  return normalizeRational({
    numerator: (parseBigint(a.numerator) * bd).toString(),
    denominator: (parseBigint(a.denominator) * bn).toString(),
  });
}

export function addRational(a: ProbabilityRational, b: ProbabilityRational): ProbabilityRational {
  const an = parseBigint(a.numerator);
  const ad = parseBigint(a.denominator);
  const bn = parseBigint(b.numerator);
  const bd = parseBigint(b.denominator);
  const num = an * bd + bn * ad;
  const den = ad * bd;
  return normalizeRational({ numerator: num.toString(), denominator: den.toString() });
}

/** a - b; result must be non-negative (throws otherwise). */
export function subtractRational(a: ProbabilityRational, b: ProbabilityRational): ProbabilityRational {
  const an = parseBigint(a.numerator);
  const ad = parseBigint(a.denominator);
  const bn = parseBigint(b.numerator);
  const bd = parseBigint(b.denominator);
  const num = an * bd - bn * ad;
  const den = ad * bd;
  if (num < 0n) {
    throw new Error('subtraction would yield negative rational');
  }
  return normalizeRational({ numerator: num.toString(), denominator: den.toString() });
}

export function sumRationals(values: readonly ProbabilityRational[]): ProbabilityRational {
  if (values.length === 0) {
    throw new Error('empty rational sum');
  }
  return values.reduce((acc, r) => addRational(acc, r));
}

export function rationalToNumberFinite(r: ProbabilityRational): number {
  const n = parseBigint(r.numerator);
  const d = parseBigint(r.denominator);
  return Number(n) / Number(d);
}
