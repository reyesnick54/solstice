/**
 * Map provider-neutral AAF08 payloads into M02 canonical market observations.
 */

import type {
  MarketEntitlementMetadata,
  MarketProvenance,
  MarketQuoteObservation,
  MarketStatusObservation,
  OhlcvBar,
} from '../../market-observation/types.ts';
import { HELIOS_MARKET_TIME_SERIES_SCHEMA, HELIOS_MARKET_TIME_SERIES_AUTHORITY } from '../../market-observation/types.ts';
import type {
  EquitiesFeedClassification,
  ExternalEquitiesBarPayload,
  ExternalEquitiesQuotePayload,
  ExternalEquitiesSessionPayload,
} from './types.ts';

function entitlementFromFeed(input: {
  readonly feedClassification: EquitiesFeedClassification;
  readonly delayedMinutes: number | null;
  readonly licensedForRealtime: boolean;
  readonly redistributionRestricted: boolean;
  readonly commercialRestricted: boolean;
}): MarketEntitlementMetadata {
  const entitlementClass =
    input.feedClassification === 'realtime'
      ? 'provider_feed_realtime'
      : input.feedClassification === 'delayed'
        ? 'provider_feed_delayed'
        : input.feedClassification === 'end_of_day'
          ? 'provider_feed_eod'
          : input.feedClassification === 'sandbox'
            ? 'sandbox_test'
            : 'unknown';

  const feedDelayClassification =
    input.feedClassification === 'realtime'
      ? 'real_time'
      : input.feedClassification === 'delayed'
        ? 'delayed'
        : input.feedClassification === 'end_of_day'
          ? 'end_of_day'
          : 'unknown';

  return Object.freeze({
    entitlementClass,
    feedDelayClassification,
    delayedMinutes: input.delayedMinutes,
    licensedForRealtime: input.licensedForRealtime,
    redistributionRestricted: input.redistributionRestricted,
    commercialRestricted: input.commercialRestricted,
    unavailable: false,
  });
}

function provenanceFromQuote(payload: ExternalEquitiesQuotePayload): MarketProvenance {
  return Object.freeze({
    providerId: payload.providerId,
    sourceId: `${payload.providerId}:${payload.instrumentId}`,
    authorityClass: 'reference_data',
    sourceUrl: payload.sourceUrl,
    rawPayloadHash: payload.rawPayloadHash,
    observationId: payload.observationId,
    capability: payload.capability,
    upstreamSourceRef: payload.upstreamSourceRef,
  });
}

export function toMarketQuoteObservation(payload: ExternalEquitiesQuotePayload): MarketQuoteObservation {
  return Object.freeze({
    schema: HELIOS_MARKET_TIME_SERIES_SCHEMA,
    authority: HELIOS_MARKET_TIME_SERIES_AUTHORITY,
    observationType: 'quote',
    instrumentId: payload.instrumentId,
    bidMinorUnits: payload.bidMinorUnits,
    askMinorUnits: payload.askMinorUnits,
    lastMinorUnits: payload.lastMinorUnits,
    priceScale: payload.priceScale,
    currency: payload.currency,
    sourceTimestamp: payload.sourceTimestamp,
    arrivalTimestamp: payload.arrivalTimestamp,
    availabilityTimestamp: payload.availabilityTimestamp,
    providerId: payload.providerId,
    venue: payload.venueId,
    entitlement: entitlementFromFeed({
      feedClassification: payload.feedClassification,
      delayedMinutes: payload.delayedMinutes,
      licensedForRealtime: payload.licensedForRealtime,
      redistributionRestricted: payload.redistributionRestricted,
      commercialRestricted: payload.commercialRestricted,
    }),
    provenance: provenanceFromQuote(payload),
    quality: Object.freeze({
      qualityState: 'VALID',
      staleState: 'FRESH',
      quarantined: false,
      quarantineReason: null,
    }),
    sequence: payload.sequence,
  });
}

export function toOhlcvBar(payload: ExternalEquitiesBarPayload): OhlcvBar {
  return Object.freeze({
    schema: HELIOS_MARKET_TIME_SERIES_SCHEMA,
    authority: HELIOS_MARKET_TIME_SERIES_AUTHORITY,
    observationType: 'ohlcv_bar',
    instrumentId: payload.instrumentId,
    timeframe: payload.timeframe,
    openMinorUnits: payload.openMinorUnits,
    highMinorUnits: payload.highMinorUnits,
    lowMinorUnits: payload.lowMinorUnits,
    closeMinorUnits: payload.closeMinorUnits,
    volumeUnits: payload.volumeUnits,
    startTime: payload.startTime,
    endTime: payload.endTime,
    sourceTimestamp: payload.sourceTimestamp,
    arrivalTimestamp: payload.arrivalTimestamp,
    availabilityTimestamp: payload.availabilityTimestamp,
    providerId: payload.providerId,
    venue: payload.venueId,
    entitlement: entitlementFromFeed({
      feedClassification: payload.feedClassification,
      delayedMinutes: payload.delayedMinutes,
      licensedForRealtime: false,
      redistributionRestricted: true,
      commercialRestricted: true,
    }),
    provenance: Object.freeze({
      providerId: payload.providerId,
      sourceId: `${payload.providerId}:${payload.instrumentId}:${payload.timeframe}`,
      authorityClass: 'reference_data',
      sourceUrl: payload.sourceUrl,
      rawPayloadHash: payload.rawPayloadHash,
      observationId: payload.observationId,
      capability: payload.capability,
      upstreamSourceRef: `${payload.providerId}:${payload.instrumentId}`,
    }),
    quality: Object.freeze({
      qualityState: 'VALID',
      staleState: 'FRESH',
      quarantined: false,
      quarantineReason: null,
    }),
    sequence: payload.sequence,
  });
}

export function toMarketStatusObservation(
  payload: ExternalEquitiesSessionPayload,
  instrumentId: string,
): MarketStatusObservation {
  return Object.freeze({
    schema: HELIOS_MARKET_TIME_SERIES_SCHEMA,
    authority: HELIOS_MARKET_TIME_SERIES_AUTHORITY,
    observationType: 'market_status',
    instrumentId,
    sessionStatus: payload.sessionStatus,
    sourceTimestamp: payload.sourceTimestamp,
    arrivalTimestamp: payload.arrivalTimestamp,
    availabilityTimestamp: payload.availabilityTimestamp,
    providerId: payload.providerId,
    venue: payload.exchange,
    entitlement: entitlementFromFeed({
      feedClassification: 'sandbox',
      delayedMinutes: null,
      licensedForRealtime: false,
      redistributionRestricted: false,
      commercialRestricted: false,
    }),
    provenance: Object.freeze({
      providerId: payload.providerId,
      sourceId: `${payload.providerId}:market_status:${payload.exchange}`,
      authorityClass: 'reference_data',
      sourceUrl: null,
      rawPayloadHash: payload.rawPayloadHash,
      observationId: payload.observationId,
      capability: 'equity_session_status',
      upstreamSourceRef: payload.exchange,
    }),
    quality: Object.freeze({
      qualityState: 'VALID',
      staleState: 'FRESH',
      quarantined: false,
      quarantineReason: null,
    }),
  });
}

export function detectMislabeledRealtimeFeed(input: {
  readonly declaredRealtime: boolean;
  readonly delayedMinutes: number | null;
  readonly sourceAgeMs: number;
  readonly staleThresholdMs: number;
}): boolean {
  if (!input.declaredRealtime) return false;
  if (input.delayedMinutes !== null && input.delayedMinutes > 0) return true;
  return input.sourceAgeMs > input.staleThresholdMs;
}
