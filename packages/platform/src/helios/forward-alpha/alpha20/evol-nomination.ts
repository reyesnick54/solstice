import type { UtcInstant } from '@solstice/domain';

import type { EvolChallengerNomination, ForwardCohort, ForwardTreatmentStrategy } from './types.ts';
import { createForwardTreatmentStrategy } from './strategies.ts';
import { assertPreregistrationUnchanged } from './preregistration.ts';

export type AcceptEvolChallengerInput = {
  readonly nominationId: string;
  readonly genomeId: string;
  readonly parameterVectorFingerprint: string;
  readonly nominatedAt: UtcInstant;
  readonly trialFamilyId: string;
  readonly memberId: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly shadowCapitalRegistrationId: string;
  readonly assignedOpportunityIds: readonly string[];
};

/**
 * EVOL may nominate challenger candidates before campaign start only.
 */
export function acceptEvolChallengerNomination(
  cohort: ForwardCohort,
  input: AcceptEvolChallengerInput,
): { readonly nomination: EvolChallengerNomination; readonly strategy: ForwardTreatmentStrategy } {
  if (cohort.lifecycle.state !== 'SEALED') {
    throw new Error('ALPHA20 EVOL challenger nomination only permitted before campaign start');
  }

  const nomination: EvolChallengerNomination = Object.freeze({
    nominationId: input.nominationId,
    genomeId: input.genomeId,
    parameterVectorFingerprint: input.parameterVectorFingerprint,
    nominatedAt: input.nominatedAt,
    trialFamilyId: input.trialFamilyId,
  });

  const strategy = createForwardTreatmentStrategy({
    memberId: input.memberId,
    strategyId: input.strategyId,
    strategyVersion: input.strategyVersion,
    role: 'CHALLENGER',
    shadowCapitalRegistrationId: input.shadowCapitalRegistrationId,
    assignedOpportunityIds: input.assignedOpportunityIds,
    evolNominationRef: input.nominationId,
  });

  return Object.freeze({ nomination, strategy });
}

/**
 * EVOL cannot rewrite campaign preregistration or opportunity set after start.
 */
export function rejectCampaignRewriteAfterStart(
  cohort: ForwardCohort,
  proposedPreregistrationFingerprint: string,
): void {
  if (cohort.lifecycle.state === 'SEALED') {
    return;
  }
  if (proposedPreregistrationFingerprint !== cohort.preregistration.preregistrationFingerprint) {
    throw new Error('ALPHA20 EVOL campaign rewrite forbidden after experiment start');
  }
}

export function assertEvolCannotMutateActiveCampaign(
  before: ForwardCohort,
  afterPreregistrationFingerprint: string,
): never {
  rejectCampaignRewriteAfterStart(before, afterPreregistrationFingerprint);
  assertPreregistrationUnchanged(before.preregistration, {
    ...before.preregistration,
    preregistrationFingerprint: afterPreregistrationFingerprint,
  });
  throw new Error('ALPHA20 EVOL post-start mutation unreachable');
}
