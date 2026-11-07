import { asUtcInstant } from '@solstice/domain';
import type {
  AlternativeDataObservationInput,
  AlternativeDataSeries,
  AlternativeDataSourceManifest,
} from './types.ts';
import { HELIOS_ALT01_ALTERNATIVE_DATA_INTELLIGENCE_SCHEMA } from './taxonomy.ts';

const baseEntitlement = Object.freeze({
  entitlementRef: 'ent.alt01.fixture.open',
  entitlementClass: 'sandbox_test' as const,
  licenseClass: 'OPEN' as const,
  commercialUseStatus: 'permitted' as const,
});

const baseGeo = Object.freeze({
  regionCodes: Object.freeze(['US']),
  coverageKind: 'MARKET' as const,
  confidence: 0.9,
});

export function wave6WorkforceManifestFixture(): AlternativeDataSourceManifest {
  return Object.freeze({
    schema: HELIOS_ALT01_ALTERNATIVE_DATA_INTELLIGENCE_SCHEMA,
    manifestId: 'manifest.wave6.jobs.fixture',
    providerId: 'wave6-arbeitnow-jobs',
    providerSurface: 'MARKET_REFERENCE',
    signalFamilies: Object.freeze(['WORKFORCE']),
    sourceRef: 'config/providers/wave6-opportunity-skills-catalog-entries.yaml',
    catalogEntryRef: 'arbeitnow-jobs',
    entitlement: baseEntitlement,
    geographicCoverage: baseGeo,
    grantsExecutionAuthority: false,
  });
}

export function wave5GeospatialSeriesFixture(): AlternativeDataSeries {
  return Object.freeze({
    seriesId: 'series.wave5.geospatial.activity',
    signalFamily: 'GEOSPATIAL',
    providerId: 'wave5-geospatial-reference',
    manifestId: 'manifest.wave5.geospatial.fixture',
    entityLink: Object.freeze({
      canonicalEntityId: 'entity.issuer.fixture.001',
      canonicalInstrumentId: 'instrument.equity.fixture.001',
      providerEntityRef: 'FIG:ACME',
      entityLinkConfidence: 0.82,
      resolutionRef: 'aaf03.resolution.fixture.001',
    }),
    unit: 'activity_index',
    revisionChainId: 'chain.geospatial.fixture',
    grantsExecutionAuthority: false,
  });
}

export function workforceObservationInitialFixture(): AlternativeDataObservationInput {
  return Object.freeze({
    observationId: 'obs.workforce.initial',
    seriesId: 'series.wave6.workforce.postings',
    signalFamily: 'WORKFORCE',
    eventTime: asUtcInstant('2026-02-01T00:00:00.000Z'),
    sourcePublishedAt: asUtcInstant('2026-02-02T08:00:00.000Z'),
    providerAvailableAt: asUtcInstant('2026-02-02T08:00:00.000Z'),
    sunreyArrivalTime: asUtcInstant('2026-02-02T09:15:00.000Z'),
    knowableAt: asUtcInstant('2026-02-02T09:15:00.000Z'),
    revisionId: 'rev.workforce.v0',
    sourceRef: 'fixture://wave6/jobs/initial',
    providerId: 'wave6-arbeitnow-jobs',
    licenseClass: 'OPEN',
    entitlementRef: baseEntitlement.entitlementRef,
    entityLink: Object.freeze({
      canonicalEntityId: 'entity.issuer.fixture.001',
      canonicalInstrumentId: 'instrument.equity.fixture.001',
      providerEntityRef: 'FIG:ACME',
      entityLinkConfidence: 0.82,
      resolutionRef: 'aaf03.resolution.fixture.001',
    }),
    geographicCoverage: baseGeo,
    qualityState: 'VALID',
    valueMinor: 1_250n,
    valueText: null,
  });
}

export function workforceObservationFollowOnFixture(): AlternativeDataObservationInput {
  return Object.freeze({
    ...workforceObservationInitialFixture(),
    observationId: 'obs.workforce.followon',
    knowableAt: asUtcInstant('2026-03-02T10:00:00.000Z'),
    sunreyArrivalTime: asUtcInstant('2026-03-02T10:00:00.000Z'),
    providerAvailableAt: asUtcInstant('2026-03-02T09:00:00.000Z'),
    eventTime: asUtcInstant('2026-03-01T00:00:00.000Z'),
    revisionId: 'rev.workforce.v1',
    valueMinor: 1_400n,
  });
}

/** Provider backfill: event predates availability but knowableAt incorrectly equals event time. */
export function illegalBackfillObservationFixture(): AlternativeDataObservationInput {
  return Object.freeze({
    ...workforceObservationInitialFixture(),
    observationId: 'obs.workforce.backfill.illegal',
    eventTime: asUtcInstant('2025-06-01T00:00:00.000Z'),
    providerAvailableAt: asUtcInstant('2026-04-01T12:00:00.000Z'),
    sunreyArrivalTime: asUtcInstant('2026-04-01T12:30:00.000Z'),
    knowableAt: asUtcInstant('2025-06-01T00:00:00.000Z'),
    revisionId: 'rev.workforce.backfill',
  });
}

export function delayedProviderObservationFixture(): AlternativeDataObservationInput {
  return Object.freeze({
    observationId: 'obs.geospatial.delayed',
    seriesId: 'series.wave5.geospatial.activity',
    signalFamily: 'GEOSPATIAL',
    eventTime: asUtcInstant('2026-01-15T00:00:00.000Z'),
    sourcePublishedAt: asUtcInstant('2026-01-16T06:00:00.000Z'),
    providerAvailableAt: asUtcInstant('2026-01-20T14:00:00.000Z'),
    sunreyArrivalTime: asUtcInstant('2026-01-20T14:05:00.000Z'),
    knowableAt: asUtcInstant('2026-01-20T14:05:00.000Z'),
    revisionId: 'rev.geospatial.v0',
    sourceRef: 'fixture://wave5/geospatial/delayed',
    providerId: 'wave5-geospatial-reference',
    licenseClass: 'GOVERNMENT_OFFICIAL',
    entitlementRef: baseEntitlement.entitlementRef,
    entityLink: wave5GeospatialSeriesFixture().entityLink,
    geographicCoverage: Object.freeze({
      regionCodes: Object.freeze(['US-CA']),
      coverageKind: 'REGIONAL',
      confidence: 0.75,
    }),
    qualityState: 'VALID',
    valueMinor: 88_000n,
    valueText: null,
  });
}
