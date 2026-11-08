import type { UtcInstant } from '@solstice/domain';

import type { EvolChallengerNomination, ForwardCohortExperimentEvidence } from './types.ts';
import type { MemberOutcomeInput } from './comparison.ts';
import type { ForwardCohort } from './types.ts';
import { buildCohortComparison } from './comparison.ts';
import { bootstrapCohortShadowCapital, verifyIsolatedShadowPosture } from './shadow-capital.ts';
import { evaluateAlpha20ForwardExperimentsQualification } from './qualification.ts';

export function runForwardCohortExperimentPipeline(input: {
  readonly cohort: ForwardCohort;
  readonly comparedAt: UtcInstant;
  readonly memberOutcomes: readonly MemberOutcomeInput[];
  readonly shadowRegisteredAt: UtcInstant;
  readonly evolNominationsAccepted?: readonly EvolChallengerNomination[];
  readonly campaignRewriteAttemptBlocked?: boolean;
}): {
  readonly evidence: ForwardCohortExperimentEvidence;
  readonly qualification: ReturnType<typeof evaluateAlpha20ForwardExperimentsQualification>;
} {
  const shadowLedger = bootstrapCohortShadowCapital({
    cohort: input.cohort,
    registeredAt: input.shadowRegisteredAt,
  });
  if (!verifyIsolatedShadowPosture(shadowLedger)) {
    throw new Error('ALPHA20 shadow capital posture verification failed');
  }

  const comparison = buildCohortComparison({
    cohort: input.cohort,
    comparedAt: input.comparedAt,
    memberOutcomes: input.memberOutcomes,
    shadowLedger,
  });

  const evidence: ForwardCohortExperimentEvidence = Object.freeze({
    schema: input.cohort.schema,
    experimentId: input.cohort.experimentId,
    cohort: input.cohort,
    comparison,
    evolNominationsAccepted: Object.freeze([...(input.evolNominationsAccepted ?? [])]),
    campaignRewriteAttemptBlocked: input.campaignRewriteAttemptBlocked ?? false,
    qualificationMarker: 'HELIOS_ALPHA20_FORWARD_EXPERIMENTS_BLOCKED',
  });

  const qualification = evaluateAlpha20ForwardExperimentsQualification(evidence);
  const marked = Object.freeze({
    ...evidence,
    qualificationMarker: qualification.marker,
  });

  return Object.freeze({ evidence: marked, qualification });
}
