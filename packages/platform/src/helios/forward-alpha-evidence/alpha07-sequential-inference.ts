/**
 * ALPHA07 — sequential inference (confidence sequence spend under pre-registered budget).
 */

export const HELIOS_ALPHA07_SEQUENTIAL_INFERENCE = 'HELIOS_ALPHA07_SEQUENTIAL_INFERENCE' as const;

export function sequentialAlphaSpend(
  nominalPValues: readonly number[],
  method: 'BONFERRONI' | 'HOCHBERG',
): number {
  if (nominalPValues.length === 0) {
    return 0;
  }
  const sorted = [...nominalPValues].sort((a, b) => a - b);
  if (method === 'BONFERRONI') {
    return Math.min(1, sorted[0]! * nominalPValues.length);
  }
  let spend = 0;
  for (let i = 0; i < sorted.length; i++) {
    const adj = sorted[i]! * (nominalPValues.length / (i + 1));
    spend = Math.max(spend, adj);
  }
  return Math.min(1, spend);
}

export function endpointSatisfied(adjustedSpend: number, alphaSpendLimit: number): boolean {
  return adjustedSpend <= alphaSpendLimit;
}
