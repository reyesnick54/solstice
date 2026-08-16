/**
 * Chunk 36R / 39 canonical evidence formats.
 *
 * These are protocol evidence objects, not Evidence Vault records and not
 * ActionIntents. Only cryptographically provable equivocation may trigger
 * automatic deterministic penalties. Missed votes are not Byzantine fraud.
 */

export const EQUIVOCATION_EVIDENCE_TYPES = [
  'DOUBLE_PROPOSAL',
  'DOUBLE_PREVOTE',
  'DOUBLE_PRECOMMIT',
] as const;

export const RESERVED_EVIDENCE_TYPES = [
  'INVALID_STATE_PROPOSAL',
  'CONSENSUS_LIVENESS_VIOLATION',
] as const;

export type EquivocationEvidenceType = (typeof EQUIVOCATION_EVIDENCE_TYPES)[number];
export type ReservedEvidenceType = (typeof RESERVED_EVIDENCE_TYPES)[number];
export type EvidenceType = EquivocationEvidenceType | ReservedEvidenceType;

export const AUTOMATIC_PENALTY_EVIDENCE_TYPES: readonly EquivocationEvidenceType[] =
  EQUIVOCATION_EVIDENCE_TYPES;

export function allowsAutomaticPenalty(type: EvidenceType): boolean {
  return (AUTOMATIC_PENALTY_EVIDENCE_TYPES as readonly string[]).includes(type);
}

export type CanonicalConsensusMessage = {
  readonly networkId: string;
  readonly chainId: string;
  readonly validatorId: string;
  readonly height: bigint;
  readonly round: number;
  readonly messageType: 'PROPOSAL' | 'PREVOTE' | 'PRECOMMIT';
  readonly blockId: string;
  readonly validatorSetHash: string;
  readonly publicKey: string;
  readonly signature: string;
};

export type EquivocationEvidence = {
  readonly evidenceType: EquivocationEvidenceType;
  readonly left: CanonicalConsensusMessage;
  readonly right: CanonicalConsensusMessage;
};
