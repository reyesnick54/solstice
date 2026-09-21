/**
 * Provider-neutral bridge from MarketRegime into Strategy Lab and research consumers.
 */

import type { MarketRegime, DetectedRegime } from './types.ts';
import type { MarketRegimeDimension } from './taxonomy.ts';

export type MarketRegimeResearchView = {
  readonly scopeId: string;
  readonly scope: MarketRegime['scope'];
  readonly asOf: MarketRegime['asOf'];
  readonly dimensions: readonly MarketRegimeDimension[];
  readonly detectedRegimes: readonly DetectedRegime[];
  readonly dataQualityState: MarketRegime['dataQualityState'];
  readonly validUntil: MarketRegime['validUntil'];
  readonly methodologyVersion: string;
};

export function bridgeMarketRegimeToResearch(regime: MarketRegime): MarketRegimeResearchView {
  return Object.freeze({
    scopeId: regime.scopeId,
    scope: regime.scope,
    asOf: regime.asOf,
    dimensions: Object.freeze(regime.detectedRegimes.map((row) => row.dimension)),
    detectedRegimes: regime.detectedRegimes,
    dataQualityState: regime.dataQualityState,
    validUntil: regime.validUntil,
    methodologyVersion: regime.methodologyVersion,
  });
}

/** Map M13 dimensions to legacy M09 bar regime labels for backward-compatible feature feeds. */
export function mapRegimeToLegacyM09Label(
  detected: readonly DetectedRegime[],
): 'TRENDING' | 'MEAN_REVERTING' | 'HIGH_VOL' | 'LOW_VOL' | 'UNKNOWN' {
  const dimensions = new Set(detected.map((row) => row.dimension));
  if (dimensions.has('HIGH_VOLATILITY')) {
    return 'HIGH_VOL';
  }
  if (dimensions.has('LOW_VOLATILITY')) {
    return 'LOW_VOL';
  }
  if (dimensions.has('TRENDING_UP') || dimensions.has('TRENDING_DOWN')) {
    return 'TRENDING';
  }
  if (dimensions.has('RANGE_BOUND')) {
    return 'MEAN_REVERTING';
  }
  return 'UNKNOWN';
}
