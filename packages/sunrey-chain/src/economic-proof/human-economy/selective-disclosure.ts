/**
 * Integration boundaries for future selective disclosure, verifiable credentials,
 * zero-knowledge proofs, and privacy-preserving computation.
 *
 * No cryptography is implemented here. Mature implementations plug in later.
 */

export type VerifiableCredentialPresentation = {
  readonly credentialType: string;
  readonly issuerRef: string;
  readonly subjectCommitment: string;
  readonly disclosedClaims: readonly string[];
  readonly proofBundleRef: string | null;
};

export type SelectiveDisclosureRequest = {
  readonly credentialPresentation: VerifiableCredentialPresentation;
  readonly requestedAttributes: readonly string[];
  readonly purposeRef: string;
  readonly recipientRef: string;
};

export type SelectiveDisclosureResult = {
  readonly disclosedAttributeCommitments: readonly string[];
  readonly withheldAttributeCount: number;
  readonly proofBundleRef: string | null;
};

export type ZeroKnowledgeProofRequest = {
  readonly statementRef: string;
  readonly publicInputsCommitment: string;
  readonly proofBundleRef: string | null;
};

export type ZeroKnowledgeProofVerification = {
  readonly verified: boolean;
  readonly verifierRef: string;
  readonly statementRef: string;
};

export type PrivacyPreservingComputationRequest = {
  readonly computationRef: string;
  readonly inputCommitments: readonly string[];
  readonly outputPolicyRef: string;
  readonly enclaveAttestationRef: string | null;
};

export type PrivacyPreservingComputationResult = {
  readonly outputCommitment: string;
  readonly computationRef: string;
  readonly rawInputsExposed: false;
};

/**
 * Port interfaces for future hardening. Implementations remain external.
 */
export type VerifiableCredentialPort = {
  readonly present: (
    request: SelectiveDisclosureRequest,
  ) => Promise<SelectiveDisclosureResult>;
};

export type ZeroKnowledgeProofPort = {
  readonly verify: (
    request: ZeroKnowledgeProofRequest,
  ) => Promise<ZeroKnowledgeProofVerification>;
};

export type PrivacyPreservingComputationPort = {
  readonly execute: (
    request: PrivacyPreservingComputationRequest,
  ) => Promise<PrivacyPreservingComputationResult>;
};

export type SelectiveDisclosureBoundary = {
  readonly verifiableCredential: VerifiableCredentialPort | null;
  readonly zeroKnowledgeProof: ZeroKnowledgeProofPort | null;
  readonly privacyPreservingComputation: PrivacyPreservingComputationPort | null;
};

export const UNCONFIGURED_SELECTIVE_DISCLOSURE_BOUNDARY: SelectiveDisclosureBoundary = Object.freeze({
  verifiableCredential: null,
  zeroKnowledgeProof: null,
  privacyPreservingComputation: null,
});

export function selectiveDisclosureAvailable(boundary: SelectiveDisclosureBoundary): boolean {
  return boundary.verifiableCredential !== null
    || boundary.zeroKnowledgeProof !== null
    || boundary.privacyPreservingComputation !== null;
}
