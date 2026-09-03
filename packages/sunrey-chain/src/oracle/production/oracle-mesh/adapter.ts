// @ts-nocheck
/**
 * Oracle observation adapter — every productive source produces the
 * canonical Wave 4 economic observation envelope.
 *
 * No provider-specific object bypasses normalization, provenance,
 * rights/license, source lineage, freshness, or integrity.
 */

import {
  ECONOMIC_OBSERVATION_SCHEMA_VERSION,
  type ProofFreshnessState,
  type ProofSourceClass,
} from '../../../economic-proof/constants.ts';
import type { EconomicObservation } from '../../../economic-proof/types.ts';
import { sha256Hex } from '../../../../../security/src/hash.ts';
import type { ProductiveOracleSourceClass, ProductiveSourceRecord } from './types.ts';

const OBSERVATION_AUTHORITY = Object.freeze({
  mintsNativeAsset: false as const,
  issuesExecutionAuthority: false as const,
  setsExchangePrice: false as const,
  authorizesGovernance: false as const,
});

/** Map productive oracle source class to economic-proof source class. */
const SOURCE_CLASS_MAP: Readonly<Record<ProductiveOracleSourceClass, ProofSourceClass>> = Object.freeze({
  DIRECT_SENSOR: 'SENSOR_NETWORK',
  PRIMARY_OPERATOR: 'INSTITUTIONAL',
  UTILITY_OR_GRID: 'INSTITUTIONAL',
  ENTERPRISE_SYSTEM: 'INSTITUTIONAL',
  GOVERNMENT: 'PUBLIC_REFERENCE',
  SATELLITE: 'SENSOR_NETWORK',
  GEOSPATIAL: 'SENSOR_NETWORK',
  LOGISTICS_OPERATOR: 'INSTITUTIONAL',
  NETWORK_OPERATOR: 'INSTITUTIONAL',
  MARKET_REFERENCE: 'PUBLIC_REFERENCE',
  ACADEMIC: 'PUBLIC_REFERENCE',
  DERIVED_MODEL: 'CERTIFIED_CANDIDATE',
  AGGREGATOR: 'CERTIFIED_CANDIDATE',
});

export type AdapterRejection =
  | 'MISSING_PROVENANCE'
  | 'INVALID_RIGHTS'
  | 'UNKNOWN_SOURCE_CLASS'
  | 'FRESHNESS_UNKNOWN'
  | 'PROVIDER_UNAVAILABLE';

export type AdapterResult =
  | { readonly ok: true; readonly observation: EconomicObservation }
  | { readonly ok: false; readonly code: AdapterRejection; readonly detail: string };

export function deriveObservationId(record: ProductiveSourceRecord): string {
  return sha256Hex(
    `oracle-mesh.obs.v1:${record.providerId}:${record.sourceRecordId}:${record.datasetOriginId}`,
  );
}

export function adaptProductiveSourceRecord(record: ProductiveSourceRecord): AdapterResult {
  if (!record.evidenceRef || record.evidenceRef.trim().length === 0) {
    return { ok: false, code: 'MISSING_PROVENANCE', detail: 'provenance evidence is required' };
  }
  if (!record.rights.commercialUsePermitted) {
    return { ok: false, code: 'INVALID_RIGHTS', detail: 'commercial use not permitted' };
  }
  if (!record.providerAvailable) {
    return { ok: false, code: 'PROVIDER_UNAVAILABLE', detail: 'provider operationally unavailable' };
  }
  if (record.freshnessState === 'EXPIRED') {
    return { ok: false, code: 'FRESHNESS_UNKNOWN', detail: 'expired observation rejected at adapter' };
  }

  const proofSourceClass = SOURCE_CLASS_MAP[record.sourceClass];
  if (!proofSourceClass) {
    return { ok: false, code: 'UNKNOWN_SOURCE_CLASS', detail: record.sourceClass };
  }

  const observationId = deriveObservationId(record);
  const maxAgeSeconds = freshnessMaxAge(record.freshnessState);

  const observation: EconomicObservation = Object.freeze({
    schemaVersion: ECONOMIC_OBSERVATION_SCHEMA_VERSION,
    observationId,
    providerId: record.providerId,
    sourceClass: proofSourceClass,
    economicDomain: 'PRODUCTIVE_ECONOMIC',
    subjectRef: record.subjectRef,
    resourceRef: record.resourceRef,
    metric: record.metric,
    quantity: Object.freeze({
      value: record.value,
      unit: record.unit,
      metric: record.metric,
    }),
    observedAtUtc: record.observedAtUtc,
    receivedAtUtc: record.receivedAtUtc,
    geographicContext: Object.freeze({
      jurisdiction: 'UNSCOPED',
      region: null,
      locality: null,
    }),
    jurisdiction: 'UNSCOPED',
    provenanceRef: Object.freeze({
      provenanceId: record.evidenceRef,
      sourceId: record.providerId,
      method: `oracle-mesh:${record.sourceClass}`,
      collectedAtUtc: record.receivedAtUtc,
    }),
    evidenceRefs: Object.freeze([record.evidenceRef]),
    licenseRef: Object.freeze({
      licenseId: record.rights.licenseId,
      licenseClass: record.rights.commercialUsePermitted ? 'PUBLIC_DERIVED_ALLOWED' : 'EXTERNAL_RESTRICTED',
      permittedUseDigest: record.payloadDigest,
    }),
    verificationStatus: 'PENDING',
    confidence: Object.freeze({
      scoreBps: 5_000,
      sampleCount: 1,
      notesRef: `dataset-origin:${record.datasetOriginId}`,
    }),
    freshness: Object.freeze({
      state: record.freshnessState,
      observedAtUtc: record.observedAtUtc,
      receivedAtUtc: record.receivedAtUtc,
      maxAgeSeconds,
      expiresAtUtc: record.observedAtUtc,
    }),
    integrity: 'INTACT',
    simulation: true as const,
    authority: OBSERVATION_AUTHORITY,
  });

  return { ok: true, observation };
}

function freshnessMaxAge(state: ProofFreshnessState): bigint {
  switch (state) {
    case 'FRESH':
      return 3_600n;
    case 'AGING':
      return 7_200n;
    case 'STALE':
      return 86_400n;
    default:
      return 0n;
  }
}
