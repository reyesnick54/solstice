/**
 * Provenance and lineage — shared upstream sources must not masquerade as independent corroboration.
 */

import { createHash } from 'node:crypto';

import type { ExternalObservation } from '../../../../provider-sdk/src/types.ts';
import type { ObservationLineageRecord, SourceIndependence } from './types.ts';

export function buildLineageRecord(input: {
  readonly observation: ExternalObservation<unknown>;
  readonly upstreamSourceRef?: string | null;
  readonly sourceFamily?: string | null;
  readonly parentLineageIds?: readonly string[];
  readonly duplicateEventKey?: string | null;
}): ObservationLineageRecord {
  const upstreamSourceRef = input.upstreamSourceRef ?? null;
  const sourceFamily = input.sourceFamily ?? input.observation.source.dataset;
  const duplicateEventKey =
    input.duplicateEventKey ??
    computeDuplicateEventKey(input.observation, upstreamSourceRef);

  const lineageId = computeLineageId({
    providerId: input.observation.providerId,
    upstreamSourceRef,
    duplicateEventKey,
    rawPayloadHash: input.observation.provenance.rawPayloadHash,
  });

  return Object.freeze({
    lineageId,
    parentLineageIds: Object.freeze([...(input.parentLineageIds ?? [])]),
    upstreamSourceRef,
    sourceFamily,
    duplicateEventKey,
  });
}

export function computeDuplicateEventKey(
  observation: ExternalObservation<unknown>,
  upstreamSourceRef: string | null,
): string {
  const parts = [
    upstreamSourceRef ?? '',
    observation.time.sourceTimestamp ?? '',
    observation.source.dataset,
    observation.capability,
    observation.provenance.rawPayloadHash,
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

export function computeLineageId(input: {
  readonly providerId: string;
  readonly upstreamSourceRef: string | null;
  readonly duplicateEventKey: string;
  readonly rawPayloadHash: string;
}): string {
  const material = [
    input.providerId,
    input.upstreamSourceRef ?? '',
    input.duplicateEventKey,
    input.rawPayloadHash,
  ].join('|');
  return `hln_${createHash('sha256').update(material).digest('hex').slice(0, 32)}`;
}

export function assessSourceIndependence(
  lineage: ObservationLineageRecord,
  priorDuplicateEventKeys: ReadonlySet<string>,
  priorUpstreamRefs: ReadonlySet<string>,
): SourceIndependence {
  if (lineage.duplicateEventKey && priorDuplicateEventKeys.has(lineage.duplicateEventKey)) {
    return 'DUPLICATE';
  }
  if (lineage.upstreamSourceRef && priorUpstreamRefs.has(lineage.upstreamSourceRef)) {
    return 'SHARED_UPSTREAM';
  }
  if (!lineage.upstreamSourceRef && !lineage.sourceFamily) {
    return 'UNKNOWN';
  }
  return 'INDEPENDENT';
}

export function sharedUpstreamNotIndependent(
  independence: SourceIndependence,
): boolean {
  return independence === 'SHARED_UPSTREAM' || independence === 'DUPLICATE';
}
