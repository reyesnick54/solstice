/**
 * Deterministic sandbox provider fixtures.
 *
 * Framework testing only. These are not commercial providers, contracts,
 * or production feeds.
 */

import type { FactType, UnitCode } from '../../types.ts';
import type { ClaimType, ProductiveCategory } from '../../../productive/types.ts';
import type { FeedSchemaDefinition } from '../types.ts';
import {
  CERTIFICATION_CONNECTOR_RUNTIME_VERSION,
  CERTIFICATION_NORMALIZATION_VERSION,
  emptyEvidenceStates,
  type CertificationEvidenceStates,
  type CertificationSubject,
  type ConnectorRuntimeSnapshot,
  type RelatedFeedIdentity,
  type SandboxObservation,
} from './types.ts';
import type { DataSourceCategory } from '../types.ts';

export type SandboxClass = 'energy' | 'compute' | 'manufacturing' | 'logistics';

export type SandboxScenario =
  | 'VALID'
  | 'SCHEMA_MISMATCH'
  | 'UNIT_MISMATCH'
  | 'SEMANTIC_MISMATCH'
  | 'MISSING_CONTEXT'
  | 'STALE'
  | 'OVERSIZED'
  | 'AUTH_FAILURE'
  | 'SSRF'
  | 'SAME_CONTROLLER'
  | 'SILENT_UNIT_CHANGE'
  | 'TIMESTAMP_CHANGE'
  | 'FLOAT_VALUE'
  | 'REUSED_OBSERVATION_ID'
  | 'IMPOSSIBLE_SCHEMA'
  | 'CATEGORY_LIE'
  | 'CONFLICTING'
  | 'FORBIDDEN_REDIRECT'
  | 'CREDENTIAL_LEAK'
  | 'UNEXPECTED_API_VERSION';

const NOW = 1_700_000_000n;

export type SandboxClassSpec = {
  readonly classId: SandboxClass;
  readonly sourceCategory: DataSourceCategory;
  readonly factType: FactType;
  readonly productiveCategory: ProductiveCategory;
  readonly claimType: ClaimType;
  readonly unit: UnitCode;
  readonly schemaId: string;
  readonly identifier: string;
  readonly value: string;
};

export const SANDBOX_CLASSES: Readonly<Record<SandboxClass, SandboxClassSpec>> = Object.freeze({
  energy: Object.freeze({
    classId: 'energy',
    sourceCategory: 'energy',
    factType: 'ENERGY_PRODUCTION',
    productiveCategory: 'ENERGY',
    claimType: 'OUTPUT',
    unit: 'kWh',
    schemaId: 'energy.sandbox.v1',
    identifier: 'plant_sandbox_1',
    value: '1000',
  }),
  compute: Object.freeze({
    classId: 'compute',
    sourceCategory: 'compute',
    factType: 'COMPUTE_USAGE',
    productiveCategory: 'COMPUTE',
    claimType: 'USAGE',
    unit: 'gpu_s',
    schemaId: 'compute.sandbox.v1',
    identifier: 'cluster_sandbox_1',
    value: '3600',
  }),
  manufacturing: Object.freeze({
    classId: 'manufacturing',
    sourceCategory: 'manufacturing',
    factType: 'MANUFACTURING_OUTPUT',
    productiveCategory: 'MANUFACTURING',
    claimType: 'OUTPUT',
    unit: 'units_produced',
    schemaId: 'manufacturing.sandbox.v1',
    identifier: 'factory_sandbox_1',
    value: '40',
  }),
  logistics: Object.freeze({
    classId: 'logistics',
    sourceCategory: 'logistics',
    factType: 'LOGISTICS_CAPACITY',
    productiveCategory: 'LOGISTICS_TRANSPORTATION',
    claimType: 'CAPACITY',
    unit: 'tonne_km',
    schemaId: 'logistics.sandbox.v1',
    identifier: 'lane_sandbox_1',
    value: '250',
  }),
});

export function feedSchemaFor(spec: SandboxClassSpec): FeedSchemaDefinition {
  return Object.freeze({
    schemaVersion: 1,
    schemaId: spec.schemaId,
    version: 1,
    factType: spec.factType,
    requiredFields: Object.freeze(['identifier', 'numericValue', 'unit', 'sourceTimestampUnix']),
    unit: spec.unit,
    quantityScale: 0,
    identifierPattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{1,63}$',
    maxRecordBytes: 8_192,
    maxArrayLength: 32,
    allowFloat: false,
    breakingChangeCreatesNewVersion: true,
  });
}

