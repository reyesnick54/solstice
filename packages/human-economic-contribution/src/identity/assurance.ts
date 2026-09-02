export const IDENTITY_ASSURANCE_LEVELS = [
  'UNVERIFIED',
  'ACCOUNT_VERIFIED',
  'CREDENTIAL_VERIFIED',
  'IDENTITY_VERIFIED',
  'HIGH_ASSURANCE',
] as const;

export type IdentityAssuranceLevel = (typeof IDENTITY_ASSURANCE_LEVELS)[number];

const RANK: Record<IdentityAssuranceLevel, number> = {
  UNVERIFIED: 1,
  ACCOUNT_VERIFIED: 2,
  CREDENTIAL_VERIFIED: 3,
  IDENTITY_VERIFIED: 4,
  HIGH_ASSURANCE: 5,
};

export function identityAssuranceAtLeast(
  actual: IdentityAssuranceLevel,
  required: IdentityAssuranceLevel,
): boolean {
  return RANK[actual] >= RANK[required];
}

export function assuranceFromProviderSignals(input: {
  readonly accountVerified: boolean;
  readonly credentialVerified: boolean;
  readonly identityVerified: boolean;
  readonly highAssuranceStepUp: boolean;
}): IdentityAssuranceLevel {
  if (input.highAssuranceStepUp && input.identityVerified) {
    return 'HIGH_ASSURANCE';
  }
  if (input.identityVerified) {
    return 'IDENTITY_VERIFIED';
  }
  if (input.credentialVerified) {
    return 'CREDENTIAL_VERIFIED';
  }
  if (input.accountVerified) {
    return 'ACCOUNT_VERIFIED';
  }
  return 'UNVERIFIED';
}

/**
 * Contribution classes may require different assurance. Thresholds are policy-defined elsewhere.
 */
export function assuranceMeetsContributionRequirement(
  actual: IdentityAssuranceLevel,
  required: IdentityAssuranceLevel,
): boolean {
  return identityAssuranceAtLeast(actual, required);
}
