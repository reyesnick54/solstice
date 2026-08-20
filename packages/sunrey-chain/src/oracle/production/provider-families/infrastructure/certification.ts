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
import { ingestInfrastructureRecord } from './adapter.ts';
import { infrastructureRecord } from './fixtures.ts';
import { INFRASTRUCTURE_FEED_SCHEMAS, INFRASTRUCTURE_SCHEMA_IDS } from './schemas.ts';
import {
  INFRASTRUCTURE_CERTIFICATION_AUTHORIZES_MOONREY,
  INFRASTRUCTURE_FACILITY_TIME_V2,
  defaultInfrastructureFabricPolicy,
  type InfrastructureRefusal,
  type InfrastructureSourceClass,
} from './types.ts';

export const INFRASTRUCTURE_SANDBOX_FEEDS = [
  'valid_facility_time_usage',
  'valid_terminal_usage',
  'valid_infrastructure_capacity',
  'valid_independent_utilization',
] as const;
export type InfrastructureSandboxFeed = (typeof INFRASTRUCTURE_SANDBOX_FEEDS)[number];

export const INFRASTRUCTURE_ADVERSARIAL_SCENARIOS = [
  'CAPACITY_AS_USAGE',
  'MACHINE_H_AS_FACILITY_HOUR',
  'SAME_CONTROLLER_FAKE_QUORUM',
  'FLOAT_DURATION',
  'SCHEMA_DRIFT',
  'WRONG_UNIT',
  'STALE_UTILIZATION',
] as const;
export type InfrastructureAdversarialScenario = (typeof INFRASTRUCTURE_ADVERSARIAL_SCENARIOS)[number];

const NOW = 1_700_000_000n;

const FEED_CLASS: Readonly<Record<InfrastructureSandboxFeed, InfrastructureSourceClass>> = Object.freeze({
  valid_facility_time_usage: 'FACILITY_MANAGEMENT_SYSTEM',
  valid_terminal_usage: 'TERMINAL_USAGE_SYSTEM',
  valid_infrastructure_capacity: 'PUBLIC_ASSET_UTILIZATION_REFERENCE',
  valid_independent_utilization: 'INDEPENDENT_INFRASTRUCTURE_ATTESTATION',
});

