/**
 * Bounded off-chain batch ingestion.
 *
 * Deterministic order, per-record results, partial-failure isolation,
 * and idempotency. One bad record cannot corrupt good records.
 * Partial provider success is not oracle quorum.
 */

import { sha256Hex } from '../../../../../security/src/hash.ts';
import { admitCollection } from './admission.ts';
import {
  FABRIC_MAX_BATCH_SIZE,
  fabricRejection,
  type AdmissionMode,
  type BatchIngestResult,
  type BatchRecordResult,
  type CollectionCandidate,
  type EconomicDataCollectionEnvelope,
} from './types.ts';

export class EconomicDataFabricStore {
  private readonly byEnvelopeId = new Map<string, EconomicDataCollectionEnvelope>();
  private readonly byIdempotency = new Map<string, EconomicDataCollectionEnvelope>();

  get(envelopeId: string): EconomicDataCollectionEnvelope | undefined {
    return this.byEnvelopeId.get(envelopeId);
  }

  list(): readonly EconomicDataCollectionEnvelope[] {
    return [...this.byEnvelopeId.values()].sort((left, right) => (left.envelopeId < right.envelopeId ? -1 : 1));
  }

  idempotencyKey(input: CollectionCandidate): string {
    return sha256Hex(
      `edf.idem.v1:${input.providerId}:${input.sourceId}:${input.sourceObservationId}:${input.contentCommitment}`,
    );
  }

  put(envelope: EconomicDataCollectionEnvelope, key: string): void {
    this.byEnvelopeId.set(envelope.envelopeId, envelope);
    this.byIdempotency.set(key, envelope);
  }

  findReplay(input: CollectionCandidate): EconomicDataCollectionEnvelope | undefined {
    return this.byIdempotency.get(this.idempotencyKey(input));
  }
}

function compareCandidates(left: CollectionCandidate, right: CollectionCandidate): number {
  const leftKey = `${left.providerId}:${left.sourceId}:${left.sourceObservationId}:${left.contentCommitment}`;
  const rightKey = `${right.providerId}:${right.sourceId}:${right.sourceObservationId}:${right.contentCommitment}`;
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}

export function ingestBatch(
  records: readonly CollectionCandidate[],
  mode: AdmissionMode,
  nowUnix: bigint,
  store: EconomicDataFabricStore = new EconomicDataFabricStore(),
): BatchIngestResult {
  if (records.length > FABRIC_MAX_BATCH_SIZE) {
    const rejection = fabricRejection('BATCH_LIMIT_EXCEEDED', `batch size ${records.length} exceeds ${FABRIC_MAX_BATCH_SIZE}`);
    return Object.freeze({
      accepted: Object.freeze([]),
      rejected: Object.freeze(
        records.map((row) =>
          Object.freeze({
            ok: false as const,
            code: rejection.code,
            detail: rejection.detail,
            sourceObservationId: row.sourceObservationId,
          }),
        ),
      ),
      results: Object.freeze(
        records.map((row) =>
          Object.freeze({
            ok: false as const,
            code: rejection.code,
            detail: rejection.detail,
            sourceObservationId: row.sourceObservationId,
          }),
        ),
      ),
      fabricCountsAsQuorum: false,
    });
  }
  const ordered = [...records].sort(compareCandidates);
  const results: BatchRecordResult[] = [];
  const accepted: EconomicDataCollectionEnvelope[] = [];
  const rejected: BatchRecordResult[] = [];
  for (const record of ordered) {
    const replay = store.findReplay(record);
    if (replay) {
      const result: BatchRecordResult = Object.freeze({
        ok: true,
        envelope: replay,
        replay: true,
      });
      results.push(result);
      accepted.push(replay);
      continue;
    }
    const admitted = admitCollection(record, mode, nowUnix);
    if (!admitted.ok) {
      const result: BatchRecordResult = Object.freeze({
        ok: false,
        code: admitted.error.code,
        detail: admitted.error.detail,
        sourceObservationId: record.sourceObservationId,
      });
      results.push(result);
      rejected.push(result);
      continue;
    }
    store.put(admitted.value, store.idempotencyKey(record));
    const result: BatchRecordResult = Object.freeze({
      ok: true,
      envelope: admitted.value,
      replay: false,
    });
    results.push(result);
    accepted.push(admitted.value);
  }
  return Object.freeze({
    accepted: Object.freeze(accepted),
    rejected: Object.freeze(rejected),
    results: Object.freeze(results),
    fabricCountsAsQuorum: false,
  });
}
