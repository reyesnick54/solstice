/**
 * Wave 4 provenance node and edge taxonomy.
 * Chain of custody: provider record → observation → evidence → fact → claim.
 */

export const PROVENANCE_NODE_KINDS = [
  'provider_record',
  'observation',
  'normalized_observation',
  'evidence',
  'verified_fact',
  'economic_claim',
  'economic_output',
] as const;

export type ProvenanceNodeKind = (typeof PROVENANCE_NODE_KINDS)[number];

export const PROVENANCE_EDGE_KINDS = [
  'RECEIVED_AS',
  'NORMALIZED_TO',
  'REJECTED_FROM',
  'DEDUPLICATED_TO',
  'LINKED_TO',
  'RESOLVED_TO',
  'EVIDENCE_FROM',
  'VERIFIED_FROM',
  'CLAIM_FROM',
  'DEPENDED_ON',
  'MERGED_FROM',
] as const;

export type ProvenanceEdgeKind = (typeof PROVENANCE_EDGE_KINDS)[number];

export type ProvenanceNodeId = string & { readonly __brand: 'ProvenanceNodeId' };

export function asProvenanceNodeId(value: string): ProvenanceNodeId {
  if (value.length === 0) {
    throw new TypeError('ProvenanceNodeId must be non-empty');
  }
  return value as ProvenanceNodeId;
}

export type ProvenanceNode = {
  readonly nodeId: ProvenanceNodeId;
  readonly kind: ProvenanceNodeKind;
  readonly contentCommitment: string | null;
  readonly rawPayloadHash: string | null;
  readonly providerId: string | null;
  readonly capability: string | null;
  readonly dataset: string | null;
  readonly createdAt: string;
  readonly metadata: Readonly<Record<string, string>>;
};

export type ProvenanceEdge = {
  readonly edgeId: string;
  readonly kind: ProvenanceEdgeKind;
  readonly fromNodeId: ProvenanceNodeId;
  readonly toNodeId: ProvenanceNodeId;
  readonly createdAt: string;
  readonly eventId: string | null;
};

export const QUARANTINE_REASON_CODES = [
  'SCHEMA_ERROR',
  'RIGHTS_FAILURE',
  'PROVIDER_FAILURE',
  'NORMALIZATION_FAILURE',
  'INTEGRITY_FAILURE',
  'DUPLICATE_TRANSPORT',
] as const;

export type QuarantineReasonCode = (typeof QUARANTINE_REASON_CODES)[number];

export type QuarantinedObservation = {
  readonly quarantineId: string;
  readonly reasonCode: QuarantineReasonCode;
  readonly reasonSafe: string;
  readonly idempotencyKey: string;
  readonly providerId: string;
  readonly capability: string;
  readonly rawPayloadHash: string | null;
  readonly quarantinedAt: string;
  readonly retryable: boolean;
  readonly eventId: string | null;
};
