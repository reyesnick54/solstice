/**
 * Deterministic tradability engine for M04.
 */

import type { MultiAssetInstrumentRecord } from './m01/types.ts';
import type { MultiAssetObservationBundle } from './m02/types.ts';
import type { MultiAssetSessionContractRecord } from './m03/types.ts';
import { computeSpreadBps } from './data-quality.ts';
import type { MarketCapabilityFlags, MarketDataQualityAssessment, MarketTradabilityDecision } from './types.ts';
import type { TradabilityReasonCode, TradabilityState } from './taxonomy.ts';

type TradabilityContext = {
  readonly instrument: MultiAssetInstrumentRecord;
  readonly observations: MultiAssetObservationBundle;
  readonly sessionContract: MultiAssetSessionContractRecord;
  readonly dataQuality: MarketDataQualityAssessment;
};

export function evaluateTradability(context: TradabilityContext): MarketTradabilityDecision {
  const reasonCodes = collectReasonCodes(context);
  const tradability = classifyTradability(context, reasonCodes);
  const capabilities = deriveCapabilities(context, tradability, reasonCodes);
  const primaryReason = reasonCodes[0] ?? 'OK';
  return Object.freeze({
    tradability,
    capabilities,
    reasonCodes: Object.freeze(reasonCodes),
    primaryReason,
  });
}

function collectReasonCodes(context: TradabilityContext): TradabilityReasonCode[] {
  const codes: TradabilityReasonCode[] = [];
  const { instrument, observations, sessionContract, dataQuality } = context;
  const quote = observations.quote;

  if (!instrument.active) {
    codes.push('INSTRUMENT_INACTIVE');
  }
  if (instrument.researchOnly || instrument.instrumentMode === 'RESEARCH_ONLY') {
    codes.push('INSTRUMENT_RESEARCH_ONLY');
  }
  if (quote?.entitlementBlocked) {
    codes.push('ENTITLEMENT_BLOCKED');
  } else if (quote && !quote.entitlementUsable) {
    codes.push('ENTITLEMENT_RESTRICTED');
  }
  if (quote?.providerHealth === 'OUTAGE') {
    codes.push('PROVIDER_OUTAGE');
  } else if (quote?.providerHealth === 'MAINTENANCE') {
    codes.push('PROVIDER_MAINTENANCE');
  } else if (quote?.providerHealth === 'DEGRADED') {
    codes.push('PROVIDER_DEGRADED');
  }
  if (sessionContract.sessionState === 'CLOSED') {
    codes.push('VENUE_CLOSED');
  }
  if (sessionContract.sessionState === 'HALTED') {
    codes.push('VENUE_HALTED');
  }
  if (quote?.freshness === 'STALE') {
    codes.push('QUOTE_STALE');
  }
  if (observations.bars.some((bar) => bar.freshness === 'STALE')) {
    codes.push('BAR_STALE');
  }
  if (!quote?.referencePrice && !quote?.bid && !quote?.ask) {
    codes.push('MISSING_REFERENCE_PRICE');
  }
  if (!quote?.bid || !quote?.ask) {
    codes.push('MISSING_BID_ASK');
  }
  if (quote?.recentVolume === null) {
    codes.push('MISSING_VOLUME');
  }
  if (quote?.contradictory) {
    codes.push('CONTRADICTORY_SOURCES');
  }
  if (!quote?.timestampConsistent) {
    codes.push('TIMESTAMP_INCONSISTENT');
  }
  if (
    quote &&
    computeSpreadBps(quote.bid, quote.ask, quote.referencePrice, instrument.priceScale) !== null &&
    (computeSpreadBps(quote.bid, quote.ask, quote.referencePrice, instrument.priceScale) ?? 0) >= 500
  ) {
    codes.push('EXTREME_SPREAD');
  }
  if (!sessionContract.routeAvailable || sessionContract.executionCapability === 'UNAVAILABLE') {
    codes.push('EXECUTION_ROUTE_UNAVAILABLE');
  }
  if (sessionContract.futuresRollState === 'EXPIRING' || sessionContract.futuresRollState === 'APPROACHING_ROLL') {
    codes.push('CONTRACT_EXPIRING');
  }
  if (dataQuality.state === 'UNUSABLE') {
    if (!codes.includes('MISSING_REFERENCE_PRICE')) {
      codes.push('DATA_INCOMPLETE');
    }
  }
  if (codes.length === 0) {
    codes.push('OK');
  }
  return codes;
}

