/**
 * ALT05 sandbox fixtures — injected aggregates only (no live providers).
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import type {
  AppDemandObservation,
  SearchAttentionObservation,
  SearchSeriesVintage,
  WebDemandObservation,
} from '../types.ts';
import type { DigitalDemandTemporalEnvelope } from '../temporal-envelope.ts';
import {
  buildAppDemandFeatures,
  buildSearchAttentionFeatures,
  buildWebDemandFeatures,
} from './features.ts';
import { buildSearchSeriesReliability } from './search-reliability.ts';

const ENTITY = 'entity:demo-retailer';
const PROVIDER = 'sandbox-search-trends';

function baseEnvelope(inputFamily: DigitalDemandTemporalEnvelope['inputFamily'], knowableAt: UtcInstant): DigitalDemandTemporalEnvelope {
  return Object.freeze({
    canonicalEntityId: ENTITY,
    productRef: 'product:flagship-app',
    inputFamily,
    geographicScope: 'COUNTRY',
    aggregationGrain: 'WEEKLY',
    providerAvailabilityTime: knowableAt,
    knowableAt,
    vintageCapturedAt: knowableAt,
    revisionId: 'rev-sandbox-1',
    revisionSequence: 1,
    sourceRefs: Object.freeze([
      Object.freeze({
        sourceId: 'sandbox-aggregate',
        providerId: PROVIDER,
        capability: 'SEARCH_TRENDS_AGGREGATE',
        licenseClass: 'SANDBOX_FIXTURE',
        upstreamRef: null,
      }),
    ]),
    evidenceRefs: Object.freeze(['evidence/sandbox-alt05']),
    qualityState: 'VALID',
    aggregateOnly: true,
    individualTrackingProhibited: true,
  });
}

export function demoSearchVintages(): readonly SearchSeriesVintage[] {
  const t0 = asUtcInstant('2024-06-01T00:00:00.000Z');
  const t1 = asUtcInstant('2024-06-08T00:00:00.000Z');
  return Object.freeze([
    Object.freeze({
      vintageId: `${ENTITY}|${PROVIDER}|v1`,
      capturedAt: t0,
      revisionSequence: 1,
      points: Object.freeze([
        Object.freeze({ periodEnd: t0, valueKind: 'OBSERVED', rawIndex: 42, normalizedIndex: null }),
        Object.freeze({ periodEnd: t1, valueKind: 'ZERO', rawIndex: 0, normalizedIndex: 0 }),
        Object.freeze({ periodEnd: asUtcInstant('2024-06-15T00:00:00.000Z'), valueKind: 'MISSING', rawIndex: null, normalizedIndex: null }),
      ]),
    }),
    Object.freeze({
      vintageId: `${ENTITY}|${PROVIDER}|v2`,
      capturedAt: asUtcInstant('2024-06-10T00:00:00.000Z'),
      revisionSequence: 2,
      points: Object.freeze([
        Object.freeze({ periodEnd: t0, valueKind: 'OBSERVED', rawIndex: 44, normalizedIndex: null }),
        Object.freeze({ periodEnd: t1, valueKind: 'OBSERVED', rawIndex: 38, normalizedIndex: null }),
        Object.freeze({ periodEnd: asUtcInstant('2024-06-15T00:00:00.000Z'), valueKind: 'OBSERVED', rawIndex: 55, normalizedIndex: null }),
      ]),
    }),
  ]);
}

export function demoSearchReliability() {
  return buildSearchSeriesReliability({
    entityId: ENTITY,
    providerId: PROVIDER,
    vintages: demoSearchVintages(),
  });
}

export function demoSearchAttentionObservation(knowableAt: UtcInstant): SearchAttentionObservation {
  const series = [40, 42, 41, 45, 52, 88, 54, 50];
  const reliability = demoSearchReliability();
  return Object.freeze({
    observationId: 'obs/search/demo-1',
    envelope: baseEnvelope('SEARCH_TRENDS', knowableAt),
    periodStart: asUtcInstant('2024-05-15T00:00:00.000Z'),
    periodEnd: asUtcInstant('2024-06-15T00:00:00.000Z'),
    rawIndexSeries: Object.freeze(series),
    features: buildSearchAttentionFeatures({
      rawIndexSeries: series,
      brandShare: 0.62,
      productShare: 0.41,
      categoryPeerMedian: 48,
      queryBreadth: 0.55,
      reliability,
    }),
  });
}

export function demoWebDemandObservation(knowableAt: UtcInstant): WebDemandObservation {
  return Object.freeze({
    observationId: 'obs/web/demo-1',
    envelope: baseEnvelope('WEB_TRAFFIC', knowableAt),
    periodStart: asUtcInstant('2024-06-01T00:00:00.000Z'),
    periodEnd: asUtcInstant('2024-06-30T00:00:00.000Z'),
    features: buildWebDemandFeatures({
      visitsPoint: 1.12,
      visitorsPoint: 0.98,
      visitGrowth: 0.08,
      engagementSeconds: 184,
      referralMix: Object.freeze({ organic: 0.52, paid: 0.28, social: 0.2 }),
    }),
  });
}

export function demoAppDemandObservation(knowableAt: UtcInstant): AppDemandObservation {
  return Object.freeze({
    observationId: 'obs/app/demo-1',
    envelope: baseEnvelope('APP_RANKING', knowableAt),
    periodStart: asUtcInstant('2024-06-01T00:00:00.000Z'),
    periodEnd: asUtcInstant('2024-06-30T00:00:00.000Z'),
    features: buildAppDemandFeatures({
      ranking: 12,
      downloads: 1.4,
      activeUsers: 2.1,
      usageGrowth: 0.05,
      reviewVelocity: 320,
    }),
  });
}

export function demoFutureLeakingSearch(knowableAt: UtcInstant): SearchAttentionObservation {
  const row = demoSearchAttentionObservation(knowableAt);
  return Object.freeze({
    ...row,
    observationId: 'obs/search/future-leak',
    envelope: Object.freeze({
      ...row.envelope,
      knowableAt: asUtcInstant('2099-01-01T00:00:00.000Z'),
    }),
  });
}
