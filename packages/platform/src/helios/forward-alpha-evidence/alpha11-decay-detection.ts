/**
 * ALPHA11 — forward performance decay detection (monitor only).
 */

export const HELIOS_ALPHA11_DECAY_DETECTION = 'HELIOS_ALPHA11_DECAY_DETECTION' as const;

export function detectExcessDecay(
  recentExcessMinor: readonly bigint[],
  baselineExcessMinor: readonly bigint[],
): 'STABLE' | 'DECAY_WARNING' | 'INSUFFICIENT_DATA' {
  if (recentExcessMinor.length < 3 || baselineExcessMinor.length < 3) {
    return 'INSUFFICIENT_DATA';
  }
  const recentSum = recentExcessMinor.reduce((a, b) => a + b, 0n);
  const baseSum = baselineExcessMinor.reduce((a, b) => a + b, 0n);
  if (baseSum <= 0n) {
    return 'STABLE';
  }
  if (recentSum * 2n < baseSum) {
    return 'DECAY_WARNING';
  }
  return 'STABLE';
}
