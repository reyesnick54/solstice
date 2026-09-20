/**
 * Deterministic market data quality assessment for M04.
 * Does not use AI or probabilistic scoring.
 */

import type { MultiAssetInstrumentRecord } from './m01/types.ts';
import type { MultiAssetObservationBundle } from './m02/types.ts';
import type { MultiAssetSessionContractRecord } from './m03/types.ts';
import type { MarketDataQualityAssessment } from './types.ts';
import type { MarketDataQualityDimension, TradabilityReasonCode } from './taxonomy.ts';

const EXTREME_SPREAD_BPS = 500;

export function assessMarketDataQuality(input: {
  readonly instrument: MultiAssetInstrumentRecord;
  readonly observations: MultiAssetObservationBundle;
  readonly sessionContract: MultiAssetSessionContractRecord;
}): MarketDataQualityAssessment {
  const dimensions: Record<MarketDataQualityDimension, 'PASS' | 'WARN' | 'FAIL'> = {
    freshness: 'PASS',
    completeness: 'PASS',
    providerHealth: 'PASS',
    entitlement: 'PASS',
    timestampConsistency: 'PASS',
    spreadSanity: 'PASS',
    corroboration: 'PASS',
  };
  const flags: TradabilityReasonCode[] = [];
  const quote = input.observations.quote;

  if (!quote) {
    dimensions.completeness = 'FAIL';
    flags.push('MISSING_REFERENCE_PRICE');
  } else {
    if (quote.freshness === 'STALE') {
      dimensions.freshness = 'FAIL';
      flags.push('QUOTE_STALE');
    } else if (quote.freshness === 'AGING') {
      dimensions.freshness = 'WARN';
    }

    if (!quote.referencePrice && !quote.bid && !quote.ask) {
      dimensions.completeness = 'FAIL';
      flags.push('MISSING_REFERENCE_PRICE');
    }
    if (!quote.bid || !quote.ask) {
      dimensions.completeness = dimensions.completeness === 'FAIL' ? 'FAIL' : 'WARN';
      flags.push('MISSING_BID_ASK');
    }
    if (quote.recentVolume === null) {
      dimensions.completeness = dimensions.completeness === 'FAIL' ? 'FAIL' : 'WARN';
      flags.push('MISSING_VOLUME');
    }

    if (quote.entitlementBlocked) {
      dimensions.entitlement = 'FAIL';
      flags.push('ENTITLEMENT_BLOCKED');
    } else if (!quote.entitlementUsable) {
      dimensions.entitlement = 'WARN';
      flags.push('ENTITLEMENT_RESTRICTED');
    }

    if (!quote.timestampConsistent) {
      dimensions.timestampConsistency = 'FAIL';
      flags.push('TIMESTAMP_INCONSISTENT');
    }

    if (quote.contradictory) {
      dimensions.corroboration = 'FAIL';
      flags.push('CONTRADICTORY_SOURCES');
    } else if (quote.corroborationCount < 1) {
      dimensions.corroboration = 'WARN';
      flags.push('INSUFFICIENT_CORROBORATION');
    }

    const spreadBps = computeSpreadBps(quote.bid, quote.ask, quote.referencePrice, input.instrument.priceScale);
    if (spreadBps !== null && spreadBps >= EXTREME_SPREAD_BPS) {
      dimensions.spreadSanity = 'FAIL';
      flags.push('EXTREME_SPREAD');
    }

    if (quote.providerHealth === 'OUTAGE') {
      dimensions.providerHealth = 'FAIL';
      flags.push('PROVIDER_OUTAGE');
    } else if (quote.providerHealth === 'MAINTENANCE') {
      dimensions.providerHealth = 'FAIL';
      flags.push('PROVIDER_MAINTENANCE');
    } else if (quote.providerHealth === 'DEGRADED') {
      dimensions.providerHealth = 'WARN';
      flags.push('PROVIDER_DEGRADED');
    }
  }

  const staleBars = input.observations.bars.filter((bar) => bar.freshness === 'STALE' || !bar.complete);
  if (staleBars.length > 0) {
    dimensions.freshness = dimensions.freshness === 'PASS' ? 'WARN' : dimensions.freshness;
    if (staleBars.some((bar) => bar.freshness === 'STALE')) {
      dimensions.freshness = 'FAIL';
      flags.push('BAR_STALE');
    }
  }

  if (input.observations.availableBarTimeframes.length === 0 && input.observations.bars.length === 0) {
    dimensions.completeness = dimensions.completeness === 'FAIL' ? 'FAIL' : 'WARN';
    flags.push('DATA_INCOMPLETE');
  }

  if (input.sessionContract.executionCapability === 'UNAVAILABLE') {
    dimensions.completeness = dimensions.completeness === 'FAIL' ? 'FAIL' : 'WARN';
  }

  const state = deriveQualityState(dimensions);
  return Object.freeze({
    state,
    dimensions: Object.freeze({ ...dimensions }),
    flags: Object.freeze(flags),
  });
}

function deriveQualityState(
  dimensions: Record<MarketDataQualityDimension, 'PASS' | 'WARN' | 'FAIL'>,
): MarketDataQualityAssessment['state'] {
  const failDimensions = (Object.entries(dimensions) as Array<[MarketDataQualityDimension, 'PASS' | 'WARN' | 'FAIL']>)
    .filter(([, value]) => value === 'FAIL')
    .map(([key]) => key);
  if (failDimensions.length === 1 && failDimensions[0] === 'spreadSanity') {
    return 'DEGRADED';
  }
  const values = Object.values(dimensions);
  if (values.some((value) => value === 'FAIL')) {
    return 'UNUSABLE';
  }
  if (values.some((value) => value === 'WARN')) {
    return 'DEGRADED';
  }
  return 'HEALTHY';
}

function computeSpreadBps(
  bid: { readonly minorUnits: string } | null,
  ask: { readonly minorUnits: string } | null,
  reference: { readonly minorUnits: string } | null,
  scale: number,
): number | null {
  if (!bid || !ask) {
    return null;
  }
  const bidMinor = BigInt(bid.minorUnits);
  const askMinor = BigInt(ask.minorUnits);
  if (askMinor <= bidMinor) {
    return null;
  }
  const spreadMinor = askMinor - bidMinor;
  const midMinor = reference ? BigInt(reference.minorUnits) : (bidMinor + askMinor) / 2n;
  if (midMinor <= 0n) {
    return null;
  }
  const spreadBps = Number((spreadMinor * 10_000n * BigInt(10 ** scale)) / midMinor) / 10 ** scale;
  return Number.isFinite(spreadBps) ? spreadBps : null;
}

export { EXTREME_SPREAD_BPS, computeSpreadBps };
