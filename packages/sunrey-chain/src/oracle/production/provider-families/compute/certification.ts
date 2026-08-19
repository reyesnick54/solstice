/**
 * Compute provider-family certification fixtures.
 *
 * Certification remains Chunk 128 admission control. Passing a
 * compute sandbox does not mint MoonRey or activate production.
 */

import { evaluateIndependence } from '../../certification/independence.ts';
import {
  CERTIFICATION_CONNECTOR_RUNTIME_VERSION,
  CERTIFICATION_MINTS_MOONREY,
  CERTIFICATION_NORMALIZATION_VERSION,
  emptyEvidenceStates,
  type CertificationSubject,
} from '../../certification/types.ts';
import { feedSchemaFor, healthyConnector, runCertificationSuite } from '../../certification/index.ts';
import type { FeedSchemaDefinition } from '../../types.ts';
import { computeFeedSchema } from './schemas.ts';
import { ingestComputeObservation } from './adapter.ts';
import type { ComputeRefusal, ComputeSchemaId, ComputeSourceObservation } from './types.ts';

export const COMPUTE_CERTIFICATION_SUITE = 'sunrey.compute-provider-certification.v1' as const;

export type ComputeCertificationScenario =
  | 'GPU_EXECUTION'
  | 'CPU_EXECUTION'
  | 'AI_INFERENCE_TOKENS'
  | 'AI_TRAINING_GPU'
  | 'CAPACITY_INVENTORY'
  | 'GENERIC_COMPUTE_MISSING_CLASS'
  | 'WALL_TIME_AS_GPU'
  | 'GPU_COUNT_OMITTED'
  | 'TOKENS_AS_GPU_SECONDS'
  | 'TRAINING_LABELED_INFERENCE'
  | 'DUPLICATE_JOB_SOURCES'
  | 'RAW_PROMPT'
  | 'CREDENTIAL_INCLUDED'
  | 'FLOAT_USAGE'
  | 'STALE_JOB'
  | 'SAME_CONTROLLER_FAKE_QUORUM';

export function computeCertificationSubject(
  observation: ComputeSourceObservation,
  extras: {
    readonly scenario?: ComputeCertificationScenario;
    readonly relatedSameController?: boolean;
    readonly nowUnix?: bigint;
  } = {},
): CertificationSubject {
  const nowUnix = extras.nowUnix ?? 1_700_000_000n;
  const schema = computeFeedSchema(observation.schemaId);
  const sameController = extras.relatedSameController === true;
  return Object.freeze({
    providerId: `sandbox_compute_${observation.sourceClass.toLowerCase()}`,
    sourceId: `src_${observation.sourceClass.toLowerCase()}`,
    feedId: `feed_${observation.schemaId.toLowerCase()}`,
    sourceCategory: schema.dataSourceCategory,
    factType: observation.factType,
    productiveCategory: schema.productiveCategory,
    claimType: observation.claimType,
    schemaId: schema.schemaId,
    schemaVersion: 1,
    unit: schema.unit,
    normalizationVersion: CERTIFICATION_NORMALIZATION_VERSION,
    mappingVersion: 1,
    connectorRuntimeVersion: CERTIFICATION_CONNECTOR_RUNTIME_VERSION,
    controllerId: observation.controllerId,
    upstreamOrganizationId: `org_${observation.controllerId}`,
    sharedControlGroup: sameController ? 'cloud-org-shared' : null,
    relatedFeeds: sameController
      ? Object.freeze([
          {
            feedId: 'feed_billing_alias',
            sourceId: 'src_billing_alias',
            providerId: 'sandbox_compute_billing_alias',
            controllerId: observation.controllerId,
            upstreamOrganizationId: `org_${observation.controllerId}`,
            sharedControlGroup: 'cloud-org-shared',
          },
        ])
      : Object.freeze([]),
    connector: healthyConnector({
      endpointUrl: 'https://sandbox.local/compute/feed',
      authenticationClass: 'FILE_FIXTURE_TEST_ONLY',
    }),
    observations: Object.freeze([
      {
        identifier: observation.identifier,
        numericValue: observation.numericValue,
        unit: schema.unit,
        sourceTimestampUnix: observation.sourceTimestampUnix,
        collectionTimestampUnix: nowUnix.toString(),
        sourceObservationId: `obs_${observation.identifier}`,
        schemaId: schema.schemaId,
        schemaVersion: 1,
        contentType: 'application/json',
        responseBytes: 256,
        extras: Object.freeze({
          resourceClass: observation.resourceClass,
          resourceCount: observation.resourceCount?.toString(),
          workloadClass: observation.workloadClass,
        }),
      },
    ]),
    evidence: emptyEvidenceStates(),
    prior: null,
    nowUnix,
    createdAtUnix: nowUnix,
  });
}

export function certifyComputeObservation(observation: ComputeSourceObservation, nowUnix = 1_700_000_000n) {
  const schema = computeFeedSchema(observation.schemaId);
  const feed: FeedSchemaDefinition = Object.freeze({
    schemaVersion: 1,
    schemaId: schema.schemaId,
    version: 1,
    factType: schema.factType,
    requiredFields: schema.requiredFields,
    unit: schema.unit,
    quantityScale: 0,
    identifierPattern: schema.identifierPattern,
    maxRecordBytes: schema.maxRecordBytes,
    maxArrayLength: schema.maxArrayLength,
    allowFloat: false,
    breakingChangeCreatesNewVersion: true,
  });
  void feedSchemaFor;
  return runCertificationSuite(computeCertificationSubject(observation, { nowUnix }), feed);
}

export function evaluateComputeIndependence(observation: ComputeSourceObservation) {
  return evaluateIndependence(computeCertificationSubject(observation, { relatedSameController: true }));
}

export function fabricThenCertify(
  observation: ComputeSourceObservation,
  nowUnix = 1_700_000_000n,
):
  | { readonly ok: true; readonly record: ReturnType<typeof certifyComputeObservation> }
  | { readonly ok: false; readonly error: ComputeRefusal } {
  const ingested = ingestComputeObservation(observation, nowUnix);
  if (!ingested.ok) {
    return ingested;
  }
  return { ok: true, record: certifyComputeObservation(observation, nowUnix) };
}

export function computeCertificationDoesNotMint(): false {
  return CERTIFICATION_MINTS_MOONREY;
}

export function schemaIdForScenario(scenario: ComputeCertificationScenario): ComputeSchemaId {
  switch (scenario) {
    case 'CPU_EXECUTION':
    case 'GENERIC_COMPUTE_MISSING_CLASS':
      return 'CPU_USAGE_V1';
    case 'AI_INFERENCE_TOKENS':
    case 'TOKENS_AS_GPU_SECONDS':
    case 'TRAINING_LABELED_INFERENCE':
    case 'RAW_PROMPT':
      return 'AI_INFERENCE_USAGE_V1';
    case 'AI_TRAINING_GPU':
      return 'AI_TRAINING_USAGE_V1';
    case 'CAPACITY_INVENTORY':
      return 'AI_COMPUTE_CAPACITY_V1';
    default:
      return 'GPU_USAGE_V1';
  }
}
