/**
 * Regulatory Digital Twin may simulate operating-scope changes.
 * It may not upgrade a row to EXTERNALLY_VERIFIED.
 */

export const TWIN_CAN_EXTERNALLY_VERIFY = false as const;

export function twinCannotUpgradeToExternallyVerified(proposedStatus: string): string {
  if (proposedStatus === 'EXTERNALLY_VERIFIED' || proposedStatus === 'ELIGIBLE_CANDIDATE') {
    return 'UNDER_REVIEW';
  }
  return proposedStatus;
}

export function twinOperatingScopeSimulation(input: {
  readonly currentStatus: string;
  readonly proposedStatus: string;
}): {
  readonly status: string;
  readonly externallyVerified: false;
  readonly twinCanExternallyVerify: false;
} {
  const status = twinCannotUpgradeToExternallyVerified(input.proposedStatus);
  return Object.freeze({
    status,
    externallyVerified: false,
    twinCanExternallyVerify: false,
  });
}
