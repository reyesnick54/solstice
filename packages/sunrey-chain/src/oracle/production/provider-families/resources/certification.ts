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
import type { ResourceSourceClass } from './types.ts';
import { RESOURCE_CERTIFICATION_AUTHORIZES_MOONREY, type ResourceRefusal } from './types.ts';
import { RESOURCE_FEED_SCHEMAS, RESOURCE_SCHEMA_IDS } from './schemas.ts';
import { ingestResourceRecord, identifyExtractionEvents } from './adapter.ts';
import { refuseDuplicateExtractionMass } from './extraction.ts';
import { defaultResourceFabricPolicy } from './types.ts';
import { haulTelemetryRecord, resourceRecord, weighbridgeRecord } from './fixtures.ts';

export const RESOURCE_SANDBOX_FEEDS = [
  'valid_extracted_tonnage',
  'valid_weighbridge',
  'valid_reserve_reference',
  'valid_stockpile',
  'valid_assay_attestation',
] as const;
export type ResourceSandboxFeed = (typeof RESOURCE_SANDBOX_FEEDS)[number];

export const RESOURCE_ADVERSARIAL_SCENARIOS = [
  'RESERVE_AS_EXTRACTION',
  'TRUCK_SCALE_DOUBLE_COUNT',
  'STOCKPILE_AS_EXTRACTION',
  'KG_TONNE_MISMATCH',
  'VOLUME_AS_MASS_WITHOUT_DENSITY',
  'ASSAY_GRADE_AS_MASS',
  'NEGATIVE_EXTRACTION',
  'COUNTER_RESET',
  'SAME_CONTROLLER_FAKE_QUORUM',
  'COMMODITY_PRICE_AS_EXTRACTION',
  'MISSING_RIGHTS',
  'SCHEMA_DRIFT',
  'FLOAT_QUANTITY',
  'STALE_SURVEY',
] as const;
export type ResourceAdversarialScenario = (typeof RESOURCE_ADVERSARIAL_SCENARIOS)[number];

const NOW = 1_700_000_000n;

const FEED_CLASS: Readonly<Record<ResourceSandboxFeed, ResourceSourceClass>> = Object.freeze({
  valid_extracted_tonnage: 'MINE_PRODUCTION_SYSTEM',
  valid_weighbridge: 'WEIGHBRIDGE',
  valid_reserve_reference: 'RESERVE_REPORT_REFERENCE',
  valid_stockpile: 'INVENTORY_STOCKPILE_SYSTEM',
  valid_assay_attestation: 'ASSAY_LAB_ATTESTATION',
});

