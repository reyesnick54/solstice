/**
 * Shared helpers for H31 resilience scenarios.
 */

import { FrozenClock } from '@solstice/config';
import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import {
  buildExternalObservation,
  MARKET_PRICE_FRESHNESS_POLICY,
  type ExternalObservation,
} from '@solstice/provider-sdk';
import { HeliosObservationFabric, createHeliosObservationStore } from '../observation/index.ts';
import type { ObservationType } from '../observation/types.ts';

export type MarketData = {
  symbol: string;
  priceMinor: bigint;
  currency: string;
  asOf: string;
  sourceProvider: string;
  exchange: string | null;
};

export function marketObservation(
  overrides: {
    observationId?: string;
    providerId?: string;
    sourceTimestamp?: UtcInstant;
    retrievedAt?: UtcInstant;
    priceMinor?: bigint;
    rawPayload?: string;
    commercialUseStatus?: 'permitted' | 'restricted' | 'prohibited' | 'unknown';
    redistributionStatus?: 'permitted' | 'restricted' | 'prohibited' | 'unknown';
    validationStatus?: 'valid' | 'timestamp_invalid' | 'schema_invalid';
  } = {},
): ExternalObservation<MarketData> {
  const built = buildExternalObservation({
    observationId: overrides.observationId ?? `obs_h31_${Math.random().toString(36).slice(2, 10)}`,
    providerId: overrides.providerId ?? 'fixture_market_h31',
    providerCategory: 'markets',
    capability: 'market_prices',
    data: {
      symbol: 'SIM-ETF-1',
      priceMinor: overrides.priceMinor ?? 150_00n,
      currency: 'USD',
      asOf: overrides.sourceTimestamp ?? overrides.retrievedAt ?? asUtcInstant('2026-09-18T08:59:55.000Z'),
      sourceProvider: overrides.providerId ?? 'fixture_market_h31',
      exchange: 'SIM',
    },
    source: { provider: overrides.providerId ?? 'fixture_market_h31', dataset: 'SIM-ETF-1' },
    time: {
      retrievedAt: overrides.retrievedAt ?? asUtcInstant('2026-09-18T09:00:00.000Z'),
      sourceTimestamp: overrides.sourceTimestamp ?? asUtcInstant('2026-09-18T08:59:55.000Z'),
    },
    authorityClass: 'reference_data',
    provenance: {
      rawPayload: overrides.rawPayload ?? JSON.stringify({ priceMinor: String(overrides.priceMinor ?? 150_00n) }),
      providerSchemaVersion: 'test/h31',
    },
    freshnessPolicy: MARKET_PRICE_FRESHNESS_POLICY,
    validationStatus: overrides.validationStatus ?? 'valid',
    ...(overrides.commercialUseStatus !== undefined || overrides.redistributionStatus !== undefined
      ? {
          licensing: {
            ...(overrides.commercialUseStatus !== undefined
              ? { commercialUseStatus: overrides.commercialUseStatus }
              : {}),
            ...(overrides.redistributionStatus !== undefined
              ? { redistributionStatus: overrides.redistributionStatus }
              : {}),
          },
        }
      : {}),
  });
  if (!built.ok) throw new Error('observation build failed');
  return built.value!;
}

export function fabricAt(now: UtcInstant): HeliosObservationFabric {
  const clock = new FrozenClock(now);
  return new HeliosObservationFabric({ clock, store: createHeliosObservationStore() });
}

export function ingestQuote(
  fabric: HeliosObservationFabric,
  observation: ExternalObservation<MarketData>,
  extras: {
    readonly sequence?: number;
    readonly lineage?: { readonly upstreamSourceRef?: string; readonly sourceFamily?: string };
    readonly feedDelayClassification?: 'real_time' | 'delayed' | 'end_of_day' | 'unknown';
    readonly trustResult?: unknown;
  } = {},
) {
  return fabric.ingest({
    observation,
    sourceId: `${observation.providerId}:SIM-ETF-1`,
    canonicalInstrumentId: 'SIM-ETF-1',
    venue: 'SIM',
    observationType: 'quote' as ObservationType,
    ...(extras.sequence !== undefined ? { sequence: extras.sequence } : {}),
    ...(extras.lineage !== undefined ? { lineage: extras.lineage } : {}),
    ...(extras.feedDelayClassification !== undefined
      ? { feedDelayClassification: extras.feedDelayClassification }
      : {}),
    ...(extras.trustResult !== undefined ? { trustResult: extras.trustResult as never } : {}),
  });
}
