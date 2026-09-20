/**
 * HELIOS M06 — bridge crypto spot observations into M04 canonical MarketState.
 *
 * Platform-local DTOs only. Callers map exchange observations into this shape.
 */

import type { UtcInstant } from '@solstice/domain';
import { evaluateMarketState } from './evaluate.ts';
import type { MultiAssetInstrumentRecord } from './m01/types.ts';
import type { MultiAssetObservationBundle } from './m02/types.ts';
import type { MultiAssetSessionContractRecord } from './m03/types.ts';
import type { MarketState, MarketStateEvaluationResult, MarketTradabilityDecision } from './types.ts';

export type CryptoSpotM04BridgeQuote = {
  readonly observationId: string;
  readonly providerId: string;
  readonly capability: string;
  readonly sourceTimestamp: UtcInstant;
  readonly availabilityTimestamp: UtcInstant | null;
  readonly arrivalTimestamp: UtcInstant;
  readonly lastMinorUnits: bigint | null;
  readonly bidMinorUnits: bigint | null;
  readonly askMinorUnits: bigint | null;
  readonly volumeUnits: bigint | null;
  readonly currency: string;
  readonly priceScale: number;
  readonly entitlementUsable: boolean;
};

export type CryptoSpotM04BridgeBar = {
  readonly barId: string;
  readonly timeframe: string;
  readonly sourceTimestamp: UtcInstant;
  readonly providerId: string;
};

export type CryptoSpotM04BridgeSession = {
  readonly sessionStatus: string;
  readonly isOpen: boolean;
  readonly providerId: string;
};

export type CryptoSpotM04BridgeInput = {
  readonly instrumentId: string;
  readonly symbol: string;
  readonly venueId: string;
  readonly venueDisplayName: string;
  readonly currency: string;
  readonly baseAsset: string | null;
  readonly quoteAsset: string | null;
  readonly quote: CryptoSpotM04BridgeQuote | null;
  readonly session: CryptoSpotM04BridgeSession | null;
  readonly latestBar: CryptoSpotM04BridgeBar | null;
  readonly timeframe: string;
  readonly evaluatedAt: UtcInstant;
  readonly staleQuote?: boolean;
};

export type HeliosCryptoSpotM04MarketState = {
  readonly instrumentId: string;
  readonly symbol: string;
  readonly baseAsset: string | null;
  readonly quoteAsset: string | null;
  readonly venueId: string;
  readonly sessionStatus: string;
  readonly evaluatedAt: UtcInstant;
  readonly executionEnabled: false;
  readonly researchOnly: true;
  readonly marketState: MarketState | null;
  readonly tradability: MarketTradabilityDecision | null;
};

export function buildHeliosCryptoSpotM04MarketState(
  input: CryptoSpotM04BridgeInput,
): HeliosCryptoSpotM04MarketState | null {
  const m04 = buildM04Evaluation(input);
  const sessionStatus = input.session?.sessionStatus ?? 'UNKNOWN';

  return Object.freeze({
    instrumentId: input.instrumentId,
    symbol: input.symbol,
    baseAsset: input.baseAsset,
    quoteAsset: input.quoteAsset,
    venueId: input.venueId,
    sessionStatus,
    evaluatedAt: input.evaluatedAt,
    executionEnabled: false,
    researchOnly: true,
    marketState: m04?.marketState ?? null,
    tradability: m04?.tradability ?? null,
  });
}

function buildM04Evaluation(input: CryptoSpotM04BridgeInput): MarketStateEvaluationResult | null {
  const instrumentRecord: MultiAssetInstrumentRecord = Object.freeze({
    instrumentId: input.instrumentId,
    symbol: input.symbol,
    assetClass: 'CRYPTO_SPOT',
    venueId: input.venueId,
    venueDisplayName: input.venueDisplayName,
    currency: input.currency,
    priceScale: 2,
    instrumentMode: 'RESEARCH_ONLY',
    active: true,
    halted: input.session?.sessionStatus === 'HALTED',
    researchOnly: true,
  });

  const quoteObs = input.quote
    ? Object.freeze({
        observationId: input.quote.observationId,
        providerId: input.quote.providerId,
        sourceId: input.quote.capability,
        observedAt: input.quote.sourceTimestamp,
        knowableAt: input.quote.availabilityTimestamp ?? input.quote.arrivalTimestamp,
        referencePrice: input.quote.lastMinorUnits
          ? Object.freeze({
              minorUnits: input.quote.lastMinorUnits.toString(),
              currency: input.quote.currency,
              scale: input.quote.priceScale,
            })
          : null,
        bid: input.quote.bidMinorUnits
          ? Object.freeze({
              minorUnits: input.quote.bidMinorUnits.toString(),
              currency: input.quote.currency,
              scale: input.quote.priceScale,
            })
          : null,
        ask: input.quote.askMinorUnits
          ? Object.freeze({
              minorUnits: input.quote.askMinorUnits.toString(),
              currency: input.quote.currency,
              scale: input.quote.priceScale,
            })
          : null,
        recentVolume: input.quote.volumeUnits?.toString() ?? null,
        freshness: input.staleQuote ? ('STALE' as const) : ('FRESH' as const),
        qualityState: input.staleQuote ? 'DEGRADED_STALE' : 'VALID',
        entitlementUsable: input.quote.entitlementUsable,
        entitlementBlocked: false,
        timestampConsistent: true,
        contradictory: false,
        corroborationCount: 1,
        providerHealth: 'HEALTHY' as const,
      })
    : null;

  const observations: MultiAssetObservationBundle = Object.freeze({
    quote: quoteObs,
    bars: Object.freeze(
      input.latestBar
        ? [
            Object.freeze({
              barId: input.latestBar.barId,
              timeframe: input.latestBar.timeframe,
              observedAt: input.latestBar.sourceTimestamp,
              freshness: 'FRESH' as const,
              complete: true,
            }),
          ]
        : [],
    ),
    availableBarTimeframes: Object.freeze([input.timeframe]),
    latestObservationTimestamp: input.quote?.sourceTimestamp ?? input.latestBar?.sourceTimestamp ?? null,
  });

  const sessionOpen = input.session?.isOpen ?? input.session?.sessionStatus === 'OPEN';
  const sessionContract: MultiAssetSessionContractRecord = Object.freeze({
    sessionState: sessionOpen ? 'OPEN' : input.session?.sessionStatus === 'CLOSED' ? 'CLOSED' : 'UNKNOWN',
    contractValidUntil: null,
    liquidityState: 'ADEQUATE',
    volatilityState: 'NORMAL',
    futuresRollState: 'NOT_APPLICABLE',
    executionCapability: 'UNAVAILABLE',
    routeAvailable: Boolean(input.quote),
    routeId: input.quote ? `helios.crypto-market.${input.quote.providerId}` : null,
  });

  return evaluateMarketState({
    instrument: instrumentRecord,
    observations,
    sessionContract,
    now: input.evaluatedAt,
  });
}
