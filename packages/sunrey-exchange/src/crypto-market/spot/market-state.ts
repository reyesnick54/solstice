/**
 * HELIOS M06 — crypto spot market state generation from provider-backed observations.
 */

import type { UtcInstant } from '@solstice/domain';
import { latestBarForInstrument, type CapitalMarketBarStore } from '../../capital-market/bar-store.ts';
import { resolveMultiAssetInstrument } from '../../capital-market/multi-asset/index.ts';
import type { CapitalMarketTimeframe } from '../../capital-market/timeframes.ts';
import type {
  CapitalMarketBar,
  CapitalMarketObservation,
  CapitalMarketSessionObservation,
  HeliosCryptoSpotMarketState,
} from '../../capital-market/types.ts';
import { resolveCryptoSpotInstrument } from './instrument-registry.ts';

export function buildHeliosCryptoSpotMarketState(input: {
  readonly instrumentId: string;
  readonly quote: CapitalMarketObservation | null;
  readonly session: CapitalMarketSessionObservation | null;
  readonly latestBar: CapitalMarketBar | null;
  readonly barStore?: CapitalMarketBarStore;
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
  const latestBar =
    input.latestBar ??
    (input.barStore ? latestBarForInstrument(input.barStore.list(), input.instrumentId, timeframe) : null);
  const sessionStatus =
    input.session?.sessionStatus ??
    input.quote?.sessionStatus ??
    'UNKNOWN';

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
        ? ('QUOTE_NOTIONAL' as const)
        : input.quote?.volumeUnits
          ? ('QUOTE_NOTIONAL' as const)
          : ('UNKNOWN' as const),
    providerId: input.quote?.providerId ?? input.session?.providerId ?? latestBar?.providerId ?? 'unknown',
    evaluatedAt: input.evaluatedAt,
    executionEnabled: false,
    researchOnly: true,
    dataFreshness: input.staleQuote ? ('STALE' as const) : ('FRESH' as const),
    entitlement: input.quote?.entitlement ?? input.session?.entitlement ?? latestBar?.entitlement ?? {
      entitlementClass: 'unknown',
      feedTier: 'unknown',
      delayedMinutes: null,
      licensedForRealtime: false,
      providerDeclaredRealtime: false,
    },
  });
}
