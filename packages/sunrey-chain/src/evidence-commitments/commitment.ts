import { commitCanonical } from '../hash.ts';

import {
  EVIDENCE_COMMITMENT_DOMAIN,
  EVIDENCE_COMMITMENT_SCHEMA_VERSION,
} from './constants.ts';

export type EvidenceVerificationMetadata = {
  readonly verificationMethod: string;
  readonly verificationState: string;
  readonly policyVersion: string;
  readonly verifierRef: string;
};

export type EvidenceCommitmentInput = {
  readonly evidenceId: string;
  readonly evidenceType: string;
  readonly contentHash: string;
  readonly provenanceHash: string;
  readonly issuerProvider: string;
  readonly temporalRef: string;
  readonly verification: EvidenceVerificationMetadata;
};

export type EvidenceCommitment = EvidenceCommitmentInput & {
  readonly schemaVersion: typeof EVIDENCE_COMMITMENT_SCHEMA_VERSION;
  readonly commitmentHash: string;
};

function sortedVerification(verification: EvidenceVerificationMetadata): EvidenceVerificationMetadata {
  return Object.freeze({
    verificationMethod: verification.verificationMethod,
    verificationState: verification.verificationState,
    policyVersion: verification.policyVersion,
    verifierRef: verification.verifierRef,
  });
}

export function evidenceCommitmentMaterial(input: EvidenceCommitmentInput): string {
  return commitCanonical({
    domain: EVIDENCE_COMMITMENT_DOMAIN,
    schemaVersion: EVIDENCE_COMMITMENT_SCHEMA_VERSION,
    evidenceId: input.evidenceId,
    evidenceType: input.evidenceType,
    contentHash: input.contentHash,
    provenanceHash: input.provenanceHash,
    issuerProvider: input.issuerProvider,
    temporalRef: input.temporalRef,
    verification: sortedVerification(input.verification),
  });
}

export function createEvidenceCommitment(input: EvidenceCommitmentInput): EvidenceCommitment {
  if (!/^[0-9a-f]{64}$/i.test(input.contentHash)) {
    throw new TypeError('contentHash must be a 64-char lowercase hex digest');
  }
  if (!/^[0-9a-f]{64}$/i.test(input.provenanceHash)) {
    throw new TypeError('provenanceHash must be a 64-char lowercase hex digest');
  }
  const commitmentHash = evidenceCommitmentMaterial(input);
  return Object.freeze({
    schemaVersion: EVIDENCE_COMMITMENT_SCHEMA_VERSION,
    ...input,
    verification: sortedVerification(input.verification),
    commitmentHash,
  });
}

export function assertEvidenceCommitment(commitment: EvidenceCommitment): boolean {
  return evidenceCommitmentMaterial(commitment) === commitment.commitmentHash;
}
