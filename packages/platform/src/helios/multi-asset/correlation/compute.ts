/**
 * HELIOS Multi-Asset M17 — deterministic Pearson correlation on simple returns (bps).
 *
 * Integer-only arithmetic. No floating-point money or correlation values.
 */

import type { CorrelationBarObservation, CorrelationSourceBarRef } from './types.ts';
import { CORRELATION_BPS_SCALE } from './taxonomy.ts';

export type AlignedReturnPair = {
  readonly returnBpsA: bigint;
  readonly returnBpsB: bigint;
  readonly barA: CorrelationSourceBarRef;
  readonly barB: CorrelationSourceBarRef;
};

function isqrt(value: bigint): bigint {
  if (value <= 0n) {
    return 0n;
  }
  let x = value;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + value / x) / 2n;
  }
  return x;
}

function simpleReturnBps(current: bigint, prior: bigint): bigint | null {
  if (prior === 0n) {
    return null;
  }
  return ((current - prior) * BigInt(CORRELATION_BPS_SCALE)) / prior;
}

export function alignBarPairs(
  barsA: readonly CorrelationBarObservation[],
  barsB: readonly CorrelationBarObservation[],
): readonly AlignedReturnPair[] {
  const byKnowableB = new Map<string, CorrelationBarObservation>();
  for (const bar of barsB) {
    byKnowableB.set(bar.knowableAt, bar);
  }

  const sortedA = [...barsA].sort((a, b) => Date.parse(a.knowableAt) - Date.parse(b.knowableAt));
  const pairs: AlignedReturnPair[] = [];

  for (let i = 1; i < sortedA.length; i += 1) {
    const currentA = sortedA[i];
    const priorA = sortedA[i - 1];
    if (!currentA || !priorA) {
      continue;
    }
    const matchedB = byKnowableB.get(currentA.knowableAt);
    const priorMatchedB = byKnowableB.get(priorA.knowableAt);
    if (!matchedB || !priorMatchedB) {
      continue;
    }
    const returnA = simpleReturnBps(currentA.closeMinor, priorA.closeMinor);
    const returnB = simpleReturnBps(matchedB.closeMinor, priorMatchedB.closeMinor);
    if (returnA === null || returnB === null) {
      continue;
    }
    pairs.push(
      Object.freeze({
        returnBpsA: returnA,
        returnBpsB: returnB,
        barA: Object.freeze({
          observationId: currentA.observationId,
          instrumentId: currentA.instrumentId,
          knowableAt: currentA.knowableAt,
          closeMinor: currentA.closeMinor,
        }),
        barB: Object.freeze({
          observationId: matchedB.observationId,
          instrumentId: matchedB.instrumentId,
          knowableAt: matchedB.knowableAt,
          closeMinor: matchedB.closeMinor,
        }),
      }),
    );
  }

  return Object.freeze(pairs);
}

export function pearsonCorrelationBps(pairs: readonly AlignedReturnPair[]): number | null {
  const n = BigInt(pairs.length);
  if (n < 2n) {
    return null;
  }

  let sumX = 0n;
  let sumY = 0n;
  let sumXY = 0n;
  let sumX2 = 0n;
  let sumY2 = 0n;

  for (const pair of pairs) {
    sumX += pair.returnBpsA;
    sumY += pair.returnBpsB;
    sumXY += pair.returnBpsA * pair.returnBpsB;
    sumX2 += pair.returnBpsA * pair.returnBpsA;
    sumY2 += pair.returnBpsB * pair.returnBpsB;
  }

  const numerator = n * sumXY - sumX * sumY;
  const varX = n * sumX2 - sumX * sumX;
  const varY = n * sumY2 - sumY * sumY;
  if (varX <= 0n || varY <= 0n) {
    return null;
  }

  const denominator = isqrt(varX * varY);
  if (denominator === 0n) {
    return null;
  }

  const scaled = (numerator * BigInt(CORRELATION_BPS_SCALE)) / denominator;
  const capped = scaled > BigInt(CORRELATION_BPS_SCALE)
    ? BigInt(CORRELATION_BPS_SCALE)
    : scaled < -BigInt(CORRELATION_BPS_SCALE)
      ? -BigInt(CORRELATION_BPS_SCALE)
      : scaled;
  return Number(capped);
}

export function barsKnowableAsOf(
  bars: readonly CorrelationBarObservation[],
  asOfMs: number,
): readonly CorrelationBarObservation[] {
  return Object.freeze(
    [...bars]
      .filter((bar) => Date.parse(bar.knowableAt) <= asOfMs)
      .sort((a, b) => Date.parse(a.knowableAt) - Date.parse(b.knowableAt)),
  );
}

export function tailBars(
  bars: readonly CorrelationBarObservation[],
  lookback: number,
): readonly CorrelationBarObservation[] {
  if (bars.length <= lookback) {
    return bars;
  }
  return Object.freeze(bars.slice(bars.length - lookback));
}

export function latestKnowableMs(bars: readonly CorrelationBarObservation[]): number | null {
  if (bars.length === 0) {
    return null;
  }
  let latest = Date.parse(bars[0]!.knowableAt);
  for (const bar of bars) {
    const ms = Date.parse(bar.knowableAt);
    if (ms > latest) {
      latest = ms;
    }
  }
  return latest;
}