export function healthyConnector(overrides: Partial<ConnectorRuntimeSnapshot> = {}): ConnectorRuntimeSnapshot {
  return Object.freeze({
    runtimeVersion: CERTIFICATION_CONNECTOR_RUNTIME_VERSION,
    runtimeMajorVersion: 1,
    endpointUrl: 'https://sandbox.local/oracle/feed',
    endpointAllowlisted: true,
    protocol: 'HTTPS',
    tlsValidated: true,
    authenticationClass: 'FILE_FIXTURE_TEST_ONLY',
    authenticationSucceeded: true,
    secretIsolated: true,
    redirectedTo: null,
    redirectAllowed: false,
    ssrfAttempted: false,
    ssrfBlocked: true,
    contentType: 'application/json',
    approvedContentType: 'application/json',
    responseBytes: 256,
    maxResponseBytes: 8_192,
    timeoutMs: 80,
    timeoutBudgetMs: 1_000,
    timedOut: false,
    retryCount: 0,
    maxRetries: 2,
    rateLimitEvents: 0,
    circuitBreakerOpen: false,
    approvedEndpointProfile: true,
    ...overrides,
  });
}

export function sandboxSubject(
  classId: SandboxClass,
  scenario: SandboxScenario = 'VALID',
  evidence: CertificationEvidenceStates = emptyEvidenceStates(),
  nowUnix = NOW,
): CertificationSubject {
  const spec = SANDBOX_CLASSES[classId];
  const providerId = `sandbox_${classId}`;
  const sourceId = `src_${classId}_1`;
  const feedId = `feed_${classId}_1`;
  const observation = observationFor(spec, scenario, nowUnix);
  const related = relatedFor(spec, scenario, providerId);
  return Object.freeze({
    providerId,
    sourceId,
    feedId,
    sourceCategory: scenario === 'CATEGORY_LIE' ? 'energy' : spec.sourceCategory,
    factType: scenario === 'SEMANTIC_MISMATCH' ? 'SERVICE_DELIVERY' : spec.factType,
    productiveCategory: spec.productiveCategory,
    claimType: scenario === 'SEMANTIC_MISMATCH' ? 'OUTPUT' : spec.claimType,
    schemaId: spec.schemaId,
    schemaVersion: 1,
    unit:
      scenario === 'UNIT_MISMATCH' || scenario === 'SILENT_UNIT_CHANGE'
        ? spec.classId === 'energy'
          ? 'tonne_km'
          : 'kWh'
        : scenario === 'MISSING_CONTEXT'
          ? 'compute_s'
          : spec.unit,
    normalizationVersion: CERTIFICATION_NORMALIZATION_VERSION,
    mappingVersion: 1,
    connectorRuntimeVersion: CERTIFICATION_CONNECTOR_RUNTIME_VERSION,
    controllerId: `controller_${classId}`,
    upstreamOrganizationId: `org_${classId}`,
    sharedControlGroup: scenario === 'SAME_CONTROLLER' ? 'shared-control-a' : null,
    relatedFeeds: related,
    connector: connectorFor(scenario),
    observations:
      scenario === 'REUSED_OBSERVATION_ID' || scenario === 'CONFLICTING'
        ? Object.freeze([observation, { ...observation, numericValue: scenario === 'CONFLICTING' ? '999999' : observation.numericValue, extras: { ...observation.extras, conflict: scenario === 'CONFLICTING' } }])
        : Object.freeze([observation]),
    evidence,
    prior: scenario === 'UNEXPECTED_API_VERSION' || scenario === 'SILENT_UNIT_CHANGE'
      ? Object.freeze({
          certificationId: 'cert_prior',
          schemaId: spec.schemaId,
          schemaVersion: 1,
          unit: spec.unit,
          endpointUrl: 'https://sandbox.local/oracle/feed',
          authenticationClass: 'FILE_FIXTURE_TEST_ONLY' as const,
          connectorRuntimeMajorVersion: 1,
          securityPolicyVersion: 'sunrey.oracle.security-conformance.v1',
          controllerId: `controller_${classId}`,
          createdAtUnix: nowUnix - 100n,
          expiresAtUnix: nowUnix + 7_776_000n,
          requiredFields: Object.freeze(['identifier', 'numericValue', 'unit', 'sourceTimestampUnix']),
        })
      : null,
    nowUnix,
    createdAtUnix: nowUnix,
  });
}

