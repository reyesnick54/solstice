/**
 * ALPHA09 — risk and tail metrics on forward excess (no blended yield or APY fields).
 */

export const HELIOS_ALPHA09_RISK_TAIL = 'HELIOS_ALPHA09_RISK_TAIL' as const;

export function maxDrawdownMinor(excessSeriesMinor: readonly bigint[]): bigint {
  let peak = 0n;
  let cum = 0n;
  let maxDd = 0n;
  for (const x of excessSeriesMinor) {
    cum += x;
    if (cum > peak) {
      peak = cum;
    }
    const dd = peak - cum;
    if (dd > maxDd) {
      maxDd = dd;
    }
  }
  return maxDd;
}

export function lowerTailAverageMinor(excessSeriesMinor: readonly bigint[], tailFraction: number): bigint {
  if (excessSeriesMinor.length === 0 || tailFraction <= 0 || tailFraction > 1) {
    return 0n;
  }
  const sorted = [...excessSeriesMinor].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const k = Math.max(1, Math.floor(sorted.length * tailFraction));
  let sum = 0n;
  for (let i = 0; i < k; i++) {
    sum += sorted[i]!;
  }
  return sum / BigInt(k);
}
