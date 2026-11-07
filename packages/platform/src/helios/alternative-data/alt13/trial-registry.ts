/**
 * HELIOS ALT13 — feature hypothesis trial registry (EVOL09 FDR integration).
 */

import type { UtcInstant } from '@solstice/domain';

import { benjaminiHochbergFdr } from '../../strategy-evolution/evol09/stats.ts';
import { ALT13_FDR_LEVEL } from './taxonomy.ts';
import type {
  Alt13MultipleTestingSummary,
  AltFeatureHypothesisTrialRecord,
  AlternativeSignalHypothesisId,
} from './types.ts';

export type AltFeatureTrialRegistry = {
  readonly recordTrial: (input: Omit<AltFeatureHypothesisTrialRecord, 'trialId'> & { trialId?: string }) => AltFeatureHypothesisTrialRecord;
  readonly listTrials: () => readonly AltFeatureHypothesisTrialRecord[];
  readonly buildMultipleTestingSummary: () => Alt13MultipleTestingSummary;
};

export function createAltFeatureHypothesisTrialRegistry(): AltFeatureTrialRegistry {
  const trials: AltFeatureHypothesisTrialRecord[] = [];
  let seq = 0;

  return Object.freeze({
    recordTrial: (input) => {
      seq += 1;
      const trialId = input.trialId ?? `alt13:trial:${String(seq).padStart(5, '0')}`;
      const record: AltFeatureHypothesisTrialRecord = Object.freeze({
        trialId,
        hypothesisId: input.hypothesisId,
        featureId: input.featureId,
        recordedAt: input.recordedAt,
        target: input.target,
        rawPValues: Object.freeze([...input.rawPValues]),
        outcome: input.outcome,
      });
      trials.push(record);
      return record;
    },
    listTrials: () => Object.freeze([...trials]),
    buildMultipleTestingSummary: () => summarizeAltTrialsWithEvol09(trials),
  });
}

export function summarizeAltTrialsWithEvol09(
  trials: readonly AltFeatureHypothesisTrialRecord[],
): Alt13MultipleTestingSummary {
  const rawPValues = trials.flatMap((t) => t.rawPValues.filter((p) => p !== null && Number.isFinite(p)));
  const fdr = benjaminiHochbergFdr({ pValues: rawPValues, q: ALT13_FDR_LEVEL });

  const rejected = new Set<AlternativeSignalHypothesisId>();
  let pIndex = 0;
  for (const trial of trials) {
    for (const p of trial.rawPValues) {
      if (p === null || !Number.isFinite(p)) continue;
      if (fdr.rejected[pIndex]) {
        rejected.add(trial.hypothesisId);
      }
      pIndex += 1;
    }
  }

  return Object.freeze({
    trialCount: trials.length,
    fdrLevel: ALT13_FDR_LEVEL,
    adjustedPValues: Object.freeze([...fdr.adjustedPValues]),
    rejectedHypothesisIds: Object.freeze([...rejected]),
    evol09Schema: 'sunrey.helios.strategy-evolution.evol09.v1',
  });
}

export function assertEveryHypothesisTrialRecorded(
  before: number,
  after: number,
  expectedIncrement: number,
): boolean {
  return after >= before + expectedIncrement;
}

export type { UtcInstant };
