import { randomUUID } from 'node:crypto';
import type { UtcInstant } from '@solstice/domain';
import type { CalibrationRecord } from './types.ts';
import type { ConfidenceState } from './taxonomy.ts';
import type { MetaAllocationCandidateId } from './ids.ts';

export function recordConfidencePrediction(input: {
  readonly candidateId: MetaAllocationCandidateId;
  readonly predictedConfidenceState: ConfidenceState;
  readonly predictedProbabilityBps: number | null;
  readonly now: UtcInstant;
}): CalibrationRecord {
  return Object.freeze({
    recordId: `cal_${randomUUID()}`,
    candidateId: input.candidateId,
    predictedConfidenceState: input.predictedConfidenceState,
    predictedProbabilityBps: input.predictedProbabilityBps,
    observedOutcome: 'PENDING',
    recordedAt: input.now,
  });
}
