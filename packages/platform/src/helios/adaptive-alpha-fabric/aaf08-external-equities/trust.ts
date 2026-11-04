/**
 * External Data Trust normalization for AAF08 equities payloads.
 */

import { createExternalDataTrustEngine } from '@solstice/provider-sdk';
import { assessMarketReferenceTrust } from '@solstice/provider-sdk';
import { buildExternalObservation, MARKET_PRICE_FRESHNESS_POLICY } from '@solstice/provider-sdk';
import type { UtcInstant } from '@solstice/domain';
import type { ExternalEquitiesQuotePayload } from './types.ts';

export type Aaf08TrustEngine = ReturnType<typeof createExternalDataTrustEngine>;

export function createAaf08TrustEngine(nowUtc: () => UtcInstant): Aaf08TrustEngine {
  return createExternalDataTrustEngine({ nowUtc });
}

export function assessEquitiesQuoteTrust(
  engine: Aaf08TrustEngine,
  payload: ExternalEquitiesQuotePayload,
) {
  const priceMinor = payload.lastMinorUnits ?? 0n;
  const built = buildExternalObservation({
    observationId: payload.observationId,
    providerId: payload.providerId,
    providerCategory: 'markets',
    capability: payload.capability,
    data: Object.freeze({
      symbol: payload.instrumentId,
      priceMinor,
      currency: payload.currency,
      asOf: payload.sourceTimestamp,
      sourceProvider: payload.providerId,
      exchange: payload.venueId,
    }),
    source: {
      provider: payload.providerId,
      dataset: payload.instrumentId,
      sourceUrl: payload.sourceUrl,
    },
    time: {
      retrievedAt: payload.arrivalTimestamp,
      sourceTimestamp: payload.sourceTimestamp,
      effectiveAt: payload.availabilityTimestamp ?? payload.sourceTimestamp,
    },
    authorityClass: 'reference_data',
    provenance: {
      rawPayload: payload.rawPayloadHash,
      providerSchemaVersion: payload.schemaVersion,
    },
    freshnessPolicy: MARKET_PRICE_FRESHNESS_POLICY,
    validationStatus: 'valid',
    licensing: {
      commercialUseStatus: payload.commercialRestricted ? 'restricted' : 'permitted',
      redistributionStatus: payload.redistributionRestricted ? 'restricted' : 'permitted',
    },
  });
  if (!built.ok) {
    throw new Error(`trust observation build failed: ${built.message}`);
  }
  return assessMarketReferenceTrust(engine, {
    observations: [built.value],
    assetId: payload.instrumentId,
    providerRisk: {},
  });
}
