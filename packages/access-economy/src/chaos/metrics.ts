/**
 * ACCESS Wave 5 — chaos/load observability counters (no PII labels).
 */

export type AccessChaosMetrics = {
  readonly transactionCount: number;
  readonly bookingSuccessCount: number;
  readonly bookingFailureCount: number;
  readonly settlementSuccessCount: number;
  readonly settlementFailureCount: number;
  readonly reconciliationRequiredCount: number;
  readonly fundingUtilizationBps: number;
  readonly entitlementUtilizationBps: number;
  readonly providerQuarantineCount: number;
  readonly refundBacklogCount: number;
  readonly reconciliationBacklogCount: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
};

export function percentile(sortedMs: readonly number[], p: number): number {
  if (sortedMs.length === 0) {
    return 0;
  }
  const index = Math.min(sortedMs.length - 1, Math.ceil((p / 100) * sortedMs.length) - 1);
  return sortedMs[index] ?? 0;
}

export function buildLatencyPercentiles(samplesMs: readonly number[]): Pick<AccessChaosMetrics, 'p50Ms' | 'p95Ms' | 'p99Ms'> {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  return Object.freeze({
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
  });
}

export function utilizationBps(used: bigint, total: bigint): number {
  if (total === 0n) {
    return 0;
  }
  return Number((used * 10_000n) / total);
}
