import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import type { FeedSchemaDefinition } from '../../types.ts';
import {
  emptyEvidenceStates,
  healthyConnector,
  runCertificationSuite,
  type CertificationSubject,
  type SandboxObservation,
} from '../../certification/index.ts';
import { identifySpaceUseEvents, ingestRealEstateRecord, ingestRealEstateRecords, refuseDuplicateBuildingUsage } from './adapter.ts';
import { accessControlRecord, bookingSystemRecord, realEstateRecord } from './fixtures.ts';
import { REAL_ESTATE_FEED_SCHEMAS, REAL_ESTATE_SCHEMA_IDS } from './schemas.ts';
import {
  REAL_ESTATE_CERTIFICATION_AUTHORIZES_MOONREY,
  defaultRealEstateFabricPolicy,
  type RealEstateRefusal,
  type RealEstateSourceClass,
} from './types.ts';

export const REAL_ESTATE_SANDBOX_FEEDS = [
  'valid_real_estate_capacity',
  'valid_realized_area_time',
  'valid_vacant_property',
  'valid_independent_utilization',
] as const;
export type RealEstateSandboxFeed = (typeof REAL_ESTATE_SANDBOX_FEEDS)[number];

export const REAL_ESTATE_ADVERSARIAL_SCENARIOS = [
  'CAPACITY_AS_USAGE',
  'LISTING_AS_PRODUCTIVITY',
  'OWNERSHIP_AS_USAGE',
  'M2_AS_M2_HOUR_WITHOUT_DURATION',
  'PERSON_LEVEL_ACCESS_LOG',
  'SAME_CONTROLLER_FAKE_QUORUM',
  'DUPLICATE_BUILDING_USAGE',
  'FLOAT_DURATION',
  'SCHEMA_DRIFT',
  'WRONG_UNIT',
  'STALE_UTILIZATION',
] as const;
export type RealEstateAdversarialScenario = (typeof REAL_ESTATE_ADVERSARIAL_SCENARIOS)[number];

const NOW = 1_700_000_000n;

const FEED_CLASS: Readonly<Record<RealEstateSandboxFeed, RealEstateSourceClass>> = Object.freeze({
  valid_real_estate_capacity: 'WAREHOUSE_SPACE_REFERENCE',
  valid_realized_area_time: 'COMMERCIAL_SPACE_METER',
  valid_vacant_property: 'LEASE_ADMINISTRATION_REFERENCE',
  valid_independent_utilization: 'INDEPENDENT_OCCUPANCY_ATTESTATION',
});

export function realEstateSandboxSubject(feed: RealEstateSandboxFeed, nowUnix = NOW): CertificationSubject {
  const sourceClass = FEED_CLASS[feed];
  const schema = REAL_ESTATE_FEED_SCHEMAS[sourceClass];
  const usage = feed === 'valid_realized_area_time' || feed === 'valid_independent_utilization';
  const observation: SandboxObservation = Object.freeze({
    identifier: `sandbox_${feed}`,
    numericValue: usage ? '400' : '100',
    unit: usage ? 'm2_hour' : 'm2',
    sourceTimestampUnix: nowUnix.toString(),
    collectionTimestampUnix: nowUnix.toString(),
    sourceObservationId: `obs_${feed}`,
    schemaId: schema.schemaId,
    schemaVersion: 1,
    contentType: 'application/json',
    responseBytes: 256,
    extras: Object.freeze({ sourceClass, fabric: 'real-estate', durationSeconds: '14400' }),
    timestampSemantic: 'SOURCE_EVENT',
  });
  return Object.freeze({
    providerId: `sandbox_real_estate_${feed}`,
    sourceId: `src_real_estate_${feed}`,
    feedId: `feed_real_estate_${feed}`,
    sourceCategory: 'real_estate_use',
    factType: usage ? 'REAL_ESTATE_USAGE' : 'REAL_ESTATE_USE_CAPACITY',
    productiveCategory: 'REAL_ESTATE_USE',
    claimType: usage ? 'USAGE' : 'CAPACITY',
    schemaId: schema.schemaId,
    schemaVersion: 1,
    unit: usage ? 'm2_hour' : 'm2',
    normalizationVersion: 'sunrey.economic-unit.normalization.v1',
    mappingVersion: 1,
    connectorRuntimeVersion: 'sunrey.economic-data-connector.v1',
    controllerId: `controller_real_estate_${feed}`,
    upstreamOrganizationId: `org_real_estate_${feed}`,
    sharedControlGroup: null,
    relatedFeeds: Object.freeze([]),
    connector: healthyConnector(),
    observations: Object.freeze([observation]),
    evidence: emptyEvidenceStates(),
    prior: null,
    nowUnix,
    createdAtUnix: nowUnix,
  });
}

export function realEstateSandboxSchema(feed: RealEstateSandboxFeed): FeedSchemaDefinition {
  return REAL_ESTATE_FEED_SCHEMAS[FEED_CLASS[feed]];
}

