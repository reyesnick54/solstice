/**
 * HELIOS EVOL09 — EvolutionTrialRegistry: append-only log of every genome evaluation (trial).
 */

import type { UtcInstant } from '@solstice/domain';

import { evolutionTrialIdFromFingerprint } from './ids.ts';
import type {
  EvolutionTrialId,
  EvolutionTrialRecord,
  GenomeEvaluationOrigin,
  GenomeEvaluationOutcome,
} from './types.ts';

export type EvolutionTrialRegistrySnapshot = {
  readonly trials: readonly EvolutionTrialRecord[];
};

export type RecordEvolutionTrialInput = Omit<
  EvolutionTrialRecord,
  'trialId' | 'recordedAt' | 'researchReturns' | 'behavioralSignature'
> & {
  readonly recordedAt: UtcInstant;
  readonly trialId?: EvolutionTrialId;
  readonly researchReturns: readonly number[];
  readonly behavioralSignature?: readonly number[] | null;
};

export type EvolutionTrialRegistry = {
  readonly recordTrial: (input: RecordEvolutionTrialInput) => EvolutionTrialRecord;
  readonly listTrials: () => readonly EvolutionTrialRecord[];
  readonly snapshot: () => EvolutionTrialRegistrySnapshot;
};

export function createEvolutionTrialRegistry(): EvolutionTrialRegistry {
  const trials: EvolutionTrialRecord[] = [];
  let seq = 0;

  return Object.freeze({
    recordTrial: (input) => {
      seq += 1;
      const trialId =
        input.trialId ??
        evolutionTrialIdFromFingerprint({
          genomeId: input.genomeId,
          generation: input.generation,
          origin: input.origin,
          recordedAtIso: input.recordedAt,
          seq,
        });
      const record: EvolutionTrialRecord = Object.freeze({
        trialId,
        recordedAt: input.recordedAt,
        genomeId: input.genomeId,
        generation: input.generation,
        origin: input.origin,
        outcome: input.outcome,
        strategyFamilyId: input.strategyFamilyId,
        featureFamilyId: input.featureFamilyId,
        parameterVectorFingerprint: input.parameterVectorFingerprint,
        researchReturns: Object.freeze([...input.researchReturns]),
        behavioralSignature:
          input.behavioralSignature === undefined || input.behavioralSignature === null
            ? null
            : Object.freeze([...input.behavioralSignature]),
      });
      trials.push(record);
      return record;
    },
    listTrials: () => Object.freeze([...trials]),
    snapshot: () => Object.freeze({ trials: Object.freeze([...trials]) }),
  });
}

export function assertEveryGenomeEvaluationCounts(
  beforeCount: number,
  afterCount: number,
  minimumIncrement: number,
): boolean {
  return afterCount >= beforeCount + minimumIncrement;
}

/** Exhaustive check helper for callers that switch on origin. */
export function isGenomeEvaluationOrigin(value: string): value is GenomeEvaluationOrigin {
  return (
    value === 'INITIAL' ||
    value === 'MUTATION' ||
    value === 'CROSSOVER' ||
    value === 'PARAMETER_SEARCH' ||
    value === 'CMA_ES_SAMPLE' ||
    value === 'LLM_GENERATED' ||
    value === 'MANUAL' ||
    value === 'FAILED_COMPILE' ||
    value === 'ABORTED'
  );
}

export function isGenomeEvaluationOutcome(value: string): value is GenomeEvaluationOutcome {
  return value === 'COMPLETED' || value === 'FAILED' || value === 'ABORTED';
}
