/**
 * Product verification states for HIN contribution records.
 *
 * These overlay the canonical registry lifecycle. They do not replace
 * Chunk 109 verification decisions and do not authorize minting.
 */

import type { ContributionLifecycleState, SourceClass, VerificationQuality } from '../taxonomy.ts';

export const HIN_VERIFICATION_STATES = [
  'UNVERIFIED',
  'SELF_DECLARED',
  'SOURCE_VERIFIED',
  'SYSTEM_VERIFIED',
  'DISPUTED',
  'INVALIDATED',
] as const;
export type HinVerificationState = (typeof HIN_VERIFICATION_STATES)[number];

export const HIN_VERIFICATION_TREATMENT = Object.freeze({
  UNVERIFIED: Object.freeze({ eligibleForValueInput: false, weightBps: 0n }),
  SELF_DECLARED: Object.freeze({ eligibleForValueInput: true, weightBps: 2500n }),
  SOURCE_VERIFIED: Object.freeze({ eligibleForValueInput: true, weightBps: 7000n }),
  SYSTEM_VERIFIED: Object.freeze({ eligibleForValueInput: true, weightBps: 10000n }),
  DISPUTED: Object.freeze({ eligibleForValueInput: false, weightBps: 0n }),
  INVALIDATED: Object.freeze({ eligibleForValueInput: false, weightBps: 0n }),
});

export function isHinVerificationState(value: string): value is HinVerificationState {
  return (HIN_VERIFICATION_STATES as readonly string[]).includes(value);
}

export function mapRegistryToHinVerification(input: {
  readonly status: ContributionLifecycleState;
  readonly sourceClass: SourceClass;
  readonly verificationQuality: VerificationQuality;
  readonly disputed: boolean;
  readonly invalidated?: boolean;
}): HinVerificationState {
  if (input.invalidated || input.status === 'REJECTED') {
    return 'INVALIDATED';
  }
  if (input.disputed) {
    return 'DISPUTED';
  }
  if (input.status === 'VERIFIED') {
    return 'SYSTEM_VERIFIED';
  }
  if (input.sourceClass === 'USER_DECLARED' || input.verificationQuality === 'USER_DECLARED') {
    return 'SELF_DECLARED';
  }
  if (
    input.sourceClass === 'VERIFIED_INSTITUTIONAL_ATTESTATION' ||
    input.sourceClass === 'VERIFIED_COMMUNITY_ATTESTATION' ||
    input.sourceClass === 'VERIFIED_PROFESSIONAL_ATTESTATION' ||
    input.sourceClass === 'VERIFIED_RESEARCH_ATTESTATION' ||
    input.sourceClass === 'HUMAN_INFORMATION_NETWORK' ||
    input.verificationQuality === 'ATTESTED' ||
    input.verificationQuality === 'AUTHORITATIVE_REFERENCE'
  ) {
    return input.status === 'OBSERVED' || input.status === 'SUBMITTED' || input.status === 'VERIFICATION_REQUIRED'
      ? 'SOURCE_VERIFIED'
      : 'SOURCE_VERIFIED';
  }
  return 'UNVERIFIED';
}

export function verificationWeightBps(state: HinVerificationState): bigint {
  return HIN_VERIFICATION_TREATMENT[state].weightBps;
}

export function verificationEligibleForValueInput(state: HinVerificationState): boolean {
  return HIN_VERIFICATION_TREATMENT[state].eligibleForValueInput;
}
