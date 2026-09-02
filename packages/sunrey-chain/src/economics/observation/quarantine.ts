/**
 * Wave 4 — quarantine path for rejected observations.
 *
 * Invalid records are stored for audit. They do not silently disappear.
 */

import { asUtcInstant } from '../../../../domain/src/time.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { QuarantinedObservation, NormalizationRejectionCode } from './types.ts';
import type { RawSourceRecord } from './source.ts';
import { buildSourcePreservation, provenanceRefOf, rawPayloadDigest } from './source.ts';

export type QuarantineRegistry = {
  readonly quarantine: (entry: QuarantinedObservation) => void;
  readonly list: () => readonly QuarantinedObservation[];
  readonly count: () => number;
  readonly findBySourceRecordId: (sourceRecordId: string) => QuarantinedObservation | null;
};

export function createQuarantineRegistry(): QuarantineRegistry {
  const entries: QuarantinedObservation[] = [];

  return Object.freeze({
    quarantine(entry: QuarantinedObservation) {
      entries.push(entry);
    },
    list() {
      return Object.freeze([...entries]);
    },
    count() {
      return entries.length;
    },
    findBySourceRecordId(sourceRecordId: string) {
      return entries.find((e) => e.source.sourceRecordId === sourceRecordId) ?? null;
    },
  });
}

export function quarantineRejected(
  record: RawSourceRecord,
  code: NormalizationRejectionCode,
  message: string,
  rejectedAt: UtcInstant,
  quarantineId: string,
): QuarantinedObservation {
  const provenanceRef = provenanceRefOf(record);
  return Object.freeze({
    quarantineId,
    rejectedAt,
    code,
    message,
    source: buildSourcePreservation(record, provenanceRef),
    providerId: record.providerId,
    economicDomain: record.economicDomain ?? null,
    metric: record.metric ?? null,
    duplicateFingerprint: null,
    rawPayloadDigest: record.rawPayload ? rawPayloadDigest(record.rawPayload) : provenanceRef,
  });
}

export function defaultRejectedAt(nowIso: string): UtcInstant {
  return asUtcInstant(nowIso);
}
