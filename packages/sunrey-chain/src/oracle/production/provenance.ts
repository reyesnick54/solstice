import { createHash } from 'node:crypto';

import { commitCanonical } from '../../hash.ts';
import type { AuthenticationMethod, OracleCollectorVersion, SourceProvenance, UnitCode } from './types.ts';
import { COLLECTOR_VERSION } from './types.ts';

export function contentHashOf(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function recordProvenance(input: {
  readonly providerId: string;
  readonly sourceId: string;
  readonly sourceObservationId: string;
  readonly collectionTimestampUnix: bigint;
  readonly sourceTimestampUnix: bigint;
  readonly schemaVersionRecord: number;
  readonly unit: UnitCode;
  readonly normalizationVersion: string;
  readonly credentialRefHref: string | null;
  readonly authMethod: AuthenticationMethod;
  readonly payload: unknown;
  readonly collectorVersion?: OracleCollectorVersion;
}): SourceProvenance {
  const contentHash = contentHashOf(input.payload);
  return Object.freeze({
    schemaVersion: 1,
    providerId: input.providerId,
    sourceId: input.sourceId,
    sourceObservationId: input.sourceObservationId,
    collectionTimestampUnix: input.collectionTimestampUnix,
    sourceTimestampUnix: input.sourceTimestampUnix,
    schemaVersionRecord: input.schemaVersionRecord,
    unit: input.unit,
    normalizationVersion: input.normalizationVersion,
    credentialRefHref: input.credentialRefHref,
    authMethod: input.authMethod,
    collectorVersion: input.collectorVersion ?? COLLECTOR_VERSION,
    contentHash,
  });
}

export function provenanceCommitment(row: SourceProvenance): string {
  return commitCanonical({
    domain: 'sunrey.oracle.provenance.v1',
    providerId: row.providerId,
    sourceId: row.sourceId,
    sourceObservationId: row.sourceObservationId,
    collectionTimestampUnix: row.collectionTimestampUnix.toString(),
    sourceTimestampUnix: row.sourceTimestampUnix.toString(),
    schemaVersionRecord: row.schemaVersionRecord,
    unit: row.unit,
    normalizationVersion: row.normalizationVersion,
    credentialRefHref: row.credentialRefHref,
    authMethod: row.authMethod,
    collectorVersion: row.collectorVersion,
    contentHash: row.contentHash,
  });
}