function classifyTradability(
  context: TradabilityContext,
  reasonCodes: readonly TradabilityReasonCode[],
): TradabilityState {
  if (reasonCodes.includes('INSTRUMENT_INACTIVE')) {
    return 'INSTRUMENT_INACTIVE';
  }
  if (reasonCodes.includes('INSTRUMENT_RESEARCH_ONLY')) {
    return 'RESEARCH_ONLY';
  }
  if (reasonCodes.includes('ENTITLEMENT_BLOCKED')) {
    return 'ENTITLEMENT_BLOCKED';
  }
  if (reasonCodes.includes('PROVIDER_OUTAGE') || reasonCodes.includes('PROVIDER_MAINTENANCE')) {
    return 'PROVIDER_DEGRADED';
  }
  if (reasonCodes.includes('PROVIDER_DEGRADED')) {
    return 'PROVIDER_DEGRADED';
  }
  if (reasonCodes.includes('VENUE_CLOSED') || reasonCodes.includes('VENUE_HALTED')) {
    return 'MARKET_CLOSED';
  }
  if (reasonCodes.includes('CONTRACT_EXPIRING')) {
    return 'CONTRACT_EXPIRING';
  }
  if (reasonCodes.includes('QUOTE_STALE') || reasonCodes.includes('BAR_STALE')) {
    return 'DATA_STALE';
  }
  if (reasonCodes.includes('EXTREME_SPREAD')) {
    return 'RESEARCH_ONLY';
  }
  if (
    reasonCodes.includes('MISSING_REFERENCE_PRICE') ||
    reasonCodes.includes('MISSING_BID_ASK') ||
    reasonCodes.includes('CONTRADICTORY_SOURCES') ||
    reasonCodes.includes('DATA_INCOMPLETE')
  ) {
    return 'INSUFFICIENT_DATA';
  }
  if (reasonCodes.includes('EXECUTION_ROUTE_UNAVAILABLE')) {
    return 'EXECUTION_UNAVAILABLE';
  }
  if (
    reasonCodes.includes('MISSING_VOLUME') ||
    reasonCodes.includes('ENTITLEMENT_RESTRICTED')
  ) {
    return 'RESEARCH_ONLY';
  }
  if (context.dataQuality.state === 'DEGRADED') {
    return 'RESEARCH_ONLY';
  }
  return 'TRADABLE';
}

function deriveCapabilities(
  context: TradabilityContext,
  tradability: TradabilityState,
  reasonCodes: readonly TradabilityReasonCode[],
): MarketCapabilityFlags {
  const quote = context.observations.quote;
  const hasAnyObservation =
    quote !== null ||
    context.observations.bars.length > 0 ||
    context.observations.latestObservationTimestamp !== null;

  const observable = hasAnyObservation && context.instrument.instrumentId.length > 0;

  const researchable =
    observable &&
    !reasonCodes.includes('INSTRUMENT_INACTIVE') &&
    !reasonCodes.includes('ENTITLEMENT_BLOCKED') &&
    tradability !== 'PROVIDER_DEGRADED' &&
    tradability !== 'INSUFFICIENT_DATA';

  const proposalEligible =
    researchable &&
    tradability !== 'RESEARCH_ONLY' &&
    tradability !== 'DATA_STALE' &&
    tradability !== 'MARKET_CLOSED' &&
    tradability !== 'CONTRACT_EXPIRING' &&
    tradability !== 'EXECUTION_UNAVAILABLE' &&
    context.dataQuality.state !== 'UNUSABLE';

  const executable =
    proposalEligible &&
    tradability === 'TRADABLE' &&
    context.sessionContract.executionCapability === 'AVAILABLE' &&
    context.sessionContract.routeAvailable &&
    context.sessionContract.sessionState === 'OPEN';

  return Object.freeze({
    observable,
    researchable,
    proposalEligible,
    executable,
  });
}
