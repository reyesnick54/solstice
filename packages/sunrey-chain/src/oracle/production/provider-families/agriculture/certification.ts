import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import type { FeedSchemaDefinition } from '../../types.ts';
import {
  emptyEvidenceStates,
  healthyConnector,
  runCertificationSuite,
  type CertificationSubject,
  type SandboxObservation,
} from '../../certification/index.ts';
import { identifyHarvestEvents, ingestAgricultureRecord } from './adapter.ts';
import { refuseDuplicateHarvestMass } from './harvest.ts';
import { agricultureRecord, farmSystemRecord, grainScaleRecord, harvestTelemetryRecord } from './fixtures.ts';
import { AGRICULTURE_FEED_SCHEMAS, AGRICULTURE_SCHEMA_IDS } from './schemas.ts';
import {
  AGRICULTURE_CERTIFICATION_AUTHORIZES_MOONREY,
  defaultAgricultureFabricPolicy,
  type AgricultureRefusal,
  type AgricultureSourceClass,
} from './types.ts';

export const AGRICULTURE_SANDBOX_FEEDS = [
  'valid_harvest_mass',
  'valid_grain_scale',
  'valid_dairy_food_measurement',
] as const;
export type AgricultureSandboxFeed = (typeof AGRICULTURE_SANDBOX_FEEDS)[number];

export const AGRICULTURE_ADVERSARIAL_SCENARIOS = [
  'FORECAST_AS_HARVEST',
  'PLANTED_ACREAGE_AS_OUTPUT',
  'DUPLICATE_HARVEST',
  'COUNTER_RESET',
  'INVENTORY_AS_HARVEST',
  'WRONG_UNITS',
  'FLOAT_QUANTITY',
  'STALE_METER',
  'SAME_CONTROLLER_FAKE_QUORUM',
  'MISSING_RIGHTS',
  'SCHEMA_DRIFT',
  'CREDENTIAL_LEAK',
] as const;
export type AgricultureAdversarialScenario = (typeof AGRICULTURE_ADVERSARIAL_SCENARIOS)[number];

const NOW = 1_700_000_000n;

const FEED_CLASS: Readonly<Record<AgricultureSandboxFeed, AgricultureSourceClass>> = Object.freeze({
  valid_harvest_mass: 'HARVEST_METER',
  valid_grain_scale: 'GRAIN_SCALE',
  valid_dairy_food_measurement: 'DAIRY_PRODUCTION_METER',
});

