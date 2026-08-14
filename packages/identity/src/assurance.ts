export const AUTHENTICATION_ASSURANCES = [
  'LOW',
  'STANDARD',
  'STRONG',
  'HIGH_ASSURANCE',
] as const;

export type AuthenticationAssurance = (typeof AUTHENTICATION_ASSURANCES)[number];

const RANK: Record<AuthenticationAssurance, number> = {
  LOW: 1,
  STANDARD: 2,
  STRONG: 3,
  HIGH_ASSURANCE: 4,
};

export function assuranceAtLeast(
  actual: AuthenticationAssurance,
  required: AuthenticationAssurance,
): boolean {
  return RANK[actual] >= RANK[required];
}

export function assuranceFromFactors(
  factors: readonly string[],
  stepUp: boolean,
): AuthenticationAssurance {
  if (stepUp && factors.includes('PASSKEY')) {
    return 'HIGH_ASSURANCE';
  }
  if (factors.includes('PASSKEY') || factors.includes('HARDWARE_KEY')) {
    return 'STRONG';
  }
  if (factors.includes('TOTP') || factors.includes('RECOVERY')) {
    return 'STANDARD';
  }
  return 'LOW';
}
