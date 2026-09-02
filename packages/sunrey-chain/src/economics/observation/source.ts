/**
 * Wave 4 — raw source record and source preservation.
 *
 * Normalization never erases provider identity. Every normalized
 * observation remains traceable to its source record.
 */

import { sha256Hex } from '../../../../security/src/hash.ts';
import type { EconomicDomain, SourceClass, SourcePreservation } from './types.ts';

export const RAW_SOURCE_RECORD_SCHEMA = 'sunrey.economic-raw-source-record.v1' as const;

export type RawSourceRecord = {
  readonly schemaVersion: typeof RAW_SOURCE_RECORD_SCHEMA;
  readonly providerId: string;
  readonly sourceClass: SourceClass;
  readonly sourceRecordId: string;
  readonly sourceDatasetId: string;
  readonly providerSchemaId: string;
  readonly providerSchemaVersion: string;
  readonly subjectOrResourceId: string;
  readonly economicDomain: EconomicDomain;
  readonly category: string;
  readonly metric: string;
  readonly value: bigint;
  readonly unit: string;
  readonly observedAt?: string | null;
  readonly periodStart?: string | null;
  readonly periodEnd?: string | null;
  readonly receivedAt: string;
  readonly aggregationHint?: 'INSTANT' | 'PERIOD' | null;
  readonly geography?: {
    readonly country?: string | null;
    readonly region?: string | null;
    readonly city?: string | null;
    readonly jurisdiction?: string | null;
    readonly facilityRef?: string | null;
    readonly gridZone?: string | null;
    readonly precision?: string | null;
    readonly publicDisclosureAllowed?: boolean | null;
  };
  readonly license?: string | null;
  readonly rightsScope?: string | null;
  readonly consentReference?: string | null;
  readonly purposeReference?: string | null;
  readonly canonicalEntityId?: string | null;
  readonly eventId?: string | null;
  readonly lineageParentIds?: readonly string[];
  readonly extensionFields?: Readonly<Record<string, string | boolean | number | null>>;
  readonly rawPayload?: string | null;
};

export function buildSourcePreservation(
  record: RawSourceRecord,
  provenanceRef: string,
): SourcePreservation {
  return Object.freeze({
    providerId: record.providerId,
    sourceRecordId: record.sourceRecordId,
    sourceDatasetId: record.sourceDatasetId,
    providerSchemaVersion: record.providerSchemaVersion,
    providerSchemaId: record.providerSchemaId,
    provenanceRef,
    rawValueRef: record.rawPayload ? rawPayloadDigest(record.rawPayload) : null,
  });
}

export function rawPayloadDigest(payload: string): string {
  return sha256Hex(['sunrey.economic-raw-payload.v1', payload].join('|'));
}

export function provenanceRefOf(record: RawSourceRecord): string {
  return sha256Hex(
    [
      'sunrey.economic-provenance.v1',
      record.providerId,
      record.sourceRecordId,
      record.sourceDatasetId,
      record.providerSchemaId,
      record.providerSchemaVersion,
    ].join('|'),
  );
}

export function evidenceHashOf(record: RawSourceRecord, normalizedDigest: string): string {
  return sha256Hex(
    [
      'sunrey.economic-evidence.v1',
      provenanceRefOf(record),
      normalizedDigest,
      record.metric,
      record.value.toString(),
      record.unit,
    ].join('|'),
  );
}

/** Supported provider schema versions — new versions require explicit adapter. */
export const SUPPORTED_PROVIDER_SCHEMA_VERSIONS: Readonly<Record<string, readonly number[]>> = Object.freeze({
  'energy.grid-generation.v1': Object.freeze([1]),
  'compute.gpu-utilization.v1': Object.freeze([1]),
  'manufacturing.output.v1': Object.freeze([1]),
  'agriculture.yield.v1': Object.freeze([1]),
  'research.publication-metrics.v1': Object.freeze([1]),
  'workforce.employment.v1': Object.freeze([1]),
  'health.public-surveillance.v1': Object.freeze([1]),
  'geospatial.reference.v1': Object.freeze([1]),
});

export function isSupportedSchemaVersion(schemaId: string, version: number): boolean {
  const supported = SUPPORTED_PROVIDER_SCHEMA_VERSIONS[schemaId];
  if (!supported) return false;
  return supported.includes(version);
}

export function parseSchemaVersion(version: string): number | null {
  const parsed = Number.parseInt(version, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
