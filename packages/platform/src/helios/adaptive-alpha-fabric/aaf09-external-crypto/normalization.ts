/**
 * Normalize provider payloads into AAF09 observations.
 */

import { createHash, randomUUID } from 'node:crypto';

import { asUtcInstant, type UtcInstant } from '../../../../../domain/src/time.ts';
import { computeKnowableAt } from '../../observation/information-time.ts';
import type { Aaf09InstrumentDefinition } from './instruments.ts';
import { sourceClassForProvider, sourceFamilyFor, venueIdForKraken } from './taxonomy.ts';
import type { CryptoObservationKind, NormalizedCryptoMarketObservation, SourceHealthState } from './types.ts';
import { HELIOS_AAF09_SCHEMA } from './types.ts';

export const AAF09_PRICE_SCALE = 100;

export function decimalStringToMinorUnits(value: string, scale = AAF09_PRICE_SCALE): bigint {
  const trimmed = value.trim();
  if (!trimmed) return 0n;
  const negative = trimmed.startsWith('-');
  const body = negative ? trimmed.slice(1) : trimmed;
  const [whole, frac = ''] = body.split('.');
  const fracPadded = (frac + '0'.repeat(scale)).slice(0, scale);
  const minor = BigInt(whole || '0') * BigInt(10 ** scale) + BigInt(fracPadded || '0');
  return negative ? -minor : minor;
}

export function computeSpreadMinorUnits(bid: bigint | null, ask: bigint | null): bigint | null {
  if (bid === null || ask === null) return null;
  if (ask <= bid) return 0n;
  return ask - bid;
}

export function hashPayload(payload: unknown): string {
  const body = JSON.stringify(payload);
  return createHash('sha256').update(body).digest('hex');
}

export function krakenSecondsToUtc(seconds: number): UtcInstant {
  return asUtcInstant(new Date(seconds * 1000).toISOString());
}

export function buildNormalizedObservation(input: {
  readonly instrument: Aaf09InstrumentDefinition;
  readonly providerId: string;
  readonly observationKind: CryptoObservationKind;
  readonly providerEventTime: UtcInstant;
  readonly sunreyArrivalTime: UtcInstant;
  readonly sequenceId: string | null;
  readonly sourceHealth: SourceHealthState;
  readonly rawPayload: unknown;
  readonly lastMinorUnits?: bigint | null;
  readonly bidMinorUnits?: bigint | null;
  readonly askMinorUnits?: bigint | null;
  readonly tradePriceMinorUnits?: bigint | null;
  readonly tradeQuantityMinorUnits?: bigint | null;
  readonly volumeMinorUnits?: bigint | null;
  readonly ohlc?: {
    readonly open: bigint;
    readonly high: bigint;
    readonly low: bigint;
    readonly close: bigint;
  } | null;
  readonly barTimeframe?: NormalizedCryptoMarketObservation['barTimeframe'];
  readonly upstreamSourceRef?: string | null;
}): NormalizedCryptoMarketObservation {
  const sourceClass = sourceClassForProvider(input.providerId);
  const venue =
    sourceClass === 'VENUE_MARKET_DATA'
      ? Object.freeze({
          venueId: venueIdForKraken(),
          displayName: 'Kraken',
          mic: null,
        })
      : null;
  const sourceFamily = sourceFamilyFor({
    providerId: input.providerId,
    sourceClass,
    venueId: venue?.venueId ?? null,
  });
  const bid = input.bidMinorUnits ?? null;
  const ask = input.askMinorUnits ?? null;
  const knowableAt = computeKnowableAt({
    providerAvailabilityTime: null,
    sunreyArrivalTime: input.sunreyArrivalTime,
    ingestionTime: input.sunreyArrivalTime,
  });

  return Object.freeze({
    schemaVersion: HELIOS_AAF09_SCHEMA,
    observationId: `aaf09.${randomUUID()}`,
    observationKind: input.observationKind,
    instrumentId: input.instrument.instrumentId,
    baseAsset: input.instrument.baseAsset,
    quoteCurrency: input.instrument.quoteCurrency,
    pairLabel: input.instrument.pairLabel,
    venue,
    providerId: input.providerId,
    sourceClass,
    sourceFamily,
    upstreamSourceRef: input.upstreamSourceRef ?? null,
    priceScale: AAF09_PRICE_SCALE,
    lastMinorUnits: input.lastMinorUnits ?? null,
    bidMinorUnits: bid,
    askMinorUnits: ask,
    spreadMinorUnits: computeSpreadMinorUnits(bid, ask),
    tradePriceMinorUnits: input.tradePriceMinorUnits ?? null,
    tradeQuantityMinorUnits: input.tradeQuantityMinorUnits ?? null,
    volumeMinorUnits: input.volumeMinorUnits ?? null,
    ohlcOpenMinorUnits: input.ohlc?.open ?? null,
    ohlcHighMinorUnits: input.ohlc?.high ?? null,
    ohlcLowMinorUnits: input.ohlc?.low ?? null,
    ohlcCloseMinorUnits: input.ohlc?.close ?? null,
    barTimeframe: input.barTimeframe ?? null,
    sequenceId: input.sequenceId,
    providerEventTime: input.providerEventTime,
    sunreyArrivalTime: input.sunreyArrivalTime,
    knowableAt,
    sourceHealth: input.sourceHealth,
    rawPayloadHash: hashPayload(input.rawPayload),
    grantsExecutionAuthority: false,
  });
}