export function resourceSandboxSubject(feed: ResourceSandboxFeed, nowUnix = NOW): CertificationSubject {
  const sourceClass = FEED_CLASS[feed];
  const schema = RESOURCE_FEED_SCHEMAS[sourceClass];
  const factType =
    sourceClass === 'RESERVE_REPORT_REFERENCE'
      ? 'RESOURCE_RESERVE'
      : sourceClass === 'ASSAY_LAB_ATTESTATION'
        ? 'RESOURCE_EXTRACTION'
        : 'RESOURCE_EXTRACTION';
  const claimType =
    factType === 'RESOURCE_RESERVE'
      ? 'RESERVE'
      : sourceClass === 'INVENTORY_STOCKPILE_SYSTEM' || sourceClass === 'ASSAY_LAB_ATTESTATION'
        ? null
        : 'OUTPUT';
  const observation: SandboxObservation = Object.freeze({
    identifier: `sandbox_${feed}`,
    numericValue: '1000',
    unit: 'tonne',
    sourceTimestampUnix: nowUnix.toString(),
    collectionTimestampUnix: nowUnix.toString(),
    sourceObservationId: `obs_${feed}`,
    schemaId: schema.schemaId,
    schemaVersion: 1,
    contentType: 'application/json',
    responseBytes: 256,
    extras: Object.freeze({ sourceClass, fabric: 'resources' }),
    timestampSemantic: 'SOURCE_EVENT',
  });
  return Object.freeze({
    providerId: `sandbox_resource_${feed}`,
    sourceId: `src_resource_${feed}`,
    feedId: `feed_resource_${feed}`,
    sourceCategory: 'resources',
    factType,
    productiveCategory: 'MINERALS_RAW_MATERIALS',
    claimType,
    schemaId: schema.schemaId,
    schemaVersion: 1,
    unit: 'tonne',
    normalizationVersion: 'sunrey.economic-unit.normalization.v1',
    mappingVersion: 1,
    connectorRuntimeVersion: 'sunrey.economic-data-connector.v1',
    controllerId: `controller_resource_${feed}`,
    upstreamOrganizationId: `org_resource_${feed}`,
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

export function resourceSandboxSchema(feed: ResourceSandboxFeed): FeedSchemaDefinition {
  return RESOURCE_FEED_SCHEMAS[FEED_CLASS[feed]];
}

export function certifyResourceSandbox(feed: ResourceSandboxFeed, nowUnix = NOW) {
  const subject = resourceSandboxSubject(feed, nowUnix);
  return runCertificationSuite(subject, resourceSandboxSchema(feed));
}

export function evaluateResourceAdversary(
  scenario: ResourceAdversarialScenario,
  nowUnix = NOW,
): Result<never, ResourceRefusal> | Result<{ readonly blocked: true }, ResourceRefusal> {
  const policy = defaultResourceFabricPolicy();
  const mine = resourceRecord({ sourceClass: 'MINE_PRODUCTION_SYSTEM', nowUnix });
  switch (scenario) {
    case 'RESERVE_AS_EXTRACTION':
      return fail(ingestResourceRecord(
        resourceRecord({
          sourceClass: 'RESERVE_REPORT_REFERENCE',
          factType: 'RESOURCE_EXTRACTION',
          measurementSemantics: 'GROSS_EXTRACTED_MASS',
          schemaId: RESOURCE_SCHEMA_IDS.RESERVE_REPORT_REFERENCE,
          nowUnix,
        }),
        nowUnix,
        policy,
      ));
    case 'TRUCK_SCALE_DOUBLE_COUNT': {
      const truck = ingestResourceRecord(haulTelemetryRecord(nowUnix), nowUnix, policy);
      const scale = ingestResourceRecord(weighbridgeRecord(nowUnix), nowUnix, policy);
      if (!truck.ok) {
        return truck;
      }
      if (!scale.ok) {
        return scale;
      }
      const events = identifyExtractionEvents(
        [truck.value.observation, scale.value.observation],
        nowUnix,
        nowUnix + 3_600n,
      );
      if (!events.ok) {
        return events;
      }
      return fail(refuseDuplicateExtractionMass(events.value, 2));
    }
    case 'STOCKPILE_AS_EXTRACTION':
      return fail(ingestResourceRecord(
        resourceRecord({
          sourceClass: 'INVENTORY_STOCKPILE_SYSTEM',
          measurementSemantics: 'GROSS_EXTRACTED_MASS',
          nowUnix,
        }),
        nowUnix,
        policy,
      ));
    case 'KG_TONNE_MISMATCH':
      return fail(ingestResourceRecord(
        resourceRecord({ unit: 'kWh', nowUnix }),
        nowUnix,
        policy,
      ));
    case 'VOLUME_AS_MASS_WITHOUT_DENSITY':
      return fail(ingestResourceRecord(
        resourceRecord({ unit: 'm3', densityEvidence: null, nowUnix }),
        nowUnix,
        policy,
      ));
    case 'ASSAY_GRADE_AS_MASS':
      return fail(ingestResourceRecord(
        resourceRecord({
          sourceClass: 'ASSAY_LAB_ATTESTATION',
          measurementSemantics: 'ASSAY_GRADE_QUALITY',
          schemaId: RESOURCE_SCHEMA_IDS.ASSAY_LAB_ATTESTATION,
          nowUnix,
        }),
        nowUnix,
        policy,
      ));
    case 'NEGATIVE_EXTRACTION':
      return fail(ingestResourceRecord(resourceRecord({ numericValue: '-40', nowUnix }), nowUnix, policy));
    case 'COUNTER_RESET':
      return fail(ingestResourceRecord(
        resourceRecord({ priorCumulativeMantissa: 5_000n, numericValue: '10', documentedMeterReset: false, nowUnix }),
        nowUnix,
        policy,
      ));
    case 'SAME_CONTROLLER_FAKE_QUORUM':
      return fail(ingestResourceRecord(
        resourceRecord({
          sourceClass: 'INDEPENDENT_AUDITOR_ATTESTATION',
          schemaId: RESOURCE_SCHEMA_IDS.INDEPENDENT_AUDITOR_ATTESTATION,
          controllerId: 'mine-controller',
          upstreamOrganizationId: 'mine-org',
          nowUnix,
        }),
        nowUnix,
        policy,
        [mine],
      ));
    case 'COMMODITY_PRICE_AS_EXTRACTION':
      return fail(ingestResourceRecord(
        resourceRecord({ factType: 'REFERENCE_PRICE', nowUnix }),
        nowUnix,
        policy,
      ));
    case 'MISSING_RIGHTS':
      return fail(ingestResourceRecord(resourceRecord({ rightsReferences: [], nowUnix }), nowUnix, policy));
    case 'SCHEMA_DRIFT':
      return fail(ingestResourceRecord(resourceRecord({ schemaId: 'minerals.extraction.changed', nowUnix }), nowUnix, policy));
    case 'FLOAT_QUANTITY':
      return fail(ingestResourceRecord(resourceRecord({ numericValue: '12.5', nowUnix }), nowUnix, policy));
    case 'STALE_SURVEY':
      return fail(ingestResourceRecord(
        resourceRecord({
          sourceClass: 'RESOURCE_SURVEY',
          factType: 'RESOURCE_RESERVE',
          measurementSemantics: 'RESERVE_ESTIMATE_MASS',
          schemaId: RESOURCE_SCHEMA_IDS.RESOURCE_SURVEY,
          effectiveDateUnix: nowUnix - 40_000_000n,
          nowUnix,
        }),
        nowUnix,
        policy,
      ));
    default:
      return err({ code: 'UNKNOWN_SOURCE_CLASS', detail: `unknown adversarial scenario ${scenario}` });
  }
}

function fail<T>(result: Result<T, ResourceRefusal>): Result<{ readonly blocked: true }, ResourceRefusal> {
  if (!result.ok) {
    return ok(Object.freeze({ blocked: true as const }));
  }
  return err({
    code: 'AUTO_MINT_FORBIDDEN',
    detail: 'adversarial resource scenario was unexpectedly accepted',
  });
}

export function resourceCertificationCannotAuthorizeMoonRey(): false {
  return RESOURCE_CERTIFICATION_AUTHORIZES_MOONREY;
}

export function resourceCertificationDigest(feed: ResourceSandboxFeed): string {
  return createHash('sha256').update(`resource-sandbox:${feed}`).digest('hex');
}

