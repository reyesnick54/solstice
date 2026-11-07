/**
 * Provider trust engine — deterministic quality bands per dimension.
 */

import type { UtcInstant } from '@solstice/domain';
import {
  MD05_QUALITY_BANDS,
  type Md05QualityBand,
  type Md05QualityDimension,
} from './taxonomy.ts';
import type { InboundMarketTick, ProviderQualityVector, ProviderTrustState } from './types.ts';
import { HELIOS_MD05_SCHEMA } from './taxonomy.ts';

const BAND_RANK: Readonly<Record<Md05QualityBand, number>> = Object.freeze({
  STRONG: 3,
  ACCEPTABLE: 2,
  DEGRADED: 1,
  FAILED: 0,
});

const DEFAULT_VECTOR: ProviderQualityVector = Object.freeze({
  sequenceIntegrity: 'ACCEPTABLE',
  freshness: 'ACCEPTABLE',
  latency: 'ACCEPTABLE',
  coverage: 'ACCEPTABLE',
  timestampQuality: 'ACCEPTABLE',
  revisionRate: 'ACCEPTABLE',
  historicalReliability: 'ACCEPTABLE',
  availability: 'ACCEPTABLE',
});

export function createProviderTrustState(input: {
  readonly providerId: string;
  readonly updatedAt: UtcInstant;
  readonly quality?: Partial<ProviderQualityVector>;
  readonly consecutiveFailures?: number;
}): ProviderTrustState {
  const quality: ProviderQualityVector = Object.freeze({
    ...DEFAULT_VECTOR,
    ...input.quality,
  });
  return Object.freeze({
    schema: HELIOS_MD05_SCHEMA,
    providerId: input.providerId,
    updatedAt: input.updatedAt,
    quality,
    compositeBand: compositeTrustBand(quality),
    consecutiveFailures: input.consecutiveFailures ?? 0,
    failoverEligible: (input.consecutiveFailures ?? 0) === 0,
  });
}

export function compositeTrustBand(quality: ProviderQualityVector): Md05QualityBand {
  const bands = (Object.values(quality) as Md05QualityBand[]).filter((band) =>
    MD05_QUALITY_BANDS.includes(band),
  );
  if (bands.some((band) => band === 'FAILED')) {
    return 'FAILED';
  }
  if (bands.some((band) => band === 'DEGRADED')) {
    return 'DEGRADED';
  }
  if (bands.every((band) => band === 'STRONG')) {
    return 'STRONG';
  }
  return 'ACCEPTABLE';
}

export function compareProviderTrust(left: ProviderTrustState, right: ProviderTrustState): number {
  const delta = BAND_RANK[right.compositeBand] - BAND_RANK[left.compositeBand];
  if (delta !== 0) {
    return delta;
  }
  return left.consecutiveFailures - right.consecutiveFailures;
}

export function recordProviderTick(
  prior: ProviderTrustState,
  tick: InboundMarketTick,
  now: UtcInstant,
): ProviderTrustState {
  const latencyMs = Math.max(0, Date.parse(tick.arrivalTimestamp) - Date.parse(tick.sourceTimestamp));
  const freshnessMs = Math.max(0, Date.parse(now) - Date.parse(tick.sourceTimestamp));

  const latency: Md05QualityBand =
    latencyMs <= 250 ? 'STRONG' : latencyMs <= 2_000 ? 'ACCEPTABLE' : latencyMs <= 10_000 ? 'DEGRADED' : 'FAILED';
  const freshness: Md05QualityBand =
    freshnessMs <= 5_000 ? 'STRONG' : freshnessMs <= 60_000 ? 'ACCEPTABLE' : freshnessMs <= 300_000 ? 'DEGRADED' : 'FAILED';
  const timestampQuality: Md05QualityBand =
    Date.parse(tick.arrivalTimestamp) >= Date.parse(tick.sourceTimestamp) ? 'STRONG' : 'FAILED';

  const quality: ProviderQualityVector = Object.freeze({
    ...prior.quality,
    latency,
    freshness,
    timestampQuality,
    availability: 'STRONG',
  });

  const compositeBand = compositeTrustBand(quality);
  return Object.freeze({
    ...prior,
    updatedAt: now,
    quality,
    compositeBand,
    consecutiveFailures: 0,
    failoverEligible: compositeBand !== 'FAILED',
  });
}

export function recordProviderFailure(prior: ProviderTrustState, now: UtcInstant): ProviderTrustState {
  const failures = prior.consecutiveFailures + 1;
  const availabilityBand: Md05QualityBand =
    failures >= 3 ? 'FAILED' : failures >= 1 ? 'DEGRADED' : prior.quality.availability;
  const quality: ProviderQualityVector = Object.freeze({
    ...prior.quality,
    availability: availabilityBand,
  });
  const compositeBand = compositeTrustBand(quality);
  return Object.freeze({
    ...prior,
    updatedAt: now,
    quality,
    compositeBand,
    consecutiveFailures: failures,
    failoverEligible: false,
  });
}
