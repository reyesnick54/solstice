import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import type { FeedSchemaDefinition } from '../../types.ts';
import {
  emptyEvidenceStates,
  healthyConnector,
  runCertificationSuite,
  type CertificationSubject,
  type SandboxObservation,
} from '../../certification/index.ts';
import { ingestWaterRecord } from './adapter.ts';
import { treatmentMeterRecord, waterRecord } from './fixtures.ts';
import { WATER_FEED_SCHEMAS, WATER_SCHEMA_IDS } from './schemas.ts';
import {
  WATER_CERTIFICATION_AUTHORIZES_MOONREY,
  defaultWaterFabricPolicy,
  type WaterRefusal,
  type WaterSourceClass,
} from './types.ts';

export const WATER_SANDBOX_FEEDS = [
  'valid_treatment_production',
  'valid_desalination_production',
  'valid_availability_reference',
  'valid_cumulative_meter',
] as const;
export type WaterSandboxFeed = (typeof WATER_SANDBOX_FEEDS)[number];

export const WATER_ADVERSARIAL_SCENARIOS = [
  'AVAILABILITY_AS_PRODUCTION',
  'IRRIGATION_AS_PRODUCTION',
  'WRONG_UNITS',
  'FLOAT_QUANTITY',
  'STALE_METER',
  'COUNTER_RESET',
  'SAME_CONTROLLER_FAKE_QUORUM',
  'MISSING_RIGHTS',
  'SCHEMA_DRIFT',
  'CREDENTIAL_LEAK',
] as const;
export type WaterAdversarialScenario = (typeof WATER_ADVERSARIAL_SCENARIOS)[number];

const NOW = 1_700_000_000n;

const FEED_CLASS: Readonly<Record<WaterSandboxFeed, WaterSourceClass>> = Object.freeze({
  valid_treatment_production: 'TREATMENT_PLANT_METER',
  valid_desalination_production: 'DESALINATION_PLANT_METER',
  valid_availability_reference: 'RESERVOIR_REFERENCE',
  valid_cumulative_meter: 'WATER_UTILITY_PRODUCTION_METER',
});

