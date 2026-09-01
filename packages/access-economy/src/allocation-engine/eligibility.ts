/**
 * Participant eligibility for Access allocation.
 * Does not independently implement compliance — delegates to ports where applicable.
 */

import type { SubjectRef } from '../ids.ts';
import type {
  AccessAllocationPolicy,
  EligibilityPort,
  ParticipantAllocationInput,
  ParticipantWeightResult,
} from './types.ts';
export type { EligibilityPort } from './types.ts';
import type { AccessAllocationCategory } from '../dual-token-allocation/types.ts';

export type EligibilityCheckInput = {
  readonly subjectRef: SubjectRef;
  readonly participant: ParticipantAllocationInput;
  readonly policy: AccessAllocationPolicy;
  readonly sunReyTwab: bigint;
  readonly moonReyTwab: bigint;
  readonly participantWeightScaled: bigint;
  readonly eligibilityPort: EligibilityPort;
};

export function checkParticipantEligibility(input: EligibilityCheckInput): {
  readonly eligible: boolean;
  readonly reason: string | null;
} {
  if (!input.policy.enabled) {
    return Object.freeze({ eligible: false, reason: 'ACCESS_PROGRAM_DISABLED' });
  }
  if (!input.eligibilityPort.isProgramEnabled()) {
    return Object.freeze({ eligible: false, reason: 'ACCESS_PROGRAM_DISABLED' });
  }
  if (input.participant.restricted === true || input.eligibilityPort.isSubjectRestricted(input.subjectRef)) {
    return Object.freeze({ eligible: false, reason: 'ACCOUNT_RESTRICTED' });
  }
  if (
    input.participant.jurisdictionAllowed === false ||
    !input.eligibilityPort.isJurisdictionAllowed(input.subjectRef)
  ) {
    return Object.freeze({ eligible: false, reason: 'JURISDICTION_NOT_ALLOWED' });
  }
  const min = input.policy.minimumEligibility;
  if (input.sunReyTwab < min.minimumSunReyTwab) {
    return Object.freeze({ eligible: false, reason: 'BELOW_MINIMUM_SR_TWAB' });
  }
  if (input.moonReyTwab < min.minimumMoonReyTwab) {
    return Object.freeze({ eligible: false, reason: 'BELOW_MINIMUM_MR_TWAB' });
  }
  if (input.participantWeightScaled < min.minimumParticipantWeightScaled) {
    return Object.freeze({ eligible: false, reason: 'BELOW_MINIMUM_PARTICIPANT_WEIGHT' });
  }
  return Object.freeze({ eligible: true, reason: null });
}

export function defaultEligibilityPort(): EligibilityPort {
  return Object.freeze({
    isProgramEnabled: () => true,
    isSubjectRestricted: () => false,
    isJurisdictionAllowed: () => true,
  });
}

export function filterEligibleWeights(
  weights: readonly ParticipantWeightResult[],
): readonly ParticipantWeightResult[] {
  return Object.freeze(weights.filter((row) => row.eligible && row.participantWeightScaled > 0n));
}

export function eligibleForCategory(
  weights: readonly ParticipantWeightResult[],
  category: AccessAllocationCategory,
): readonly ParticipantWeightResult[] {
  return Object.freeze(weights.filter((row) => row.category === category && row.eligible));
}
