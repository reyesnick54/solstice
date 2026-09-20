/**
 * HELIOS M06 — bridge crypto spot observations into M04 canonical MarketState.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type {
  CapitalMarketBar,
  CapitalMarketObservation,
  CapitalMarketSessionObservation,
} from '../../../../sunrey-exchange/src/capital-market/types.ts';
import type { CapitalMarketTimeframe } from '../../../../sunrey-exchange/src/capital-market/timeframes.ts';
import { resolveMultiAssetInstrument } from '../../../../sunrey-exchange/src/capital-market/multi-asset/index.ts';
import { resolveCryptoSpotInstrument } from '../../../../sunrey-exchange/src/crypto-market/spot/instrument-registry.ts';
import { evaluateMarketState } from './evaluate.ts';
import type { MultiAssetInstrumentRecord } from './m01/types.ts';
import type { MultiAssetObservationBundle } from './m02/types.ts';
import type { MultiAssetSessionContractRecord } from './m03/types.ts';
import type { MarketState, MarketStateEvaluationResult, MarketTradabilityDecision } from './types.ts';

export type HeliosCryptoSpotMarketState = {
  readonly instrumentId: string;
  readonly symbol: string;
  readonly baseAsset: string | null;
  readonly quoteAsset: string | null;
  readonly venueId: string;
  readonly sessionStatus: string;
  readonly lastMinorUnits: bigint | null;
  readonly referenceMinorUnits: bigint | null;
  readonly latestBarCloseMinorUnits: bigint | null;
  readonly latestBarTimeframe: CapitalMarketTimeframe | null;
  readonly latestBarPeriodStart: UtcInstant | null;
  readonly volumeUnits: bigint | null;
  readonly volumeKind: 'QUOTE_NOTIONAL' | 'BASE_UNITS' | 'UNKNOWN';
  readonly providerId: string;
  readonly evaluatedAt: UtcInstant;
  readonly executionEnabled: false;
  readonly researchOnly: true;
  readonly marketState: MarketState | null;
  readonly tradability: MarketTradabilityDecision | null;
};

export function buildHeliosCryptoSpotMarketState(input: {
  readonly instrumentId: string;
  readonly quote: CapitalMarketObservation | null;
  readonly session: CapitalMarketSessionObservation | null;
  readonly latestBar: CapitalMarketBar | null;
  readonly barTimeframe?: CapitalMarketTimeframe;
  readonly evaluatedAt: UtcInstant;
  readonly staleQuote?: boolean;
}): HeliosCryptoSpotMarketState | null {
  const instrument = resolveCryptoSpotInstrument(input.instrumentId);
  if (!instrument) {
    return null;
  }

  const multiAsset = resolveMultiAssetInstrument(input.instrumentId);
  const timeframe = input.barTimeframe ?? input.latestBar?.timeframe ?? '1h';
  const latestBar = input.latestBar;
  const sessionStatus = input.session?.sessionStatus ?? input.quote?.sessionStatus ?? 'UNKNOWN';
  const m04 = buildM04Evaluation({
    instrumentId: input.instrumentId,
    quote: input.quote,
    session: input.session,
    latestBar,
    timeframe,
    evaluatedAt: input.evaluatedAt,
    staleQuote: input.staleQuote ?? false,
    instrument,
  });

  return Object.freeze({
    instrumentId: instrument.instrumentId,
    symbol: instrument.symbol,
    baseAsset: multiAsset?.baseAsset ?? null,
    quoteAsset: multiAsset?.quoteAsset ?? null,
    venueId: instrument.venue.venueId,
    sessionStatus,
    lastMinorUnits: input.quote?.lastMinorUnits ?? latestBar?.closeMinorUnits ?? null,
    referenceMinorUnits: input.quote?.lastMinorUnits ?? latestBar?.closeMinorUnits ?? null,
    latestBarCloseMinorUnits: latestBar?.closeMinorUnits ?? null,
    latestBarTimeframe: latestBar?.timeframe ?? null,
    latestBarPeriodStart: latestBar?.periodStart ?? null,
    volumeUnits: latestBar?.volumeUnits ?? input.quote?.volumeUnits ?? null,
    volumeKind:
      latestBar?.volumeUnits !== null && latestBar?.volumeUnits !== undefined
        ? 'QUOTE_NOTIONAL'
        : input.quote?.volumeUnits
          ? 'QUOTE_NOTIONAL'
          : 'UNKNOWN',
    providerId: input.quote?.providerId ?? input.session?.providerId ?? latestBar?.providerId ?? 'unknown',
    evaluatedAt: input.evaluatedAt,
    executionEnabled: false,
    researchOnly: true,
    marketState: m04?.marketState ?? null,
    tradability: m04?.tradability ?? null,
  });
}

function buildM04Evaluation(input: {
  readonly instrumentId: string;
  readonly quote: CapitalMarketObservation | null;
  readonly session: CapitalMarketSessionObservation | null;
  readonly latestBar: CapitalMarketBar | null;
  readonly timeframe: CapitalMarketTimeframe;
  readonly evaluatedAt: UtcInstant;
  readonly staleQuote: boolean;
  readonly instrument: NonNullable<ReturnType<typeof resolveCryptoSpotInstrument>>;
}): MarketStateEvaluationResult | null {
  const instrumentRecord: MultiAssetInstrumentRecord = Object.freeze({
    instrumentId: input.instrument.instrumentId,
    symbol: input.instrument.symbol,
    assetClass: 'CRYPTO_SPOT',
    venueId: input.instrument.venue.venueId,
    venueDisplayName: input.instrument.venue.displayName,
    currency: input.instrument.currency,
    priceScale: 2,
    instrumentMode: 'RESEARCH_ONLY',
    active: true,
    halted: input.session?.sessionStatus === 'HALTED',
    researchOnly: true,
  });

  const quoteObs = input.quote
    ? Object.freeze({
        observationId: input.quote.provenance.observationId,
        providerId: input.quote.providerId,
        sourceId: input.quote.provenance.capability,
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
        entitlementUsable: input.quote.entitlement.entitlementClass !== 'unknown',
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
