import type { UtcInstant } from '@solstice/domain';
import { trialIdFromConfig } from './ids.ts';
import type { EarningsTrialRecord } from './types.ts';
import type { TrialId } from './ids.ts';

export type EarningsTrialRegistrySnapshot = {
  readonly trials: readonly EarningsTrialRecord[];
};

export type EarningsTrialRegistry = {
  readonly listTrials: () => readonly EarningsTrialRecord[];
  readonly recordTrial: (input: Omit<EarningsTrialRecord, 'trialId' | 'recordedAt'> & {
    readonly recordedAt: UtcInstant;
    readonly trialId?: TrialId;
  }) => EarningsTrialRecord;
  readonly snapshot: () => EarningsTrialRegistrySnapshot;
};

export function createEarningsTrialRegistry(): EarningsTrialRegistry {
  const trials: EarningsTrialRecord[] = [];

  return Object.freeze({
    listTrials: () => Object.freeze([...trials]),
    recordTrial: (input) => {
      const trialId =
        input.trialId ??
        trialIdFromConfig({
          features: input.featureCombination,
          thresholds: input.thresholds,
          genome: input.genomeRef,
          model: input.modelRef,
          hyperparameters: input.hyperparameters,
        });
      const record: EarningsTrialRecord = Object.freeze({
        trialId,
        recordedAt: input.recordedAt,
        outcome: input.outcome,
        featureCombination: Object.freeze([...input.featureCombination]),
        thresholds: Object.freeze({ ...input.thresholds }),
        genomeRef: input.genomeRef,
        modelRef: input.modelRef,
        hyperparameters: Object.freeze({ ...input.hyperparameters }),
        failureReason: input.failureReason,
      });
      trials.push(record);
      return record;
    },
    snapshot: () => Object.freeze({ trials: Object.freeze([...trials]) }),
  });
}

/** Trials are append-only; registries must not expose deletion. */
export function assertTrialRegistryAppendOnly(before: number, after: number): boolean {
  return after >= before;
}
