/**
 * EARN09 service — estimate probabilistic earnings state and apply post-outcome learning.
 */

import type { UtcInstant } from '@solstice/domain';
import { estimateProbabilisticEarningsState } from './estimator.ts';
import { recordConformalResidual } from './conformal.ts';
import { buildCalibrationSnapshot, type CalibrationObservation } from './calibration.ts';
import { earningsDecimalToNumber, parseEarningsDecimal } from './numeric.ts';
import { assertOutcomeStrictlyPrior, updateExpertReliabilityFromOutcome } from './reliability.ts';
import type {
  ApplyEarningsOutcomeInput,
  EstimateProbabilisticEarningsStateInput,
  ProbabilisticEarningsState,
} from './types.ts';
import {
  createEarningsStateEstimatorStore,
  emptyEarningsStateEstimatorStore,
  type EarningsStateEstimatorStore,
} from './store.ts';

export type HeliosEarningsStateEstimatorServiceOptions = {
  readonly store?: EarningsStateEstimatorStore;
};

export type HeliosEarningsStateEstimatorService = {
  estimate(input: EstimateProbabilisticEarningsStateInput): ProbabilisticEarningsState;
  applyOutcome(input: ApplyEarningsOutcomeInput): { readonly updated: boolean; readonly calibrationAppended: boolean };
  storeSnapshot(): ReturnType<EarningsStateEstimatorStore['snapshot']>;
};

export function createHeliosEarningsStateEstimatorService(
  options: HeliosEarningsStateEstimatorServiceOptions = {},
): HeliosEarningsStateEstimatorService {
  const store = options.store ?? createEarningsStateEstimatorStore(emptyEarningsStateEstimatorStore());

  return Object.freeze({
    estimate: (input) => estimateProbabilisticEarningsState(input, store.snapshot()),
    applyOutcome: (input) => applyOutcomeLearning(store, input),
    storeSnapshot: () => store.snapshot(),
  });
}

function applyOutcomeLearning(
  store: EarningsStateEstimatorStore,
  input: ApplyEarningsOutcomeInput,
): { readonly updated: boolean; readonly calibrationAppended: boolean } {
  if (!assertOutcomeStrictlyPrior(input.outcome.outcomeKnownAt, input.appliedAt)) {
    return Object.freeze({ updated: false, calibrationAppended: false });
  }
  let updated = false;
  for (const signal of input.expertSignalsAtDecision) {
    const current = store.snapshot().reliabilityByExpert[signal.expertKind];
    if (!current) continue;
    const next = updateExpertReliabilityFromOutcome({
      record: current,
      signal,
      outcome: input.outcome,
      appliedAt: input.appliedAt,
    });
    if (next) {
      store.setReliability(signal.expertKind, next);
      updated = true;
    }
  }

  const actualEps = parseEarningsDecimal(input.outcome.actualEps);
  const actualRevenue = parseEarningsDecimal(input.outcome.actualRevenue);
  if (actualEps.ok) {
    store.appendConformalResidual(
      recordConformalResidual({
        target: 'nextQuarterEps',
        fiscalPeriodKey: input.outcome.fiscalPeriodKey,
        outcomeKnownAt: input.outcome.outcomeKnownAt,
        predicted: input.priorState.nextQuarterEps.studentT.mean,
        actual: earningsDecimalToNumber(actualEps.scaled),
        scale: input.priorState.nextQuarterEps.studentT.scale,
      }),
    );
  }
  if (actualRevenue.ok) {
    store.appendConformalResidual(
      recordConformalResidual({
        target: 'nextQuarterRevenue',
        fiscalPeriodKey: input.outcome.fiscalPeriodKey,
        outcomeKnownAt: input.outcome.outcomeKnownAt,
        predicted: input.priorState.nextQuarterRevenue.studentT.mean,
        actual: earningsDecimalToNumber(actualRevenue.scaled),
        scale: input.priorState.nextQuarterRevenue.studentT.scale,
      }),
    );
  }

  const interval = input.priorState.nextQuarterEps.conformalInterval;
  const intervalHit =
    interval === null || !actualEps.ok
      ? null
      : earningsDecimalToNumber(actualEps.scaled) >= interval.lower &&
        earningsDecimalToNumber(actualEps.scaled) <= interval.upper;

  const observation: CalibrationObservation = {
    predictedProbability: input.priorState.beatProbability.probability,
    actualBinary: input.outcome.beatConsensus ? 1 : 0,
    predictedNumeric: input.priorState.nextQuarterEps.studentT.mean,
    actualNumeric: actualEps.ok ? earningsDecimalToNumber(actualEps.scaled) : 0,
    numericDistribution: input.priorState.nextQuarterEps.studentT,
    intervalHit,
  };
  store.appendCalibration(buildCalibrationSnapshot([observation]));

  return Object.freeze({ updated, calibrationAppended: true });
}

export function assertResearchReturnNotFact(state: ProbabilisticEarningsState): void {
  if (state.announcementReturnDistribution && !state.announcementReturnDistribution.notAFact) {
    throw new Error('RETURN_PREDICTION_MUST_NOT_BE_FACT');
  }
  if (state.postEventResidualReturnDistribution && !state.postEventResidualReturnDistribution.notAFact) {
    throw new Error('RETURN_PREDICTION_MUST_NOT_BE_FACT');
  }
}

export type { UtcInstant };
