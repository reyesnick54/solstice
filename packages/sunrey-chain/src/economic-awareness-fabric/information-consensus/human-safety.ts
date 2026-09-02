/**
 * Human economy safety extensions for Information Consensus.
 *
 * Human contributions may rely on attestations, credentials, receipts,
 * research IDs, employment verification, computation receipts, and
 * authorized data proofs. Full SunRey Human Contribution intelligence
 * is Wave 6 — this module provides extensibility only.
 */

import type { NormalizedEconomicObservation } from '../types.ts';
import type { ExplanationCode } from './types.ts';

export const HUMAN_EVIDENCE_SOURCE_CLASSES = [
  'ATTESTATION',
  'CREDENTIAL',
  'RECEIPT',
  'RESEARCH_REFERENCE',
  'EMPLOYMENT_VERIFICATION',
  'COMPUTATION_RECEIPT',
  'AUTHORIZED_DATA_PROOF',
] as const;

export type HumanEvidenceSourceClass = (typeof HUMAN_EVIDENCE_SOURCE_CLASSES)[number];

export function isHumanEvidenceSourceClass(value: string): value is HumanEvidenceSourceClass {
  return (HUMAN_EVIDENCE_SOURCE_CLASSES as readonly string[]).includes(value);
}

export function assessHumanEvidence(
  observations: readonly NormalizedEconomicObservation[],
): { readonly satisfied: boolean; readonly codes: readonly ExplanationCode[] } {
  const codes: ExplanationCode[] = [];
  const humanEvidence = observations.filter((row) => isHumanEvidenceSourceClass(row.sourceClass));
  if (humanEvidence.length === 0) {
    codes.push('HUMAN_ATTESTATION_REQUIRED');
    return Object.freeze({ satisfied: false, codes: Object.freeze(codes) });
  }
  codes.push('HUMAN_ATTESTATION_PRESENT');
  return Object.freeze({ satisfied: true, codes: Object.freeze(codes) });
}

export const HUMAN_ATTESTATION_MESH_SOURCE_CLASSES = [
  'PRIMARY_INSTITUTION',
  'EMPLOYER',
  'EDUCATIONAL_INSTITUTION',
  'RESEARCH_PUBLISHER',
  'RESEARCH_REGISTRY',
  'CREDENTIAL_ISSUER',
  'GOVERNMENT',
  'SIGNED_COMPUTATION_RECEIPT',
  'SIGNED_WORK_RECEIPT',
  'PEER_ATTESTATION',
  'USER_SELF_ATTESTATION',
  'AUTHORIZED_DATA_PROVIDER',
  'OTHER_GOVERNANCE_APPROVED',
] as const;

export type HumanAttestationMeshSourceClass = (typeof HUMAN_ATTESTATION_MESH_SOURCE_CLASSES)[number];

export function isHumanAttestationMeshSourceClass(value: string): value is HumanAttestationMeshSourceClass {
  return (HUMAN_ATTESTATION_MESH_SOURCE_CLASSES as readonly string[]).includes(value);
}

export const HUMAN_CONSENSUS_EXTENSIONS = Object.freeze({
  allowProductiveOracleLogicBlindly: false,
  supportsAttestations: true,
  supportsCredentials: true,
  supportsComputationReceipts: true,
  supportsAttestationMesh: true,
  selfAttestationMaySoleVerify: false,
  endpointCountIsNotIndependence: true,
  wave6AttestationMeshImplemented: true,
  wave6FullIntelligenceDeferred: false,
});