function observationFor(spec: SandboxClassSpec, scenario: SandboxScenario, nowUnix: bigint): SandboxObservation {
  const extras: Record<string, unknown> = spec.classId === 'compute' ? { resourceClass: 'GPU' } : {};
  if (scenario === 'MISSING_CONTEXT') {
    delete extras.resourceClass;
  }
  let unit = spec.unit;
  let numericValue = spec.value;
  let schemaId = spec.schemaId;
  let schemaVersion = 1;
  let sourceTimestamp = nowUnix.toString();
  let responseBytes = 256;
  let identifier = spec.identifier;
  let leaked: string | undefined;
  let timestampSemantic: SandboxObservation['timestampSemantic'] = 'SOURCE_EVENT';
  if (scenario === 'UNIT_MISMATCH' || scenario === 'SILENT_UNIT_CHANGE') {
    unit = spec.classId === 'energy' ? 'tonne_km' : 'kWh';
  }
  if (scenario === 'MISSING_CONTEXT') {
    unit = 'compute_s';
    extras.note = 'generic compute without class';
  }
  if (scenario === 'STALE') {
    sourceTimestamp = (nowUnix - 86_400n).toString();
  }
  if (scenario === 'OVERSIZED') {
    responseBytes = 1_000_000;
    extras.blob = 'x'.repeat(64);
  }
  if (scenario === 'SCHEMA_MISMATCH' || scenario === 'UNEXPECTED_API_VERSION') {
    schemaId = `${spec.schemaId}.changed`;
    schemaVersion = 2;
  }
  if (scenario === 'FLOAT_VALUE') {
    numericValue = '12.5';
  }
  if (scenario === 'IMPOSSIBLE_SCHEMA') {
    schemaId = 'not-a-schema';
    schemaVersion = 99;
    extras.impossible = true;
  }
  if (scenario === 'TIMESTAMP_CHANGE') {
    timestampSemantic = 'INGESTION';
  }
  if (scenario === 'CREDENTIAL_LEAK') {
    leaked = 'apiKey';
    extras.apiKey = 'sandbox-not-a-real-secret';
  }
  if (scenario === 'IDENTIFIER_CHANGE_INTERNAL' as SandboxScenario) {
    identifier = '???';
  }
  return Object.freeze({
    identifier,
    numericValue,
    unit,
    sourceTimestampUnix: sourceTimestamp,
    collectionTimestampUnix: nowUnix.toString(),
    sourceObservationId: `obs_${spec.classId}_1`,
    schemaId,
    schemaVersion,
    contentType: 'application/json',
    responseBytes,
    extras: Object.freeze(extras),
    leakedCredentialField: leaked,
    timestampSemantic,
  });
}

function connectorFor(scenario: SandboxScenario): ConnectorRuntimeSnapshot {
  if (scenario === 'AUTH_FAILURE') {
    return healthyConnector({ authenticationSucceeded: false });
  }
  if (scenario === 'SSRF') {
    return healthyConnector({
      ssrfAttempted: true,
      ssrfBlocked: false,
      endpointUrl: 'https://169.254.169.254/latest/meta-data',
      endpointAllowlisted: false,
      approvedEndpointProfile: false,
    });
  }
  if (scenario === 'FORBIDDEN_REDIRECT') {
    return healthyConnector({
      redirectedTo: 'http://127.0.0.1/steal',
      redirectAllowed: false,
    });
  }
  if (scenario === 'OVERSIZED') {
    return healthyConnector({ responseBytes: 1_000_000 });
  }
  return healthyConnector();
}

function relatedFor(spec: SandboxClassSpec, scenario: SandboxScenario, providerId: string): readonly RelatedFeedIdentity[] {
  if (scenario !== 'SAME_CONTROLLER') {
    return Object.freeze([]);
  }
  return Object.freeze([
    {
      feedId: `feed_${spec.classId}_2`,
      sourceId: `src_${spec.classId}_2`,
      providerId: `${providerId}_alias`,
      controllerId: `controller_${spec.classId}`,
      upstreamOrganizationId: `org_${spec.classId}`,
      sharedControlGroup: 'shared-control-a',
    },
  ]);
}

export function computeMissingContextSubject(nowUnix = NOW): CertificationSubject {
  const base = sandboxSubject('compute', 'MISSING_CONTEXT', emptyEvidenceStates(), nowUnix);
  return Object.freeze({
    ...base,
    unit: 'compute_s',
    schemaId: 'compute.sandbox.v1',
  });
}
