/**
 * Wave 4 economic chain-of-custody events.
 * Hash-only payloads — no raw provider content or secrets.
 * Integrates with the canonical events taxonomy.
 */

import type { UtcInstant } from '@solstice/domain';
import type { VersionedEvent } from '@solstice/events';

export const ECONOMIC_PROVENANCE_EVENT_TYPES = [
  'ProviderRecordReceived',
  'ObservationNormalized',
  'ObservationRejected',
  'ObservationDeduplicated',
  'ObservationLinked',
  'EntityResolved',
  'EvidenceCreated',
  'FactVerified',
  'ClaimCreated',
  'ClaimChallenged',
  'ClaimResolved',
] as const;

export type EconomicProvenanceEventType = (typeof ECONOMIC_PROVENANCE_EVENT_TYPES)[number];

/** Shared reference fields — digests only, never raw payloads. */
export type EconomicProvenanceRefs = {
  readonly providerId: string;
  readonly capability: string;
  readonly dataset: string;
  readonly providerRecordId: string | null;
  readonly observationId: string | null;
  readonly normalizedObservationId: string | null;
  readonly evidenceId: string | null;
  readonly factId: string | null;
  readonly claimId: string | null;
  readonly entityId: string | null;
  readonly requestId: string | null;
  readonly idempotencyKey: string;
  readonly rawPayloadHash: string | null;
  readonly contentCommitment: string | null;
  readonly parentNodeIds: readonly string[];
  readonly correlationId: string | null;
};

export type ProviderRecordReceivedPayload = EconomicProvenanceRefs & {
  readonly receivedAt: string;
  readonly transportEventId: string;
};

export type ObservationLifecyclePayload = EconomicProvenanceRefs & {
  readonly transformationKind: string | null;
  readonly reasonCode: string | null;
  readonly detail: string | null;
};

export type EntityResolvedPayload = EconomicProvenanceRefs & {
  readonly resolutionKind: string;
  readonly resolvedEntityRef: string;
};

export type EvidenceCreatedPayload = EconomicProvenanceRefs & {
  readonly evidenceKind: string;
  readonly grantsDecision: false;
};

export type FactVerifiedPayload = EconomicProvenanceRefs & {
  readonly verificationMethod: string;
  readonly verifierRef: string;
};

export type ClaimLifecyclePayload = EconomicProvenanceRefs & {
  readonly claimKind: string;
  readonly challengeReason: string | null;
  readonly resolutionOutcome: string | null;
};

export type ProviderRecordReceivedV1 = VersionedEvent<'ProviderRecordReceived', 1, ProviderRecordReceivedPayload>;
export type ObservationNormalizedV1 = VersionedEvent<'ObservationNormalized', 1, ObservationLifecyclePayload>;
export type ObservationRejectedV1 = VersionedEvent<'ObservationRejected', 1, ObservationLifecyclePayload>;
export type ObservationDeduplicatedV1 = VersionedEvent<'ObservationDeduplicated', 1, ObservationLifecyclePayload>;
export type ObservationLinkedV1 = VersionedEvent<'ObservationLinked', 1, ObservationLifecyclePayload>;
export type EntityResolvedV1 = VersionedEvent<'EntityResolved', 1, EntityResolvedPayload>;
export type EvidenceCreatedV1 = VersionedEvent<'EvidenceCreated', 1, EvidenceCreatedPayload>;
export type FactVerifiedV1 = VersionedEvent<'FactVerified', 1, FactVerifiedPayload>;
export type ClaimCreatedV1 = VersionedEvent<'ClaimCreated', 1, ClaimLifecyclePayload>;
export type ClaimChallengedV1 = VersionedEvent<'ClaimChallenged', 1, ClaimLifecyclePayload>;
export type ClaimResolvedV1 = VersionedEvent<'ClaimResolved', 1, ClaimLifecyclePayload>;

export type EconomicProvenanceEvent =
  | ProviderRecordReceivedV1
  | ObservationNormalizedV1
  | ObservationRejectedV1
  | ObservationDeduplicatedV1
  | ObservationLinkedV1
  | EntityResolvedV1
  | EvidenceCreatedV1
  | FactVerifiedV1
  | ClaimCreatedV1
  | ClaimChallengedV1
  | ClaimResolvedV1;

export type EconomicProvenancePayloadMap = {
  readonly ProviderRecordReceived: ProviderRecordReceivedPayload;
  readonly ObservationNormalized: ObservationLifecyclePayload;
  readonly ObservationRejected: ObservationLifecyclePayload;
  readonly ObservationDeduplicated: ObservationLifecyclePayload;
  readonly ObservationLinked: ObservationLifecyclePayload;
  readonly EntityResolved: EntityResolvedPayload;
  readonly EvidenceCreated: EvidenceCreatedPayload;
  readonly FactVerified: FactVerifiedPayload;
  readonly ClaimCreated: ClaimLifecyclePayload;
  readonly ClaimChallenged: ClaimLifecyclePayload;
  readonly ClaimResolved: ClaimLifecyclePayload;
};

export function createEconomicProvenanceEvent<T extends EconomicProvenanceEventType>(
  eventType: T,
  occurredAt: UtcInstant,
  payload: EconomicProvenancePayloadMap[T],
): VersionedEvent<T, 1, EconomicProvenancePayloadMap[T]> {
  const event: VersionedEvent<T, 1, EconomicProvenancePayloadMap[T]> = {
    eventType,
    schemaVersion: 1,
    occurredAt,
    payload,
  };
  return Object.freeze(event);
}
