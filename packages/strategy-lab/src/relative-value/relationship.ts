/**
 * HELIOS M12 — statistical relationship discovery.
 * Research-only layer. Does not obtain financial authority.
 */

import type { UtcInstant } from '@solstice/domain';
import { M12_CORRELATION_SCALE, M12_Z_SCORE_SCALE } from './constants.ts';
import { resolveM12PairDefinition, type M12PairId } from './ids.ts';
import type {
  M12BarObservation,
  M12CointegrationOutcome,
  M12RelationshipSnapshot,
} from './types.ts';

function absBigint(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function sqrtBigint(value: bigint): bigint {
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

export function barsForInstrument(
  allBars: readonly M12BarObservation[],
  instrumentId: string,
): readonly M12BarObservation[] {
  return Object.freeze(
    allBars
      .filter((row) => row.instrumentId === instrumentId)
      .sort((a, b) => Date.parse(a.sourceEventTime) - Date.parse(b.sourceEventTime)),
  );
}

export function indexAtOrBefore(bars: readonly M12BarObservation[], at: UtcInstant): number {
  let result = -1;
  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i];
    if (!bar) {
      continue;
    }
    if (Date.parse(bar.knowableAt) <= Date.parse(at) && bar.available) {
      result = i;
    } else if (Date.parse(bar.knowableAt) > Date.parse(at)) {
      break;
    }
  }
  return result;
}

function alignedCloses(
  legA: readonly M12BarObservation[],
  legB: readonly M12BarObservation[],
  endIndexA: number,
  window: number,
): { readonly a: readonly bigint[]; readonly b: readonly bigint[] } | null {
  if (endIndexA < window - 1) {
    return null;
  }
  const a: bigint[] = [];
  const b: bigint[] = [];
  for (let i = endIndexA - window + 1; i <= endIndexA; i += 1) {
    const barA = legA[i];
    if (!barA) {
      return null;
    }
    const barB = legB[i];
    if (!barB || barB.sourceEventTime !== barA.sourceEventTime || !barB.available) {
      return null;
    }
    a.push(barA.closeMinor);
    b.push(barB.closeMinor);
  }
  return Object.freeze({ a: Object.freeze(a), b: Object.freeze(b) });
}

/** Rolling OLS hedge ratio beta = cov(a,b)/var(b), scaled by 10_000. */
export function estimateHedgeRatioScaled(a: readonly bigint[], b: readonly bigint[]): bigint {
  if (a.length !== b.length || a.length < 2) {
    return 10_000n;
  }
  const n = BigInt(a.length);
  const meanA = a.reduce((sum, value) => sum + value, 0n) / n;
  const meanB = b.reduce((sum, value) => sum + value, 0n) / n;
  let cov = 0n;
  let varB = 0n;
  for (let i = 0; i < a.length; i += 1) {
    const da = (a[i] ?? 0n) - meanA;
    const db = (b[i] ?? 0n) - meanB;
    cov += da * db;
    varB += db * db;
  }
  if (varB <= 0n) {
    return 10_000n;
  }
  return (cov * 10_000n) / varB;
}

export function constructSpreadMinor(
  closeA: bigint,
  closeB: bigint,
  hedgeRatioScaled: bigint,
): bigint {
  if (closeB <= 0n) {
    return 0n;
  }
  return closeA - (closeB * hedgeRatioScaled) / 10_000n;
}

export function rollingMean(values: readonly bigint[], endIndex: number, window: number): bigint | null {
  if (window <= 0 || endIndex < window - 1 || endIndex >= values.length) {
    return null;
  }
  const start = endIndex - window + 1;
  let sum = 0n;
  for (let i = start; i <= endIndex; i += 1) {
    sum += values[i] ?? 0n;
  }
  return sum / BigInt(window);
}

export function spreadVolBps(spreads: readonly bigint[], endIndex: number, window: number): bigint | null {
  if (window < 2 || endIndex < window - 1) {
    return null;
  }
  const start = endIndex - window + 1;
  const returns: bigint[] = [];
  for (let i = start + 1; i <= endIndex; i += 1) {
    const prev = spreads[i - 1];
    const current = spreads[i];
    if (prev === undefined || current === undefined || prev === 0n) {
      return null;
    }
    returns.push(((current - prev) * 10_000n) / absBigint(prev));
  }
  if (returns.length === 0) {
    return null;
  }
  const mean = returns.reduce((sum, value) => sum + value, 0n) / BigInt(returns.length);
  let variance = 0n;
  for (const ret of returns) {
    const diff = ret - mean;
    variance += diff * diff;
  }
  variance /= BigInt(returns.length);
  return sqrtBigint(variance);
}

export function zScoreScaled(spread: bigint, mean: bigint, volBps: bigint, minVolBps: bigint): bigint {
  const effectiveVol = volBps < minVolBps ? minVolBps : volBps;
  if (effectiveVol <= 0n) {
    return 0n;
  }
  const deviation = spread - mean;
  return (deviation * M12_Z_SCORE_SCALE * 10_000n) / (absBigint(mean) * effectiveVol + 1n);
}

