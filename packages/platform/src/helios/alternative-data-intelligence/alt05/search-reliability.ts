/**
 * Google-Trends-like source robustness — SearchSeriesReliability.
 */

import type { UtcInstant } from '@solstice/domain';
import type { SearchSeriesReliability, SearchSeriesVintage, SearchSeriesVintagePoint } from '../types.ts';
import { mad, mean, median } from './numeric.ts';

function normalizedForPoints(points: readonly SearchSeriesVintagePoint[]): readonly number[] {
  const observed = points
    .filter((p) => p.valueKind === 'OBSERVED' && p.rawIndex !== null)
    .map((p) => p.rawIndex as number);
  const scale = Math.max(median(observed), 1);
  return Object.freeze(
    points.map((p) => {
      if (p.valueKind === 'MISSING' || p.valueKind === 'ZERO') return 0;
      if (p.normalizedIndex !== null) return p.normalizedIndex;
      return (p.rawIndex ?? 0) / scale;
    }),
  );
}

function revisionDriftBps(vintages: readonly SearchSeriesVintage[]): number {
  if (vintages.length < 2) return 0;
  const latest = normalizedForPoints(vintages[vintages.length - 1]!.points);
  const prior = normalizedForPoints(vintages[vintages.length - 2]!.points);
  const n = Math.min(latest.length, prior.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += Math.abs(latest[i]! - prior[i]!);
  }
  return Math.round((sum / n) * 10_000);
}

function samplingNoiseEstimate(vintages: readonly SearchSeriesVintage[]): number {
  if (vintages.length === 0) return 0;
  const latest = vintages[vintages.length - 1]!.points;
  const series = normalizedForPoints(latest);
  return mad(series);
}

function detectRescaling(vintages: readonly SearchSeriesVintage[]): {
  readonly detected: boolean;
  readonly at: UtcInstant | null;
} {
  if (vintages.length < 2) return Object.freeze({ detected: false, at: null });
  for (let i = 1; i < vintages.length; i++) {
    const prev = vintages[i - 1]!;
    const next = vintages[i]!;
    const prevObs = prev.points.filter((p) => p.valueKind === 'OBSERVED' && p.rawIndex !== null);
    const nextObs = next.points.filter((p) => p.valueKind === 'OBSERVED' && p.rawIndex !== null);
    const n = Math.min(prevObs.length, nextObs.length);
    if (n < 3) continue;
    const ratios: number[] = [];
    for (let j = 0; j < n; j++) {
      const a = prevObs[j]!.rawIndex!;
      const b = nextObs[j]!.rawIndex!;
      if (a > 1e-6 && b > 1e-6) ratios.push(b / a);
    }
    if (ratios.length === 0) continue;
    const rMed = median(ratios);
    const rMad = mad(ratios);
    if (rMed > 1.35 || rMed < 0.74 || rMad / Math.max(rMed, 1e-6) > 0.25) {
      return Object.freeze({ detected: true, at: next.capturedAt });
    }
  }
  return Object.freeze({ detected: false, at: null });
}

export function buildSearchSeriesReliability(input: {
  readonly entityId: string;
  readonly providerId: string;
  readonly vintages: readonly SearchSeriesVintage[];
}): SearchSeriesReliability {
  const zeroVsMissingDistinctionEnforced = input.vintages.every((v) =>
    v.points.every((p) => p.valueKind === 'ZERO' || p.valueKind === 'MISSING' || p.valueKind === 'OBSERVED'),
  );
  const latest = input.vintages[input.vintages.length - 1];
  const observed = latest
    ? latest.points.filter((p) => p.valueKind === 'OBSERVED' && p.rawIndex !== null).map((p) => p.rawIndex as number)
    : [];
  const robustNormalizationScale = Math.max(median(observed), 1);
  const rescaling = detectRescaling(input.vintages);
  const noise = samplingNoiseEstimate(input.vintages);
  const drift = revisionDriftBps(input.vintages);
  const reliabilityPenalty = drift + (rescaling.detected ? 1500 : 0) + Math.round(noise * 2000);
  const reliabilityScoreBps = Math.max(0, 10_000 - reliabilityPenalty);

  return Object.freeze({
    entityId: input.entityId,
    providerId: input.providerId,
    vintages: Object.freeze([...input.vintages]),
    revisionDriftBps: drift,
    zeroVsMissingDistinctionEnforced,
    samplingNoiseEstimate: noise,
    rescalingChangeDetected: rescaling.detected,
    rescalingChangeAt: rescaling.at,
    robustNormalizationScale,
    reliabilityScoreBps,
  });
}

export function robustNormalizeSearchIndex(raw: number, reliability: SearchSeriesReliability): number {
  if (reliability.rescalingChangeDetected) {
    return raw / reliability.robustNormalizationScale;
  }
  return raw / Math.max(reliability.robustNormalizationScale, 1);
}