export function infrastructureSandboxSubject(feed: InfrastructureSandboxFeed, nowUnix = NOW): CertificationSubject {
  const sourceClass = FEED_CLASS[feed];
  const schema = INFRASTRUCTURE_FEED_SCHEMAS[sourceClass];
  const usage = feed !== 'valid_infrastructure_capacity';
  const observation: SandboxObservation = Object.freeze({
    identifier: `sandbox_${feed}`,
    numericValue: '6',
    unit: 'facility_hour',
    sourceTimestampUnix: nowUnix.toString(),
    collectionTimestampUnix: nowUnix.toString(),
    sourceObservationId: `obs_${feed}`,
    schemaId: schema.schemaId,
    schemaVersion: 2,
    contentType: 'application/json',
    responseBytes: 256,
    extras: Object.freeze({ sourceClass, fabric: 'infrastructure' }),
    timestampSemantic: 'SOURCE_EVENT',
  });
  return Object.freeze({
    providerId: `sandbox_infrastructure_${feed}`,
    sourceId: `src_infrastructure_${feed}`,
    feedId: `feed_infrastructure_${feed}`,
    sourceCategory: 'infrastructure',
    factType: usage ? 'INFRASTRUCTURE_USAGE' : 'INFRASTRUCTURE_CAPACITY',
    productiveCategory: 'INFRASTRUCTURE',
    claimType: usage ? 'USAGE' : 'CAPACITY',
    schemaId: schema.schemaId,
    schemaVersion: 2,
    unit: 'facility_hour',
    normalizationVersion: 'sunrey.economic-unit.normalization.v1',
    mappingVersion: 1,
    connectorRuntimeVersion: 'sunrey.economic-data-connector.v1',
    controllerId: `controller_infrastructure_${feed}`,
    upstreamOrganizationId: `org_infrastructure_${feed}`,
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

export function infrastructureSandboxSchema(feed: InfrastructureSandboxFeed): FeedSchemaDefinition {
  return INFRASTRUCTURE_FEED_SCHEMAS[FEED_CLASS[feed]];
}

export function certifyInfrastructureSandbox(feed: InfrastructureSandboxFeed, nowUnix = NOW) {
  return runCertificationSuite(infrastructureSandboxSubject(feed, nowUnix), infrastructureSandboxSchema(feed));
}

export function evaluateInfrastructureAdversary(
  scenario: InfrastructureAdversarialScenario,
  nowUnix = NOW,
): Result<{ readonly blocked: true }, InfrastructureRefusal> {
  const policy = defaultInfrastructureFabricPolicy();
  const serving = infrastructureRecord({ nowUnix });
  switch (scenario) {
    case 'CAPACITY_AS_USAGE':
      return fail(ingestInfrastructureRecord(
        infrastructureRecord({
          sourceClass: 'PUBLIC_ASSET_UTILIZATION_REFERENCE',
          factType: 'INFRASTRUCTURE_USAGE',
          usageState: 'SERVING',
          schemaId: INFRASTRUCTURE_SCHEMA_IDS.PUBLIC_ASSET_UTILIZATION_REFERENCE,
          nowUnix,
        }),
        nowUnix,
        policy,
      ));
    case 'MACHINE_H_AS_FACILITY_HOUR':
      return fail(ingestInfrastructureRecord(
        infrastructureRecord({
          unit: 'machine_h',
          unitSemantics: INFRASTRUCTURE_FACILITY_TIME_V2,
          nowUnix,
        }),
        nowUnix,
        policy,
      ));
    case 'SAME_CONTROLLER_FAKE_QUORUM':
      return fail(ingestInfrastructureRecord(
        infrastructureRecord({
          sourceClass: 'INDEPENDENT_INFRASTRUCTURE_ATTESTATION',
          schemaId: INFRASTRUCTURE_SCHEMA_IDS.INDEPENDENT_INFRASTRUCTURE_ATTESTATION,
          controllerId: 'terminal-controller',
          upstreamOrganizationId: 'port-org',
          nowUnix,
        }),
        nowUnix,
        policy,
        [serving],
      ));
    case 'FLOAT_DURATION':
      return fail(ingestInfrastructureRecord(
        infrastructureRecord({ measurementEndUnix: '1700003600.5', nowUnix }),
        nowUnix,
        policy,
      ));
    case 'SCHEMA_DRIFT':
      return fail(ingestInfrastructureRecord(
        infrastructureRecord({ schemaId: 'infrastructure.changed', nowUnix }),
        nowUnix,
        policy,
      ));
    case 'WRONG_UNIT':
      return fail(ingestInfrastructureRecord(infrastructureRecord({ unit: 'm2', nowUnix }), nowUnix, policy));
    case 'STALE_UTILIZATION':
      return fail(ingestInfrastructureRecord(
        infrastructureRecord({ sourceTimestampUnix: (nowUnix - 200_000n).toString(), nowUnix }),
        nowUnix,
        { ...policy, maximumObservationAgeSeconds: 86_400 },
      ));
    default:
      return err({ code: 'UNKNOWN_SOURCE_CLASS', detail: `unknown adversarial scenario ${scenario}` });
  }
}

function fail<T>(result: Result<T, InfrastructureRefusal>): Result<{ readonly blocked: true }, InfrastructureRefusal> {
  if (!result.ok) {
    return ok(Object.freeze({ blocked: true as const }));
  }
  return err({
    code: 'AUTO_MINT_FORBIDDEN',
    detail: 'adversarial infrastructure scenario was unexpectedly accepted',
  });
}

export function infrastructureCertificationCannotAuthorizeMoonRey(): false {
  return INFRASTRUCTURE_CERTIFICATION_AUTHORIZES_MOONREY;
}

export function infrastructureCertificationDigest(feed: InfrastructureSandboxFeed): string {
  return createHash('sha256').update(`infrastructure-sandbox:${feed}`).digest('hex');
}
