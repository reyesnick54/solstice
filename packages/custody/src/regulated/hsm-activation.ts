export const CUSTODY_SIGNER_ACTIVATION_STATES = [
  'SIMULATION_SIGNER',
  'SOFTWARE_SIGNER',
  'EXTERNAL_HSM_CONFIGURED',
  'EXTERNAL_HSM_VERIFIED',
] as const;
export type CustodySignerActivationState = (typeof CUSTODY_SIGNER_ACTIVATION_STATES)[number];

export type CustodyActivationRecord = {
  readonly signerState: CustodySignerActivationState;
  readonly providerId: string;
  readonly healthy: boolean;
  readonly policyEvidenceRef: string | null;
  readonly configuredPolicyEvidence: boolean;
  readonly verifiedExternalHsm: boolean;
  readonly productionCandidateRequiresEvidence: true;
};

export function recordCustodyActivation(input: {
  readonly signerState: CustodySignerActivationState;
  readonly providerId: string;
  readonly healthy: boolean;
  readonly policyEvidenceRef?: string;
}): CustodyActivationRecord {
  const verified = input.signerState === 'EXTERNAL_HSM_VERIFIED' && Boolean(input.policyEvidenceRef);
  return Object.freeze({
    signerState: verified ? 'EXTERNAL_HSM_VERIFIED' : input.signerState === 'EXTERNAL_HSM_VERIFIED' ? 'EXTERNAL_HSM_CONFIGURED' : input.signerState,
    providerId: input.providerId,
    healthy: input.healthy,
    policyEvidenceRef: input.policyEvidenceRef ?? null,
    configuredPolicyEvidence: Boolean(input.policyEvidenceRef),
    verifiedExternalHsm: verified,
    productionCandidateRequiresEvidence: true,
  });
}

export function hsmUnavailableSafeOutcome(record: CustodyActivationRecord): {
  readonly signingAllowed: false;
  readonly reason: 'HSM_UNAVAILABLE' | 'SIGNER_UNHEALTHY';
} {
  void record;
  return Object.freeze({ signingAllowed: false, reason: 'HSM_UNAVAILABLE' as const });
}
