/**
 * AAF08 — bind Exchange capital-market service to HELIOS ExternalEquitiesProviderPort.
 */

import { ENVIRONMENT } from '../../../config/src/flags.ts';
import type { UtcInstant } from '@solstice/domain';
import type { CapitalMarketService } from '../../../sunrey-exchange/src/capital-market/service.ts';
import { resolveCapitalMarketInstrument } from '../../../sunrey-exchange/src/capital-market/instrument-registry.ts';
import type {
  CapitalMarketBar,
  CapitalMarketObservation,
  CapitalMarketSessionObservation,
} from '../../../sunrey-exchange/src/capital-market/types.ts';
import type { CapitalMarketHistoricalRange } from '../../../sunrey-exchange/src/capital-market/timeframes.ts';
import type {
  ExternalEquitiesBarPayload,
  ExternalEquitiesInstrumentMetadata,
  ExternalEquitiesProviderHealth,
  ExternalEquitiesProviderPort,
  ExternalEquitiesProviderResult,
  ExternalEquitiesQuotePayload,
  ExternalEquitiesSessionPayload,
} from '../../../platform/src/helios/adaptive-alpha-fabric/aaf08-external-equities/provider-port.ts';
import type { BarTimeframe } from '../../../platform/src/helios/market-observation/types.ts';

function feedClassificationFromEntitlement(
  observation: CapitalMarketObservation | CapitalMarketBar,
): 'realtime' | 'delayed' | 'end_of_day' | 'sandbox' | 'unknown' {
  const cls = observation.entitlement.entitlementClass;
  if (cls === 'realtime') return ENVIRONMENT === 'simulation' ? 'sandbox' : 'realtime';
  if (cls === 'delayed') return 'delayed';
  if (cls === 'end_of_day') return 'end_of_day';
  if (cls === 'sandbox' || cls === 'test') return 'sandbox';
  return 'unknown';
}

function mapQuote(observation: CapitalMarketObservation): ExternalEquitiesQuotePayload {
  return Object.freeze({
    schemaVersion: 'sunrey.helios.aaf08.external-equities-observation.v1',
    observationId: observation.provenance.observationId,
    instrumentId: observation.instrument.instrumentId,
    symbol: observation.instrument.symbol,
    venueId: observation.instrument.venue.venueId,
    currency: observation.currency,
    priceScale: observation.priceScale,
    bidMinorUnits: observation.bidMinorUnits,
    askMinorUnits: observation.askMinorUnits,
    lastMinorUnits: observation.lastMinorUnits,
    sessionStatus: observation.sessionStatus,
    providerId: observation.providerId,
    sourceTimestamp: observation.sourceTimestamp,
    arrivalTimestamp: observation.arrivalTimestamp,
    availabilityTimestamp: observation.availabilityTimestamp,
    feedClassification: feedClassificationFromEntitlement(observation),
    delayedMinutes: observation.entitlement.delayedMinutes,
    licensedForRealtime: observation.entitlement.licensedForRealtime,
    redistributionRestricted: true,
    commercialRestricted: observation.entitlement.feedTier === 'free_tier',
    rawPayloadHash: observation.provenance.rawPayloadHash,
    sourceUrl: observation.provenance.sourceUrl,
    capability: observation.provenance.capability,
    upstreamSourceRef: `${observation.providerId}:${observation.instrument.instrumentId}`,
    sequence: observation.sequenceNumber,
    grantsExecutionAuthority: false,
  });
}

function mapBar(bar: CapitalMarketBar): ExternalEquitiesBarPayload {
  return Object.freeze({
    schemaVersion: 'sunrey.helios.aaf08.external-equities-observation.v1',
    observationId: bar.barId,
    instrumentId: bar.instrument.instrumentId,
    timeframe: bar.timeframe,
    openMinorUnits: bar.openMinorUnits,
    highMinorUnits: bar.highMinorUnits,
    lowMinorUnits: bar.lowMinorUnits,
    closeMinorUnits: bar.closeMinorUnits,
    volumeUnits: bar.volumeUnits ?? 0n,
    startTime: bar.periodStart,
    endTime: bar.periodEnd,
    providerId: bar.providerId,
    venueId: bar.instrument.venue.venueId,
    sourceTimestamp: bar.sourceTimestamp,
    arrivalTimestamp: bar.arrivalTimestamp,
    availabilityTimestamp: null,
    feedClassification: feedClassificationFromEntitlement(bar),
    delayedMinutes: bar.entitlement.delayedMinutes,
    rawPayloadHash: bar.provenance.rawPayloadHash,
    sourceUrl: bar.provenance.sourceUrl,
    capability: bar.provenance.capability,
    sequence: null,
    grantsExecutionAuthority: false,
  });
}