export function certifyRealEstateSandbox(feed: RealEstateSandboxFeed, nowUnix = NOW) {
  return runCertificationSuite(realEstateSandboxSubject(feed, nowUnix), realEstateSandboxSchema(feed));
}

export function evaluateRealEstateAdversary(
  scenario: RealEstateAdversarialScenario,
  nowUnix = NOW,
): Result<{ readonly blocked: true }, RealEstateRefusal> {
  const policy = defaultRealEstateFabricPolicy();
  const occupied = realEstateRecord({ nowUnix });
  switch (scenario) {
    case 'CAPACITY_AS_USAGE':
      return fail(ingestRealEstateRecord(
        realEstateRecord({
          sourceClass: 'WAREHOUSE_SPACE_REFERENCE',
          factType: 'REAL_ESTATE_USAGE',
          usageState: 'OCCUPIED',
          unit: 'm2_hour',
          numericValue: '400',
          schemaId: REAL_ESTATE_SCHEMA_IDS.WAREHOUSE_SPACE_REFERENCE,
          nowUnix,
        }),
        nowUnix,
        policy,
      ));
    case 'LISTING_AS_PRODUCTIVITY':
      return fail(ingestRealEstateRecord(realEstateRecord({ usageState: 'LISTED', nowUnix }), nowUnix, policy));
    case 'OWNERSHIP_AS_USAGE':
      return fail(ingestRealEstateRecord(realEstateRecord({ usageState: 'OWNED_ONLY', nowUnix }), nowUnix, policy));
    case 'M2_AS_M2_HOUR_WITHOUT_DURATION':
      return fail(ingestRealEstateRecord(
        realEstateRecord({ unit: 'm2', numericValue: '100', factType: 'REAL_ESTATE_USAGE', nowUnix }),
        nowUnix,
        policy,
      ));
    case 'PERSON_LEVEL_ACCESS_LOG':
      return fail(ingestRealEstateRecord(
        realEstateRecord({ extras: { tenantName: 'A. Tenant', roomAccessLog: 'badge-77' }, nowUnix }),
        nowUnix,
        policy,
      ));
    case 'SAME_CONTROLLER_FAKE_QUORUM':
      return fail(ingestRealEstateRecord(
        realEstateRecord({
          sourceClass: 'INDEPENDENT_OCCUPANCY_ATTESTATION',
          schemaId: REAL_ESTATE_SCHEMA_IDS.INDEPENDENT_OCCUPANCY_ATTESTATION,
          controllerId: 'building-controller',
          upstreamOrganizationId: 'manager-org',
          nowUnix,
        }),
        nowUnix,
        policy,
        [occupied],
      ));
    case 'DUPLICATE_BUILDING_USAGE': {
      const batch = ingestRealEstateRecords(
        [bookingSystemRecord(nowUnix), accessControlRecord(nowUnix)],
        nowUnix,
        policy,
      );
      if (!batch.ok) {
        return fail(batch);
      }
      const events = identifySpaceUseEvents(batch.value.map((row) => row.observation));
      if (!events.ok) {
        return fail(events);
      }
      return fail(refuseDuplicateBuildingUsage(events.value, batch.value.length));
    }
    case 'FLOAT_DURATION':
      return fail(ingestRealEstateRecord(
        realEstateRecord({ measurementEndUnix: '1700003600.5', nowUnix }),
        nowUnix,
        policy,
      ));
    case 'SCHEMA_DRIFT':
      return fail(ingestRealEstateRecord(realEstateRecord({ schemaId: 'real-estate.changed', nowUnix }), nowUnix, policy));
    case 'WRONG_UNIT':
      return fail(ingestRealEstateRecord(realEstateRecord({ unit: 'machine_h', nowUnix }), nowUnix, policy));
    case 'STALE_UTILIZATION':
      return fail(ingestRealEstateRecord(
        realEstateRecord({ sourceTimestampUnix: (nowUnix - 200_000n).toString(), nowUnix }),
        nowUnix,
        { ...policy, maximumObservationAgeSeconds: 86_400 },
      ));
    default:
      return err({ code: 'UNKNOWN_SOURCE_CLASS', detail: `unknown adversarial scenario ${scenario}` });
  }
}

function fail<T>(result: Result<T, RealEstateRefusal>): Result<{ readonly blocked: true }, RealEstateRefusal> {
  if (!result.ok) {
    return ok(Object.freeze({ blocked: true as const }));
  }
  return err({
    code: 'AUTO_MINT_FORBIDDEN',
    detail: 'adversarial real-estate scenario was unexpectedly accepted',
  });
}

export function realEstateCertificationCannotAuthorizeMoonRey(): false {
  return REAL_ESTATE_CERTIFICATION_AUTHORIZES_MOONREY;
}

export function realEstateCertificationDigest(feed: RealEstateSandboxFeed): string {
  return createHash('sha256').update(`real-estate-sandbox:${feed}`).digest('hex');
}
