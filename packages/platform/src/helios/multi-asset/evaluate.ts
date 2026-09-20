/**
 * Build canonical MarketState from M01–M03 inputs.
 */

import { assessMarketDataQuality, computeSpreadBps } from './data-quality.ts';
import type { MultiAssetPriceQuote } from './m02/types.ts';
import type {
  MarketState,
  MarketStateEvaluationInput,
  MarketStateEvaluationResult,
  MarketStateEvidenceRef,
} from './market-state-types.ts';
import { evaluateTradability } from './tradability.ts';
import type {
  BarTimeframe,
  MarketConfidenceBand,
  MarketEntitlementState,
  MarketFreshnessState,
} from './taxonomy.ts';

export function evaluateMarketState(input: MarketStateEvaluationInput): MarketStateEvaluationResult {
  const dataQuality = assessMarketDataQuality(input);
  const quote = input.observations.quote;
  const referencePrice = quote?.referencePrice ?? quote?.bid ?? quote?.ask ?? null;
  const bid = quote?.bid ?? null;
  const ask = quote?.ask ?? null;
  const spread = deriveSpread(bid, ask, input.instrument.currency, input.instrument.priceScale);
  const spreadBps =
    quote && bid && ask
      ? computeSpreadBps(bid, ask, referencePrice, input.instrument.priceScale)
      : null;

  const marketState: MarketState = Object.freeze({
    instrumentId: input.instrument.instrumentId,
    assetClass: input.instrument.assetClass,
    venue: input.instrument.venueDisplayName,
    sessionState: input.sessionContract.sessionState,
    referencePrice,
    bid,
    ask,
    spread,
    spreadBps,
    recentVolume: quote?.recentVolume ?? null,
    availableBarTimeframes: normalizeBarTimeframes(input.observations.availableBarTimeframes),
    latestObservationTimestamp: input.observations.latestObservationTimestamp,
    freshness: deriveFreshness(input.observations, quote?.freshness ?? 'UNKNOWN'),
    dataQuality,
    volatilityState: input.sessionContract.volatilityState,
    liquidityState: input.sessionContract.liquidityState,
    futuresRollState: input.sessionContract.futuresRollState,
    entitlementState: deriveEntitlementState(quote?.entitlementBlocked ?? false, quote?.entitlementUsable ?? false),
    providerHealth: quote?.providerHealth ?? 'UNKNOWN',
    executionCapability: input.sessionContract.executionCapability,
    confidence: deriveConfidence(dataQuality.state, quote?.corroborationCount ?? 0),
    evidenceRefs: collectEvidenceRefs(input),
    evaluatedAt: input.now,
  });

  const tradability = evaluateTradability({
    instrument: input.instrument,
    observations: input.observations,
    sessionContract: input.sessionContract,
    dataQuality,
  });

  return Object.freeze({ marketState, tradability });
}

function deriveSpread(
  bid: MultiAssetPriceQuote | null,
  ask: MultiAssetPriceQuote | null,
  currency: string,
  scale: number,
): MultiAssetPriceQuote | null {
  if (!bid || !ask) {
    return null;
  }
  const spreadMinor = BigInt(ask.minorUnits) - BigInt(bid.minorUnits);
  if (spreadMinor <= 0n) {
    return null;
  }
  return Object.freeze({
    minorUnits: spreadMinor.toString(),
    currency,
    scale,
  });
}

function deriveFreshness(
  observations: MarketStateEvaluationInput['observations'],
  quoteFreshness: MarketFreshnessState,
): MarketFreshnessState {
  const barFreshness = observations.bars.map((bar) => bar.freshness);
  if (quoteFreshness === 'STALE' || barFreshness.includes('STALE')) {
    return 'STALE';
  }
  if (quoteFreshness === 'AGING' || barFreshness.includes('AGING')) {
    return 'AGING';
  }
  if (quoteFreshness === 'FRESH' || barFreshness.includes('FRESH')) {
    return 'FRESH';
  }
  return 'UNKNOWN';
}

function deriveEntitlementState(blocked: boolean, usable: boolean): MarketEntitlementState {
  if (blocked) {
    return 'BLOCKED';
  }
  if (usable) {
    return 'USABLE';
  }
  return 'RESTRICTED';
}

function deriveConfidence(
  qualityState: MarketStateEvaluationResult['marketState']['dataQuality']['state'],
  corroborationCount: number,
): MarketConfidenceBand {
  if (qualityState === 'UNUSABLE') {
    return 'NONE';
  }
  if (qualityState === 'DEGRADED' || corroborationCount < 1) {
    return 'LOW';
  }
  if (corroborationCount === 1) {
    return 'MEDIUM';
  }
  return 'HIGH';
}

function normalizeBarTimeframes(values: readonly string[]): readonly BarTimeframe[] {
  const allowed = new Set<string>(['1m', '5m', '15m', '1h', '4h', '1d']);
  return Object.freeze(values.filter((value): value is BarTimeframe => allowed.has(value)));
}

function collectEvidenceRefs(input: MarketStateEvaluationInput): readonly MarketStateEvidenceRef[] {
  const refs: MarketStateEvidenceRef[] = [
    Object.freeze({ refType: 'instrument', refId: input.instrument.instrumentId }),
  ];
  if (input.observations.quote) {
    refs.push(Object.freeze({ refType: 'quote', refId: input.observations.quote.observationId }));
  }
  for (const bar of input.observations.bars) {
    refs.push(Object.freeze({ refType: 'bar', refId: bar.barId }));
  }
  if (input.sessionContract.routeId) {
    refs.push(Object.freeze({ refType: 'route', refId: input.sessionContract.routeId }));
  }
  refs.push(Object.freeze({ refType: 'session', refId: `${input.instrument.venueId}:${input.sessionContract.sessionState}` }));
  return Object.freeze(refs);
}
