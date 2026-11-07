/**
 * Derive ALT05 feature bundles from normalized provider payloads.
 */

import type {
  AppDemandFeatures,
  ProviderNumericEstimate,
  SearchAttentionFeatures,
  WebDemandFeatures,
} from '../types.ts';
import { acceleration, clamp01, mean, momentum } from './numeric.ts';
import type { SearchSeriesReliability } from '../types.ts';
import { robustNormalizeSearchIndex } from './search-reliability.ts';

export function providerEstimate(input: {
  readonly point: number;
  readonly low?: number | null;
  readonly high?: number | null;
  readonly unitLabel: string;
  readonly semantics: ProviderNumericEstimate['semantics'];
}): ProviderNumericEstimate {
  return Object.freeze({
    semantics: input.semantics,
    point: input.point,
    low: input.low ?? null,
    high: input.high ?? null,
    unitLabel: input.unitLabel,
    isExactCount: false,
  });
}

export function buildSearchAttentionFeatures(input: {
  readonly rawIndexSeries: readonly number[];
  readonly brandShare: number;
  readonly productShare: number;
  readonly categoryPeerMedian: number;
  readonly queryBreadth: number;
  readonly reliability: SearchSeriesReliability | null;
}): SearchAttentionFeatures {
  const series =
    input.reliability === null
      ? input.rawIndexSeries
      : input.rawIndexSeries.map((v) => robustNormalizeSearchIndex(v, input.reliability));
  const level = series.length === 0 ? 0 : mean(series.slice(-4));
  const cat = Math.max(input.categoryPeerMedian, 1e-6);
  return Object.freeze({
    searchLevel: level,
    searchMomentum: momentum(series),
    searchAcceleration: acceleration(series),
    queryBreadth: clamp01(input.queryBreadth),
    brandSearchShare: clamp01(input.brandShare),
    productSearchShare: clamp01(input.productShare),
    categoryRelativeSearch: level / cat,
  });
}

export function buildWebDemandFeatures(input: {
  readonly visitsPoint: number;
  readonly visitorsPoint: number;
  readonly visitGrowth: number;
  readonly engagementSeconds: number;
  readonly referralMix: Readonly<Record<string, number>>;
}): WebDemandFeatures {
  return Object.freeze({
    visits: providerEstimate({
      point: input.visitsPoint,
      low: input.visitsPoint * 0.85,
      high: input.visitsPoint * 1.15,
      unitLabel: 'visits_index',
      semantics: 'PROVIDER_MODEL_ESTIMATE',
    }),
    uniqueAggregateVisitors: providerEstimate({
      point: input.visitorsPoint,
      low: input.visitorsPoint * 0.8,
      high: input.visitorsPoint * 1.2,
      unitLabel: 'unique_visitors_index',
      semantics: 'PROVIDER_MODEL_ESTIMATE',
    }),
    visitGrowth: input.visitGrowth,
    engagementDurationAggregate: input.engagementSeconds,
    referralMixAggregate: Object.freeze({ ...input.referralMix }),
  });
}

export function buildAppDemandFeatures(input: {
  readonly ranking: number | null;
  readonly downloads: number | null;
  readonly activeUsers: number | null;
  readonly usageGrowth: number;
  readonly reviewVelocity: number | null;
}): AppDemandFeatures {
  return Object.freeze({
    ranking: input.ranking,
    downloadEstimate:
      input.downloads === null
        ? null
        : providerEstimate({
            point: input.downloads,
            low: input.downloads * 0.7,
            high: input.downloads * 1.3,
            unitLabel: 'downloads_estimate',
            semantics: 'PROVIDER_MODEL_ESTIMATE',
          }),
    activeUserEstimate:
      input.activeUsers === null
        ? null
        : providerEstimate({
            point: input.activeUsers,
            low: input.activeUsers * 0.75,
            high: input.activeUsers * 1.25,
            unitLabel: 'mau_estimate',
            semantics: 'PROVIDER_MODEL_ESTIMATE',
          }),
    usageGrowth: input.usageGrowth,
    reviewVelocity:
      input.reviewVelocity === null
        ? null
        : providerEstimate({
            point: input.reviewVelocity,
            low: input.reviewVelocity * 0.5,
            high: input.reviewVelocity * 1.5,
            unitLabel: 'reviews_per_day_estimate',
            semantics: 'PROVIDER_MODEL_ESTIMATE',
          }),
  });
}
