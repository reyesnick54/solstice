/**
 * Bridge sealed M02 quotes into AAF02 feature fabric (optional downstream).
 */

import type { UtcInstant } from '@solstice/domain';
import { buildExternalObservation, MARKET_PRICE_FRESHNESS_POLICY } from '@solstice/provider-sdk';
import type { HeliosFeatureFabric } from '../../feature-fabric/fabric.ts';
import { HELIOS_FEATURE_FABRIC_SCHEMA, type FeatureDefinition } from '../../feature-fabric/types.ts';
import { buildInformationTime } from '../../observation/information-time.ts';
import { buildObservationEntitlement } from '../../observation/entitlement.ts';
import { AAF08_FEATURE_IDS } from './types.ts';
import type { MarketQuoteObservation } from '../../market-observation/types.ts';

export const AAF08_LAST_PRICE_DEFINITION: FeatureDefinition = Object.freeze({
  schemaVersion: HELIOS_FEATURE_FABRIC_SCHEMA,
  featureId: AAF08_FEATURE_IDS.LAST_PRICE,
  featureVersion: '1',
  displayName: 'AAF08 last price',
  description: 'Last trade / quote price from external equities observation plane',
  valueKind: 'integer_minor',
  unit: 'USD_MINOR',
  transformationId: 'helios.aaf08.last_price',
  transformationVersion: '1',
  transformationParameters: Object.freeze({}),
  grantsExecutionAuthority: false,
});

export function materializeAaf08LastPriceFeature(
  fabric: HeliosFeatureFabric,
  quote: MarketQuoteObservation,
  computedAt: UtcInstant,
): void {
  if (quote.lastMinorUnits === null) return;
  fabric.registerDefinition(AAF08_LAST_PRICE_DEFINITION);
  const envelope = buildExternalObservation({
    observationId: quote.provenance.observationId,
    providerId: quote.providerId,
    providerCategory: 'markets',
    capability: quote.provenance.capability,
    data: Object.freeze({
      symbol: quote.instrumentId,
      priceMinor: quote.lastMinorUnits,
      currency: quote.currency,
      asOf: quote.sourceTimestamp,
      sourceProvider: quote.providerId,
    }),
    source: {
      provider: quote.providerId,
      dataset: quote.instrumentId,
      sourceUrl: quote.provenance.sourceUrl,
    },
    time: {
      retrievedAt: quote.arrivalTimestamp,
      sourceTimestamp: quote.sourceTimestamp,
      effectiveAt: quote.availabilityTimestamp ?? quote.sourceTimestamp,
    },
    authorityClass: 'reference_data',
    provenance: {
      rawPayload: quote.provenance.rawPayloadHash,
      providerSchemaVersion: quote.schema,
    },
    freshnessPolicy: MARKET_PRICE_FRESHNESS_POLICY,
    validationStatus: 'valid',
    licensing: {
      commercialUseStatus: quote.entitlement.commercialRestricted ? 'restricted' : 'permitted',
      redistributionStatus: quote.entitlement.redistributionRestricted ? 'restricted' : 'permitted',
    },
  });
  if (!envelope.ok) return;
  const observation = envelope.value;
  const informationTime = buildInformationTime({
    observation,
    sourceEventTime: quote.sourceTimestamp,
    providerAvailabilityTime: quote.availabilityTimestamp,
    sunreyArrivalTime: quote.arrivalTimestamp,
    ingestionTime: computedAt,
  });
  const entitlement = buildObservationEntitlement({
    observation,
    entitlementClass: quote.entitlement.entitlementClass,
    feedDelayClassification: quote.entitlement.feedDelayClassification,
  });
  fabric.compute({
    definition: AAF08_LAST_PRICE_DEFINITION,
    canonicalEntityId: quote.instrumentId,
    canonicalInstrumentId: quote.instrumentId,
    eventTime: quote.sourceTimestamp,
    computedAt,
    revisionId: quote.provenance.observationId,
    validFrom: informationTime.knowableAt,
    contributions: Object.freeze([
      Object.freeze({
        observationId: quote.provenance.observationId,
        informationTime,
        entitlement,
        qualityState: quote.quality.qualityState === 'VALID' ? 'VALID' : 'DEGRADED_STALE',
        sourceIndependence: 'INDEPENDENT',
        evidenceRef: null,
        numericValueMinor: quote.lastMinorUnits,
      }),
    ]),
  });
}