export function agricultureSandboxSubject(feed: AgricultureSandboxFeed, nowUnix = NOW): CertificationSubject {
  const sourceClass = FEED_CLASS[feed];
  const schema = AGRICULTURE_FEED_SCHEMAS[sourceClass];
  const factType = sourceClass === 'DAIRY_PRODUCTION_METER' ? 'FOOD_PRODUCTION' : 'AGRICULTURAL_OUTPUT';
  const observation: SandboxObservation = Object.freeze({
    identifier: `sandbox_${feed}`,
    numericValue: '1000',
    unit: 'kg',
    sourceTimestampUnix: nowUnix.toString(),
    collectionTimestampUnix: nowUnix.toString(),
    sourceObservationId: `obs_${feed}`,
    schemaId: schema.schemaId,
    schemaVersion: 1,
    contentType: 'application/json',
    responseBytes: 256,
    extras: Object.freeze({ sourceClass, fabric: 'agriculture' }),
    timestampSemantic: 'SOURCE_EVENT',
  });
  return Object.freeze({
    providerId: `sandbox_ag_${feed}`,
    sourceId: `src_ag_${feed}`,
    feedId: `feed_ag_${feed}`,
    sourceCategory: 'food_agriculture',
    factType,
    productiveCategory: 'FOOD_AGRICULTURE',
    claimType: 'OUTPUT',
    schemaId: schema.schemaId,
    schemaVersion: 1,
    unit: 'kg',
    normalizationVersion: 'sunrey.economic-unit.normalization.v1',
    mappingVersion: 1,
    connectorRuntimeVersion: 'sunrey.economic-data-connector.v1',
    controllerId: `controller_ag_${feed}`,
    upstreamOrganizationId: `org_ag_${feed}`,
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

export function agricultureSandboxSchema(feed: AgricultureSandboxFeed): FeedSchemaDefinition {
  return AGRICULTURE_FEED_SCHEMAS[FEED_CLASS[feed]];
}

export function certifyAgricultureSandbox(feed: AgricultureSandboxFeed, nowUnix = NOW) {
  return runCertificationSuite(agricultureSandboxSubject(feed, nowUnix), agricultureSandboxSchema(feed));
}

export function evaluateAgricultureAdversary(
  scenario: AgricultureAdversarialScenario,
  nowUnix = NOW,
): Result<{ readonly blocked: true }, AgricultureRefusal> {
  const policy = defaultAgricultureFabricPolicy();
  const farm = farmSystemRecord(nowUnix);
  switch (scenario) {
    case 'FORECAST_AS_HARVEST':
      return fail(
        ingestAgricultureRecord(
          agricultureRecord({ measurementSemantics: 'EXPECTED_YIELD', nowUnix }),
          nowUnix,
          policy,
        ),
      );
    case 'PLANTED_ACREAGE_AS_OUTPUT':
      return fail(
        ingestAgricultureRecord(
          agricultureRecord({ measurementSemantics: 'PLANTED', unit: 'm2', numericValue: '40000', nowUnix }),
          nowUnix,
          policy,
        ),
      );
    case 'DUPLICATE_HARVEST': {
      const combine = ingestAgricultureRecord(harvestTelemetryRecord(nowUnix), nowUnix, policy);
      const scale = ingestAgricultureRecord(grainScaleRecord(nowUnix), nowUnix, policy);
      if (!combine.ok) {
        return combine;
      }
      if (!scale.ok) {
        return scale;
      }
      const events = identifyHarvestEvents(
        [combine.value.observation, scale.value.observation],
        nowUnix,
        nowUnix + 3_600n,
      );
      if (!events.ok) {
        return events;
      }
      return fail(refuseDuplicateHarvestMass(events.value, 2));
    }
    case 'COUNTER_RESET':
      return fail(
        ingestAgricultureRecord(
          agricultureRecord({
            sourceClass: 'HARVEST_METER',
            meterSemantics: 'CUMULATIVE_REGISTER',
            numericValue: '10',
            documentedMeterReset: false,
            prior: {
              meterRef: 'meter.harvest.1',
              registerId: 'register.harvest.a',
              readingMantissa: 5_000n,
              unit: 'kg',
              sourceTimestampUnix: nowUnix - 3_600n,
            },
            nowUnix,
          }),
          nowUnix,
          policy,
        ),
      );
    case 'INVENTORY_AS_HARVEST':
      return fail(
        ingestAgricultureRecord(
          agricultureRecord({
            sourceClass: 'SILO_INVENTORY_SYSTEM',
            measurementSemantics: 'HARVESTED',
            nowUnix,
          }),
          nowUnix,
          policy,
        ),
      );
    case 'WRONG_UNITS':
      return fail(ingestAgricultureRecord(agricultureRecord({ unit: 'kWh', nowUnix }), nowUnix, policy));
    case 'FLOAT_QUANTITY':
      return fail(ingestAgricultureRecord(agricultureRecord({ numericValue: '12.5', nowUnix }), nowUnix, policy));
    case 'STALE_METER':
      return fail(
        ingestAgricultureRecord(
          agricultureRecord({ sourceTimestampUnix: (nowUnix - 200_000n).toString(), nowUnix }),
          nowUnix,
          policy,
        ),
      );
    case 'SAME_CONTROLLER_FAKE_QUORUM':
      return fail(
        ingestAgricultureRecord(
          agricultureRecord({
            sourceClass: 'INDEPENDENT_AGRICULTURAL_ATTESTATION',
            schemaId: AGRICULTURE_SCHEMA_IDS.INDEPENDENT_AGRICULTURAL_ATTESTATION,
            controllerId: 'farm-controller',
            upstreamOrganizationId: 'farm-org',
            sharedControlGroup: 'farm-control-group',
            nowUnix,
          }),
          nowUnix,
          policy,
          [farm],
        ),
      );
    case 'MISSING_RIGHTS':
      return fail(ingestAgricultureRecord(agricultureRecord({ rightsReferences: [], nowUnix }), nowUnix, policy));
    case 'SCHEMA_DRIFT':
      return fail(
        ingestAgricultureRecord(agricultureRecord({ schemaId: 'agriculture.harvest.changed', nowUnix }), nowUnix, policy),
      );
    case 'CREDENTIAL_LEAK':
      return fail(
        ingestAgricultureRecord(
          agricultureRecord({ extras: { apiKey: 'sandbox-not-a-real-secret' }, nowUnix }),
          nowUnix,
          policy,
        ),
      );
    default:
      return err({ code: 'UNKNOWN_SOURCE_CLASS', detail: `unknown adversarial scenario ${scenario}` });
  }
}

function fail<T>(result: Result<T, AgricultureRefusal>): Result<{ readonly blocked: true }, AgricultureRefusal> {
  if (!result.ok) {
    return ok(Object.freeze({ blocked: true as const }));
  }
  return err({
    code: 'AUTO_MINT_FORBIDDEN',
    detail: 'adversarial agriculture scenario was unexpectedly accepted',
  });
}

export function agricultureCertificationCannotAuthorizeMoonRey(): false {
  return AGRICULTURE_CERTIFICATION_AUTHORIZES_MOONREY;
}
