export type CapabilityClassification = 'IMPLEMENTED' | 'PARTIAL' | 'INTERFACE_ONLY' | 'FUTURE';

/**
 * Minimal W3C Verifiable Credentials alignment. SunRey does not invent a
 * proprietary credential standard; mature VC verification plugs in here.
 */
export const VERIFIABLE_CREDENTIALS_CAPABILITY: CapabilityClassification = 'INTERFACE_ONLY';

export type VerifiableCredentialProof = {
  readonly type: string;
  readonly proofPurpose: string;
  readonly verificationMethod: string;
  readonly proofValue?: string;
};

export type VerifiableCredential = {
  readonly '@context': readonly string[];
  readonly type: readonly string[];
  readonly issuer: string | { readonly id: string };
  readonly issuanceDate: string;
  readonly expirationDate?: string;
  readonly credentialSubject: Readonly<Record<string, unknown>>;
  readonly proof?: VerifiableCredentialProof;
};

export type CredentialVerificationResult = {
  readonly valid: boolean;
  readonly issuerDid: string;
  readonly disclosedClaimNames: readonly string[];
  readonly rawCredentialReturned: false;
  readonly reasonCode?: string;
};

export type CredentialVerificationFailure = {
  readonly code: 'CREDENTIAL_PROOF_FAILED' | 'CREDENTIAL_EXPIRED' | 'ISSUER_UNTRUSTED' | 'VC_ADAPTER_UNAVAILABLE';
  readonly message: string;
};