export function waterSandboxSubject(feed: WaterSandboxFeed, nowUnix = NOW): CertificationSubject {
  const sourceClass = FEED_CLASS[feed];
  const schema = WATER_FEED_SCHEMAS[sourceClass];
  const factType = sourceClass === 'RESERVOIR_REFERENCE' ? 'WATER_AVAILABILITY' : 'WATER_PRODUCTION';
  const observation: SandboxObservation = Object.freeze({
    identifier: `sandbox_${feed}`,
    numericValue: '1000',
    unit: 'L',
    sourceTimestampUnix: nowUnix.toString(),
    collectionTimestampUnix: nowUnix.toString(),
    sourceObservationId: `obs_${feed}`,
    schemaId: schema.schemaId,
    schemaVersion: 1,
    contentType: 'application/json',
    responseBytes: 256,
    extras: Object.freeze({ sourceClass, fabric: 'water' }),
    timestampSemantic: 'SOURCE_EVENT',
  });
  return Object.freeze({
    providerId: `sandbox_water_${feed}`,
    sourceId: `src_water_${feed}`,
    feedId: `feed_water_${feed}`,
    sourceCategory: 'water',
    factType,
    productiveCategory: 'WATER',
    claimType: factType === 'WATER_AVAILABILITY' ? 'CAPACITY' : 'OUTPUT',
    schemaId: schema.schemaId,
    schemaVersion: 1,
    unit: 'L',
    normalizationVersion: 'sunrey.economic-unit.normalization.v1',
    mappingVersion: 1,
    connectorRuntimeVersion: 'sunrey.economic-data-connector.v1',
    controllerId: `controller_water_${feed}`,
    upstreamOrganizationId: `org_water_${feed}`,
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

export function waterSandboxSchema(feed: WaterSandboxFeed): FeedSchemaDefinition {
  return WATER_FEED_SCHEMAS[FEED_CLASS[feed]];
}

export function certifyWaterSandbox(feed: WaterSandboxFeed, nowUnix = NOW) {
  return runCertificationSuite(waterSandboxSubject(feed, nowUnix), waterSandboxSchema(feed));
}

export function evaluateWaterAdversary(
  scenario: WaterAdversarialScenario,
  nowUnix = NOW,
): Result<{ readonly blocked: true }, WaterRefusal> {
  const policy = defaultWaterFabricPolicy();
  const treatment = treatmentMeterRecord(nowUnix);
  switch (scenario) {
    case 'AVAILABILITY_AS_PRODUCTION':
      return fail(
        ingestWaterRecord(
          waterRecord({
            sourceClass: 'RESERVOIR_REFERENCE',
            factType: 'WATER_PRODUCTION',
            measurementSemantics: 'AVAILABLE_RESERVE',
            nowUnix,
          }),
          nowUnix,
          policy,
        ),
      );
    case 'IRRIGATION_AS_PRODUCTION':
      return fail(
        ingestWaterRecord(
          waterRecord({
            sourceClass: 'IRRIGATION_METER',
            measurementSemantics: 'TREATED_WATER_PRODUCTION',
            nowUnix,
          }),
          nowUnix,
          policy,
        ),
      );
    case 'WRONG_UNITS':
      return fail(ingestWaterRecord(waterRecord({ unit: 'kWh', nowUnix }), nowUnix, policy));
    case 'FLOAT_QUANTITY':
      return fail(ingestWaterRecord(waterRecord({ numericValue: '12.5', nowUnix }), nowUnix, policy));
    case 'STALE_METER':
      return fail(
        ingestWaterRecord(
          waterRecord({ sourceTimestampUnix: (nowUnix - 200_000n).toString(), nowUnix }),
          nowUnix,
          policy,
        ),
      );
    case 'COUNTER_RESET':
      return fail(
        ingestWaterRecord(
          waterRecord({
            meterSemantics: 'CUMULATIVE_REGISTER',
            numericValue: '10',
            documentedMeterReset: false,
            prior: {
              meterRef: 'meter.water.1',
              registerId: 'register.water.a',
              readingMantissa: 5_000n,
              unit: 'm3',
              sourceTimestampUnix: nowUnix - 3_600n,
            },
            nowUnix,
          }),
          nowUnix,
          policy,
        ),
      );
    case 'SAME_CONTROLLER_FAKE_QUORUM':
      return fail(
        ingestWaterRecord(
          waterRecord({
            sourceClass: 'INDEPENDENT_WATER_AUDITOR',
            schemaId: WATER_SCHEMA_IDS.INDEPENDENT_WATER_AUDITOR,
            controllerId: 'utility-controller',
            upstreamOrganizationId: 'utility-org',
            sharedControlGroup: 'utility-control-group',
            nowUnix,
          }),
          nowUnix,
          policy,
          [treatment],
        ),
      );
    case 'MISSING_RIGHTS':
      return fail(
        ingestWaterRecord(waterRecord({ sourceClass: 'WELL_PRODUCTION_METER', rightsReferences: [], nowUnix }), nowUnix, policy),
      );
    case 'SCHEMA_DRIFT':
      return fail(ingestWaterRecord(waterRecord({ schemaId: 'water.treatment.changed', nowUnix }), nowUnix, policy));
    case 'CREDENTIAL_LEAK':
      return fail(
        ingestWaterRecord(waterRecord({ extras: { apiKey: 'sandbox-not-a-real-secret' }, nowUnix }), nowUnix, policy),
      );
    default:
      return err({ code: 'UNKNOWN_SOURCE_CLASS', detail: `unknown adversarial scenario ${scenario}` });
  }
}

function fail<T>(result: Result<T, WaterRefusal>): Result<{ readonly blocked: true }, WaterRefusal> {
  if (!result.ok) {
    return ok(Object.freeze({ blocked: true as const }));
  }
  return err({
    code: 'AUTO_MINT_FORBIDDEN',
    detail: 'adversarial water scenario was unexpectedly accepted',
  });
}

export function waterCertificationCannotAuthorizeMoonRey(): false {
  return WATER_CERTIFICATION_AUTHORIZES_MOONREY;
}