export function rollingCorrelationScaled(a: readonly bigint[], b: readonly bigint[]): bigint | null {
  if (a.length !== b.length || a.length < 2) {
    return null;
  }
  const n = BigInt(a.length);
  const meanA = a.reduce((sum, value) => sum + value, 0n) / n;
  const meanB = b.reduce((sum, value) => sum + value, 0n) / n;
  let cov = 0n;
  let varA = 0n;
  let varB = 0n;
  for (let i = 0; i < a.length; i += 1) {
    const da = (a[i] ?? 0n) - meanA;
    const db = (b[i] ?? 0n) - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA <= 0n || varB <= 0n) {
    return null;
  }
  const denom = sqrtBigint(varA) * sqrtBigint(varB);
  if (denom <= 0n) {
    return null;
  }
  return (cov * M12_CORRELATION_SCALE) / denom;
}

/**
 * Cointegration test hook — deterministic residual stationarity score.
 * Not a production econometric claim; engineering gate only.
 */
export function cointegrationTestHook(spreads: readonly bigint[]): M12CointegrationOutcome {
  if (spreads.length < 10) {
    return 'NOT_RUN';
  }
  let signChanges = 0;
  for (let i = 2; i < spreads.length; i += 1) {
    const prev = spreads[i - 1]! - spreads[i - 2]!;
    const current = spreads[i]! - spreads[i - 1]!;
    if ((prev > 0n && current < 0n) || (prev < 0n && current > 0n)) {
      signChanges += 1;
    }
  }
  const ratio = signChanges / (spreads.length - 2);
  if (ratio >= 0.35) {
    return 'SUPPORTED';
  }
  if (ratio >= 0.15) {
    return 'INCONCLUSIVE';
  }
  return 'REJECTED';
}

export function timestampsSynchronized(
  barA: M12BarObservation,
  barB: M12BarObservation,
  maxSkewMs: number,
): boolean {
  return absBigint(BigInt(Date.parse(barA.knowableAt) - Date.parse(barB.knowableAt))) <= BigInt(maxSkewMs);
}

export function discoverRelationship(input: {
  readonly pairId: M12PairId;
  readonly allBars: readonly M12BarObservation[];
  readonly now: UtcInstant;
  readonly relationshipWindowBars: number;
  readonly correlationWindowBars: number;
  readonly maxTimestampSkewMs: number;
}): M12RelationshipSnapshot | null {
  const pair = resolveM12PairDefinition(input.pairId);
  const legA = barsForInstrument(input.allBars, pair.legAInstrumentId);
  const legB = barsForInstrument(input.allBars, pair.legBInstrumentId);
  const endIndexA = indexAtOrBefore(legA, input.now);
  if (endIndexA < 0) {
    return null;
  }
  const barA = legA[endIndexA]!;
  const barB = legB[endIndexA];
  if (!barB || barB.sourceEventTime !== barA.sourceEventTime) {
    return null;
  }

  const aligned = alignedCloses(legA, legB, endIndexA, input.relationshipWindowBars);
  if (!aligned) {
    return null;
  }

  const hedgeRatioScaled =
    pair.hedgeMethod === 'FIXED_RATIO'
      ? 10_000n
      : estimateHedgeRatioScaled(aligned.a, aligned.b);

  const spreads: bigint[] = [];
  for (let i = 0; i < aligned.a.length; i += 1) {
    spreads.push(constructSpreadMinor(aligned.a[i]!, aligned.b[i]!, hedgeRatioScaled));
  }

  const spreadNow = constructSpreadMinor(barA.closeMinor, barB.closeMinor, hedgeRatioScaled);
  const spreadMean = rollingMean(spreads, spreads.length - 1, spreads.length) ?? 0n;
  const spreadVol = spreadVolBps(spreads, spreads.length - 1, spreads.length) ?? 10n;

  const corrWindow = Math.min(input.correlationWindowBars, aligned.a.length);
  const corrSliceA = aligned.a.slice(-corrWindow);
  const corrSliceB = aligned.b.slice(-corrWindow);

  return Object.freeze({
    pairId: input.pairId,
    asOf: input.now,
    hedgeRatioScaled,
    spreadMinor: spreadNow,
    spreadMeanMinor: spreadMean,
    spreadVolBps: spreadVol,
    spreadZScoreScaled: zScoreScaled(spreadNow, spreadMean, spreadVol, 10n),
    rollingCorrelationScaled: rollingCorrelationScaled(corrSliceA, corrSliceB) ?? 0n,
    cointegrationOutcome: cointegrationTestHook(spreads),
    historyBars: spreads.length,
    synchronized: timestampsSynchronized(barA, barB, input.maxTimestampSkewMs),
  });
}
