/**
 * External Data Trust normalization for AAF08 equities payloads.
 */

import { createExternalDataTrustEngine } from '../../../../../provider-sdk/src/trust/engine.ts';
import { assessMarketReferenceTrust } from '../../../../../provider-sdk/src/trust/domain-policies.ts';
import type { CanonicalTrustResult } from '../../../../../provider-sdk/src/trust/types.ts';
import { buildExternalObservation, MARKET_PRICE_FRESHNESS_POLICY } from '../../../../../provider-sdk/src/index.ts';
import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { ExternalEquitiesQuotePayload } from './types.ts';

export type Aaf08TrustEngine = ReturnType<typeof createExternalDataTrustEngine>;

export function createAaf08TrustEngine(nowUtc: () => UtcInstant): Aaf08TrustEngine {
  return createExternalDataTrustEngine({ nowUtc });
}

export function assessEquitiesQuoteTrust(
  engine: Aaf08TrustEngine,
  payload: ExternalEquitiesQuotePayload,
): CanonicalTrustResult<{ readonly priceMinor: string; readonly currency: string }> {
  const built = buildExternalObservation({
    observationId: payload.observationId,
    providerId: payload.providerId,
    providerCategory: 'markets',
    capability: payload.capability,
    data: Object.freeze({
      priceMinor: payload.lastMinorUnits?.toString() ?? '0',
      currency: payload.currency,
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
