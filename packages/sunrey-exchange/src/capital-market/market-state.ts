/**
 * HELIOS equity/index market state generation from provider-backed observations.
 */

import type { UtcInstant } from '@solstice/domain';
import { latestBarForInstrument, type CapitalMarketBarStore } from './bar-store.ts';
import { resolveCapitalMarketInstrument } from './instrument-registry.ts';
import type { CapitalMarketTimeframe } from './timeframes.ts';
import type {
  CapitalMarketObservation,
  CapitalMarketSessionObservation,
  CapitalMarketSessionStatus,
  HeliosEquityIndexMarketState,
} from './types.ts';

export function buildHeliosEquityIndexMarketState(input: {
  readonly instrumentId: string;
  readonly quote: CapitalMarketObservation | null;
  readonly session: CapitalMarketSessionObservation | null;
  readonly barStore: CapitalMarketBarStore;
  readonly barTimeframe?: CapitalMarketTimeframe;
  readonly evaluatedAt: UtcInstant;
}): HeliosEquityIndexMarketState | null {
  const instrument = resolveCapitalMarketInstrument(input.instrumentId);
  if (!instrument) {
    return null;
  }

  const timeframe = input.barTimeframe ?? '15m';
  const latestBar = latestBarForInstrument(input.barStore.list(), input.instrumentId, timeframe);
  const sessionStatus: CapitalMarketSessionStatus =
    input.session?.sessionStatus ??
    input.quote?.sessionStatus ??
    'UNKNOWN';

  const entitlement: HeliosEquityIndexMarketState['entitlement'] =
    input.quote?.entitlement ??
    input.session?.entitlement ??
    latestBar?.entitlement ?? {
      entitlementClass: 'unknown',
      feedTier: 'unknown',
      delayedMinutes: null,
      licensedForRealtime: false,
      providerDeclaredRealtime: false,
    };

  return Object.freeze({
    instrumentId: instrument.instrumentId,
    symbol: instrument.symbol,
    venueId: instrument.venue.venueId,
    sessionStatus,
    lastMinorUnits: input.quote?.lastMinorUnits ?? latestBar?.closeMinorUnits ?? null,
    referenceMinorUnits: input.quote?.lastMinorUnits ?? latestBar?.closeMinorUnits ?? null,
    latestBarCloseMinorUnits: latestBar?.closeMinorUnits ?? null,
    latestBarTimeframe: latestBar?.timeframe ?? null,
    latestBarPeriodStart: latestBar?.periodStart ?? null,
    volumeUnits: latestBar?.volumeUnits ?? input.quote?.volumeUnits ?? null,
    providerId: input.quote?.providerId ?? input.session?.providerId ?? latestBar?.providerId ?? 'unknown',
    evaluatedAt: input.evaluatedAt,
    entitlement,
  }) satisfies HeliosEquityIndexMarketState;
}
