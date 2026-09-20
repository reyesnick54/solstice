/**
 * Maps exchange crypto spot observations into platform M04 bridge DTOs.
 */

import type {
  CapitalMarketBar,
  CapitalMarketObservation,
  CapitalMarketSessionObservation,
} from '../../packages/sunrey-exchange/src/capital-market/types.ts';
import type { CryptoSpotM04BridgeInput } from '../../packages/platform/src/helios/multi-asset/crypto-spot-bridge.ts';
import { resolveCryptoSpotInstrument } from '../../packages/sunrey-exchange/src/crypto-market/spot/instrument-registry.ts';
import { resolveMultiAssetInstrument } from '../../packages/sunrey-exchange/src/capital-market/multi-asset/index.ts';
import type { UtcInstant } from '../../packages/domain/src/time.ts';
import type { CapitalMarketTimeframe } from '../../packages/sunrey-exchange/src/capital-market/timeframes.ts';

export function toCryptoSpotM04BridgeInput(input: {
  readonly instrumentId: string;
  readonly quote: CapitalMarketObservation | null;
  readonly session: CapitalMarketSessionObservation | null;
  readonly latestBar: CapitalMarketBar | null;
  readonly timeframe: CapitalMarketTimeframe;
  readonly evaluatedAt: UtcInstant;
  readonly staleQuote?: boolean;
}): CryptoSpotM04BridgeInput | null {
  const instrument = resolveCryptoSpotInstrument(input.instrumentId);
  if (!instrument) {
    return null;
  }
  const multiAsset = resolveMultiAssetInstrument(input.instrumentId);

  return Object.freeze({
    instrumentId: instrument.instrumentId,
    symbol: instrument.symbol,
    venueId: instrument.venue.venueId,
    venueDisplayName: instrument.venue.displayName,
    currency: instrument.currency,
    baseAsset: multiAsset?.baseAsset ?? null,
    quoteAsset: multiAsset?.quoteAsset ?? null,
    quote: input.quote
      ? Object.freeze({
          observationId: input.quote.provenance.observationId,
          providerId: input.quote.providerId,
          capability: input.quote.provenance.capability,
          sourceTimestamp: input.quote.sourceTimestamp,
          availabilityTimestamp: input.quote.availabilityTimestamp ?? null,
          arrivalTimestamp: input.quote.arrivalTimestamp,
          lastMinorUnits: input.quote.lastMinorUnits ?? null,
          bidMinorUnits: input.quote.bidMinorUnits ?? null,
          askMinorUnits: input.quote.askMinorUnits ?? null,
          volumeUnits: input.quote.volumeUnits ?? null,
          currency: input.quote.currency,
          priceScale: input.quote.priceScale,
          entitlementUsable: input.quote.entitlement.entitlementClass !== 'unknown',
        })
      : null,
    session: input.session
      ? Object.freeze({
          sessionStatus: input.session.sessionStatus,
          isOpen: input.session.isOpen,
          providerId: input.session.providerId,
        })
      : null,
    latestBar: input.latestBar
      ? Object.freeze({
          barId: input.latestBar.barId,
          timeframe: input.latestBar.timeframe,
          sourceTimestamp: input.latestBar.sourceTimestamp,
          providerId: input.latestBar.providerId,
        })
      : null,
    timeframe: input.timeframe,
    evaluatedAt: input.evaluatedAt,
    ...(input.staleQuote ? { staleQuote: true } : {}),
  });
}
