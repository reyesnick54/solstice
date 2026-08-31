/**
 * Shared latency and throughput statistics for Wave 6 qualification harness.
 * Results are ENGINEERING_MEASUREMENT — not SLAs.
 */

export type LatencySummary = {
  readonly count: number;
  readonly minMs: number;
  readonly maxMs: number;
  readonly meanMs: number;
  readonly medianMs: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly stddevMs: number;
};

export type ThroughputSummary = {
  readonly requests: number;
  readonly durationMs: number;
  readonly requestsPerSec: number;
  readonly errors: number;
  readonly errorRate: number;
};

export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

export function summarizeLatencyMs(samples: readonly number[]): LatencySummary {
  const sorted = [...samples].sort((left, right) => left - right);
  const count = sorted.length;
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  const mean = count === 0 ? 0 : sum / count;
  const variance = count === 0 ? 0 : sorted.reduce((acc, value) => acc + (value - mean) ** 2, 0) / count;
  return {
    count,
    minMs: sorted[0] ?? 0,
    maxMs: sorted[count - 1] ?? 0,
    meanMs: mean,
    medianMs: percentile(sorted, 50),
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
    stddevMs: Math.sqrt(variance),
  };
}

export function summarizeThroughput(input: {
  readonly requests: number;
  readonly durationMs: number;
  readonly errors: number;
}): ThroughputSummary {
  const durationSec = input.durationMs / 1000;
  return {
    requests: input.requests,
    durationMs: input.durationMs,
    requestsPerSec: durationSec > 0 ? input.requests / durationSec : 0,
    errors: input.errors,
    errorRate: input.requests > 0 ? input.errors / input.requests : 0,
  };
}

export async function timeMs(fn: () => Promise<void> | void): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

export async function runConcurrent<T>(
  concurrency: number,
  total: number,
  worker: (index: number) => Promise<T>,
): Promise<readonly T[]> {
  const results: T[] = [];
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, total) }, async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= total) return;
      results.push(await worker(index));
    }
  });
  await Promise.all(runners);
  return results;
}
