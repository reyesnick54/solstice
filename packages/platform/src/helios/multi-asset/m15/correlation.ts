/**
 * HELIOS M15 measured statistical relationship computation.
 *
 * Deterministic Pearson correlation on log returns. Not an LLM hypothesis.
 */

import type { UtcInstant } from '@solstice/domain';

export type CorrelationSeriesInput = {
  readonly instrumentId: string;
  readonly closes: readonly bigint[];
  readonly timestamps: readonly UtcInstant[];
};

export type CorrelationResult = {
  readonly instrumentA: string;
  readonly instrumentB: string;
  readonly coefficient: number;
  readonly observationCount: number;
  readonly lookbackLabel: string;
  readonly alignedFrom: UtcInstant;
  readonly alignedTo: UtcInstant;
};

function logReturns(closes: readonly bigint[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    const prev = Number(closes[i - 1] ?? 0n);
    const curr = Number(closes[i] ?? 0n);
    if (prev <= 0 || curr <= 0) {
      continue;
    }
    out.push(Math.log(curr / prev));
  }
  return out;
}

function pearson(a: readonly number[], b: readonly number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 2) {
    return null;
  }
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i += 1) {
    sumA += a[i] ?? 0;
    sumB += b[i] ?? 0;
  }
  const meanA = sumA / n;
  const meanB = sumB / n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = (a[i] ?? 0) - meanA;
    const db = (b[i] ?? 0) - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  if (den === 0) {
    return null;
  }
  return num / den;
}

function alignByTail(
  left: CorrelationSeriesInput,
  right: CorrelationSeriesInput,
): { leftReturns: number[]; rightReturns: number[]; from: UtcInstant; to: UtcInstant } | null {
  const leftReturns = logReturns(left.closes);
  const rightReturns = logReturns(right.closes);
  const n = Math.min(leftReturns.length, rightReturns.length);
  if (n < 2) {
    return null;
  }
  const leftStart = left.closes.length - n - 1;
  const rightStart = right.closes.length - n - 1;
  const fromLeft = left.timestamps[Math.max(leftStart, 0)] ?? left.timestamps[0];
  const fromRight = right.timestamps[Math.max(rightStart, 0)] ?? right.timestamps[0];
  const toLeft = left.timestamps[left.timestamps.length - 1] ?? fromLeft;
  const toRight = right.timestamps[right.timestamps.length - 1] ?? fromRight;
  if (!fromLeft || !fromRight || !toLeft || !toRight) {
    return null;
  }
  return {
    leftReturns: leftReturns.slice(-n),
    rightReturns: rightReturns.slice(-n),
    from: Date.parse(fromLeft) <= Date.parse(fromRight) ? fromLeft : fromRight,
    to: Date.parse(toLeft) >= Date.parse(toRight) ? toLeft : toRight,
  };
}

export function computePairwiseCorrelations(
  series: readonly CorrelationSeriesInput[],
  options: {
    readonly lookbackLabel?: string;
    readonly minObservations?: number;
    readonly threshold?: number;
  } = {},
): readonly CorrelationResult[] {
  const lookbackLabel = options.lookbackLabel ?? 'aligned_tail';
  const minObservations = options.minObservations ?? 5;
  const threshold = options.threshold ?? 0.3;
  const results: CorrelationResult[] = [];

  for (let i = 0; i < series.length; i += 1) {
    for (let j = i + 1; j < series.length; j += 1) {
      const left = series[i];
      const right = series[j];
      if (!left || !right) {
        continue;
      }
      const aligned = alignByTail(left, right);
      if (!aligned) {
        continue;
      }
      const coefficient = pearson(aligned.leftReturns, aligned.rightReturns);
      if (coefficient === null || aligned.leftReturns.length < minObservations) {
        continue;
      }
      if (Math.abs(coefficient) < threshold) {
        continue;
      }
      results.push(
        Object.freeze({
          instrumentA: left.instrumentId,
          instrumentB: right.instrumentId,
          coefficient,
          observationCount: aligned.leftReturns.length,
          lookbackLabel,
          alignedFrom: aligned.from,
          alignedTo: aligned.to,
        }),
      );
    }
  }

  return Object.freeze(results);
}

export function confidenceBandForCorrelation(coefficient: number, observationCount: number): 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT' {
  const abs = Math.abs(coefficient);
  if (observationCount < 5) {
    return 'INSUFFICIENT';
  }
  if (observationCount >= 20 && abs >= 0.6) {
    return 'HIGH';
  }
  if (observationCount >= 10 && abs >= 0.4) {
    return 'MEDIUM';
  }
  return 'LOW';
}
