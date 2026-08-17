import type { LatencyStats, ThroughputStats } from './types.ts';

export function nowNs(): bigint {
  return process.hrtime.bigint();
}

export function elapsedNs(started: bigint, ended = nowNs()): number {
  return Number(ended - started);
}

export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  if (p <= 0) {
    return sorted[0] ?? 0;
  }
  if (p >= 100) {
    return sorted[sorted.length - 1] ?? 0;
  }
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
}

export function summarizeLatency(samplesNs: readonly number[]): LatencyStats {
  if (samplesNs.length === 0) {
    return {
      count: 0,
      minNs: 0,
      maxNs: 0,
      meanNs: 0,
      medianNs: 0,
      p50Ns: 0,
      p95Ns: 0,
      p99Ns: 0,
      stddevNs: 0,
    };
  }
  const sorted = [...samplesNs].sort((left, right) => left - right);
  const count = sorted.length;
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  const mean = sum / count;
  const variance = sorted.reduce((acc, value) => acc + (value - mean) ** 2, 0) / count;
  return {
    count,
    minNs: sorted[0] ?? 0,
    maxNs: sorted[count - 1] ?? 0,
    meanNs: mean,
    medianNs: percentile(sorted, 50),
    p50Ns: percentile(sorted, 50),
    p95Ns: percentile(sorted, 95),
    p99Ns: percentile(sorted, 99),
    stddevNs: Math.sqrt(variance),
  };
}

export function summarizeThroughput(input: {
  readonly submitted: number;
  readonly accepted: number;
  readonly finalized: number;
  readonly rejected: number;
  readonly durationMs: number;
  readonly burstFinalized?: number;
  readonly burstMs?: number;
}): ThroughputStats {
  const seconds = input.durationMs <= 0 ? 1 : input.durationMs / 1000;
  const burstSeconds = (input.burstMs ?? 0) <= 0 ? seconds : (input.burstMs ?? 1) / 1000;
  return {
    submitted: input.submitted,
    accepted: input.accepted,
    finalized: input.finalized,
    rejected: input.rejected,
    sustainedFinalizedPerSec: input.finalized / seconds,
    burstFinalizedPerSec: (input.burstFinalized ?? input.finalized) / burstSeconds,
    errorRejectionRate: input.submitted === 0 ? 0 : input.rejected / input.submitted,
  };
}

export function measureNs(fn: () => void): number {
  const started = nowNs();
  fn();
  return elapsedNs(started);
}

export function measureMany(iterations: number, fn: () => void): number[] {
  const samples: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    samples.push(measureNs(fn));
  }
  return samples;
}
