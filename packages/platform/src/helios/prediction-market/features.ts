/**
 * Feature Fabric — native prediction-market feature definitions and extraction.
 */

import type { UtcInstant } from '@solstice/domain';
import { computeClobBookMetrics, complementGapMinor } from './clob-metrics.ts';
import { PREDICTION_FEATURE_KEYS, PREDICTION_PROBABILITY_SCALE } from './taxonomy.ts';
import type { CloOrderBookSnapshot, PredictionFeatureVector } from './types.ts';

export { PREDICTION_FEATURE_KEYS };

export function extractContractFeatures(
  snapshot: CloOrderBookSnapshot,
  asOf: UtcInstant,
): PredictionFeatureVector {
  const m = computeClobBookMetrics(snapshot);
  const features: Record<string, bigint | number | null> = {
    'pm.best_bid': m.bestBidMinor,
    'pm.best_ask': m.bestAskMinor,
    'pm.mid': m.midMinor,
    'pm.spread': m.spreadMinor,
    'pm.spread_bps': m.spreadBps,
    'pm.bid_depth': m.bidDepthContracts,
    'pm.ask_depth': m.askDepthContracts,
    'pm.book_imbalance': m.imbalanceScaled,
    'pm.volume_24h': m.volume24hContracts,
    'pm.time_to_expiry_hours': null,
    'pm.yes_implied_prob': null,
    'pm.no_implied_prob': null,
    'pm.complement_gap': null,
  };
  return Object.freeze({
    instrumentId: snapshot.contractInstrumentId,
    asOf,
    features: Object.freeze(features),
  });
}

export function extractYesNoPairFeatures(input: {
  readonly yesBook: CloOrderBookSnapshot;
  readonly noBook: CloOrderBookSnapshot;
  readonly asOf: UtcInstant;
  readonly hoursToExpiry: number | null;
}): PredictionFeatureVector {
  const yes = computeClobBookMetrics(input.yesBook);
  const no = computeClobBookMetrics(input.noBook);
  const gap = complementGapMinor(yes.midMinor, no.midMinor);
  return Object.freeze({
    instrumentId: input.yesBook.contractInstrumentId,
    asOf: input.asOf,
    features: Object.freeze({
      'pm.best_bid': yes.bestBidMinor,
      'pm.best_ask': yes.bestAskMinor,
      'pm.mid': yes.midMinor,
      'pm.spread': yes.spreadMinor,
      'pm.spread_bps': yes.spreadBps,
      'pm.bid_depth': yes.bidDepthContracts,
      'pm.ask_depth': yes.askDepthContracts,
      'pm.book_imbalance': yes.imbalanceScaled,
      'pm.volume_24h': yes.volume24hContracts + no.volume24hContracts,
      'pm.time_to_expiry_hours': input.hoursToExpiry,
      'pm.yes_implied_prob': yes.midMinor,
      'pm.no_implied_prob': no.midMinor,
      'pm.complement_gap': gap,
    }),
  });
}

export function probabilityEdgeMinor(fairProbMinor: bigint, marketMidMinor: bigint | null): bigint | null {
  if (marketMidMinor === null) {
    return null;
  }
  return fairProbMinor - marketMidMinor;
}

export function isWithinProbabilityBounds(priceMinor: bigint): boolean {
  return priceMinor >= 0n && priceMinor <= PREDICTION_PROBABILITY_SCALE;
}