function mapSession(observation: CapitalMarketSessionObservation): ExternalEquitiesSessionPayload {
  return Object.freeze({
    schemaVersion: 'sunrey.helios.aaf08.external-equities-observation.v1',
    observationId: observation.provenance.observationId,
    exchange: observation.exchange,
    sessionStatus: observation.sessionStatus,
    isOpen: observation.isOpen,
    providerId: observation.providerId,
    sourceTimestamp: observation.sourceTimestamp,
    arrivalTimestamp: observation.arrivalTimestamp,
    availabilityTimestamp: null,
    rawPayloadHash: observation.provenance.rawPayloadHash,
    grantsExecutionAuthority: false,
  });
}

export function createAaf08CapitalMarketProviderPort(service: CapitalMarketService): ExternalEquitiesProviderPort {
  const providerId = service.provider.providerId;
  return Object.freeze({
    providerId,
    health(nowUtc: UtcInstant): ExternalEquitiesProviderHealth {
      const health = service.provider.health(nowUtc);
      const state =
        !health.credentialConfigured
          ? 'NOT_CONFIGURED'
          : health.status === 'unavailable'
            ? 'OUTAGE'
            : health.rateLimited
              ? 'DEGRADED_RATE_LIMITED'
              : health.status === 'degraded'
                ? 'DEGRADED_STALE'
                : 'HEALTHY';
      return Object.freeze({
        providerId,
        state,
        credentialConfigured: health.credentialConfigured,
        rateLimited: health.rateLimited,
        lastSuccessAt: health.lastSuccessAt,
        message: health.message,
        grantsExecutionAuthority: false,
      });
    },
    getInstrumentMetadata(instrumentId: string): ExternalEquitiesInstrumentMetadata | null {
      const row = resolveCapitalMarketInstrument(instrumentId);
      if (!row) return null;
      return Object.freeze({
        instrumentId: row.instrumentId,
        symbol: row.symbol,
        displayName: row.displayName,
        assetClass: row.assetClass === 'etf' ? 'etf' : row.assetClass === 'index' ? 'index' : 'equity',
        venueId: row.venue.venueId,
        currency: row.currency,
        isin: row.isin,
        figi: row.figi,
        providerNativeId: row.providerNativeId,
        grantsExecutionAuthority: false,
      });
    },
    async fetchQuote(
      instrumentId: string,
      nowUtc: UtcInstant,
    ): Promise<ExternalEquitiesProviderResult<ExternalEquitiesQuotePayload>> {
      const result = await service.getObservation(instrumentId, nowUtc);
      if (!result.ok) {
        return { ok: false, code: result.code, message: result.message };
      }
      return { ok: true, value: mapQuote(result.value) };
    },
    async fetchHistoricalBars(
      instrumentId: string,
      timeframe: BarTimeframe,
      range: CapitalMarketHistoricalRange,
      nowUtc: UtcInstant,
    ): Promise<ExternalEquitiesProviderResult<readonly ExternalEquitiesBarPayload[]>> {
      const result = await service.getHistoricalBars(instrumentId, timeframe, range, nowUtc);
      if (!result.ok) {
        return { ok: false, code: result.code, message: result.message };
      }
      return { ok: true, value: Object.freeze(result.value.map(mapBar)) };
    },
    async fetchMarketSession(
      exchange: string,
      nowUtc: UtcInstant,
    ): Promise<ExternalEquitiesProviderResult<ExternalEquitiesSessionPayload>> {
      const result = await service.getMarketStatus(exchange, nowUtc);
      if (!result.ok) {
        return { ok: false, code: result.code, message: result.message };
      }
      return { ok: true, value: mapSession(result.value) };
    },
  });
}
