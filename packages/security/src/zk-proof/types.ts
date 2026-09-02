export type CapabilityClassification = 'IMPLEMENTED' | 'PARTIAL' | 'INTERFACE_ONLY' | 'FUTURE';

export const ZERO_KNOWLEDGE_PROOF_CAPABILITY: CapabilityClassification = 'INTERFACE_ONLY';

export const ZK_PROOF_KINDS = [
  'THRESHOLD',
  'MEMBERSHIP',
  'CREDENTIAL_POSSESSION',
  'AUTHORIZED_COMPUTATION',
] as const;

export type ZkProofKind = (typeof ZK_PROOF_KINDS)[number];

export type ZkProofRequest = {
  readonly proofKind: ZkProofKind;
  readonly purposeId: string;
  readonly subjectCommitment: string;
  readonly statementCommitment: string;
  readonly publicInputs?: Readonly<Record<string, string>>;
};

export type ZkProofResult = {
  readonly verified: boolean;
  readonly proofEnvelope: string | null;
  readonly circuitId: string | null;
  readonly rawWitnessIncluded: false;
};

export type ZkProofFailure = {
  readonly code: 'ZK_PROVIDER_UNAVAILABLE' | 'ZK_PROOF_INVALID' | 'ZK_PURPOSE_MISMATCH';
  readonly message: string;
};

export type ZkProofOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ZkProofFailure };

export type ZKProofProvider = {
  readonly capability: typeof ZERO_KNOWLEDGE_PROOF_CAPABILITY | 'PARTIAL' | 'IMPLEMENTED';
  prove(request: ZkProofRequest): Promise<ZkProofOutcome<ZkProofResult>>;
  verify(request: ZkProofRequest, proofEnvelope: string): Promise<ZkProofOutcome<true>>;
};

export function zkOk<T>(value: T): ZkProofOutcome<T> {
  return Object.freeze({ ok: true, value });
}

export function zkErr(error: ZkProofFailure): ZkProofOutcome<never> {
  return Object.freeze({ ok: false, error });
}
