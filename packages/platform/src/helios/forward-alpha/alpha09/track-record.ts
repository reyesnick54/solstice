/**
 * HELIOS Forward Alpha ALPHA09 — minimum forward track-record requirements.
 */

import { ALPHA09_TRACK_RECORD_POLICIES, type Alpha09HorizonClass } from './taxonomy.ts';
import type { ForwardAlpha09TrackRecordAssessment } from './types.ts';

export function assessForwardAlphaTrackRecord(input: {
  readonly horizonClass: Alpha09HorizonClass;
  readonly observationDays: number;
  readonly independentOpportunityCount: number;
  readonly periodCount: number;
}): ForwardAlpha09TrackRecordAssessment {
  const policy = ALPHA09_TRACK_RECORD_POLICIES[input.horizonClass];
  const meetsDurationRequirement = input.observationDays >= policy.minimumCalendarDays;
  const meetsOpportunityRequirement =
    input.independentOpportunityCount >= policy.minimumIndependentOpportunities;
  const adequateForSharpeStyleMetrics = input.periodCount >= policy.minimumPeriodsForSharpe;
  const adequateForTailEvidence = input.periodCount >= policy.minimumPeriodsForTailEs;

  const notes: string[] = [];
  if (!meetsDurationRequirement) {
    notes.push(
      `Calendar span ${String(input.observationDays)}d is below ${String(policy.minimumCalendarDays)}d required for ${input.horizonClass}.`,
    );
  }
  if (!meetsOpportunityRequirement) {
    notes.push(
      `Independent opportunity count ${String(input.independentOpportunityCount)} is below ${String(policy.minimumIndependentOpportunities)} required for ${input.horizonClass}.`,
    );
  }
  if (!adequateForSharpeStyleMetrics) {
    notes.push(
      `Period count ${String(input.periodCount)} is below ${String(policy.minimumPeriodsForSharpe)} for Sharpe-style ratio stability.`,
    );
  }
  if (!adequateForTailEvidence) {
    notes.push(
      `Period count ${String(input.periodCount)} is below ${String(policy.minimumPeriodsForTailEs)} for tail / expected-shortfall evidence.`,
    );
  }

  return Object.freeze({
    schema: 'sunrey.helios.forward-alpha.track-record.v1',
    horizonClass: input.horizonClass,
    observationDays: input.observationDays,
    independentOpportunityCount: input.independentOpportunityCount,
    periodCount: input.periodCount,
    requiredMinimumCalendarDays: policy.minimumCalendarDays,
    requiredMinimumOpportunities: policy.minimumIndependentOpportunities,
    requiredMinimumPeriodsForSharpe: policy.minimumPeriodsForSharpe,
    requiredMinimumPeriodsForTailEs: policy.minimumPeriodsForTailEs,
    meetsDurationRequirement,
    meetsOpportunityRequirement,
    adequateForSharpeStyleMetrics,
    adequateForTailEvidence,
    notes: Object.freeze(notes),
  });
}
