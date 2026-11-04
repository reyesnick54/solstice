/**
 * Hierarchical mixture-of-experts probabilistic earnings state estimator (EARN09).
 */

import type { EarningsExpertKind } from './taxonomy.ts';
import {
  HELIOS_EARNINGS_STATE_ESTIMATOR_AUTHORITY,
  HELIOS_EARNINGS_STATE_ESTIMATOR_SCHEMA,
} from './taxonomy.ts';
import type {
  EarningsExpertSignal,
  EarningsStateEstimatorStoreSnapshot,
  EstimateProbabilisticEarningsStateInput,
  NumericalForecastDistribution,
  ProbabilityForecast,
  ProbabilisticEarningsState,
  ReturnForecastDistribution,
} from './types.ts';
import { bmaNumericForTarget, bmaProbabilityForTarget, effectiveMixtureWeights } from './bma.ts';
import { buildConformalInterval } from './conformal.ts';
import { buildEvidenceContributions } from './contributions.ts';
import { computeExpertGateWeight, listGatingVariablesUsed } from './gating.ts';
import { numberToEarningsDecimal } from './numeric.ts';
import { defaultExpertReliability, reliabilityWeight } from './reliability.ts';
import { buildCalibrationSnapshot, type CalibrationObservation } from './calibration.ts';
import { DEFAULT_EXPERT_PRIMARY_TARGETS } from './expert-targets.ts';

const CONFORMAL_COVERAGE = 0.9;

function enrichSignals(signals: readonly EarningsExpertSignal[]): readonly EarningsExpertSignal[] {
  return Object.freeze(
    signals.map((signal) =>
      signal.primaryTargets.length > 0
        ? signal
        : Object.freeze({
            ...signal,
            primaryTargets: DEFAULT_EXPERT_PRIMARY_TARGETS[signal.expertKind],
          }),
    ),
  );
}

function buildNumericalForecast(input: {
  readonly target: 'nextQuarterEps' | 'nextQuarterRevenue';
  readonly signals: readonly EarningsExpertSignal[];
  readonly weights: ReturnType<typeof effectiveMixtureWeights>;
  readonly store: EarningsStateEstimatorStoreSnapshot;
  readonly asOf: EstimateProbabilisticEarningsStateInput['asOf'];
}): NumericalForecastDistribution {
  const studentT = bmaNumericForTarget(input.signals, input.weights, input.target);
  const mean = studentT?.mean ?? 0;
  const scale = studentT?.scale ?? 1;
  const conformalInterval =
    studentT === null
      ? null
      : buildConformalInterval({
          mean,
          residuals: input.store.conformalResiduals,
          target: input.target,
          asOf: input.asOf,
          coverageLevel: CONFORMAL_COVERAGE,
        });
  return Object.freeze({
    pointEstimate: numberToEarningsDecimal(mean),
    studentT: studentT ?? Object.freeze({ kind: 'student_t', mean: 0, scale: 1, degreesOfFreedom: 3 }),
    conformalInterval,
  });
}

function buildProbabilityForecast(
  signals: readonly EarningsExpertSignal[],
  weights: ReturnType<typeof effectiveMixtureWeights>,
  target: Parameters<typeof bmaProbabilityForTarget>[2],
): ProbabilityForecast {
  const combined = bmaProbabilityForTarget(signals, weights, target);
  return Object.freeze({ probability: combined.probability, uncertainty: combined.uncertainty });
}

function buildReturnForecast(input: {
  readonly signals: readonly EarningsExpertSignal[];
  readonly weights: ReturnType<typeof effectiveMixtureWeights>;
  readonly target: 'announcementReturn' | 'postEventResidualReturn';
  readonly store: EarningsStateEstimatorStoreSnapshot;
  readonly asOf: EstimateProbabilisticEarningsStateInput['asOf'];
}): ReturnForecastDistribution {
  const numeric = bmaNumericForTarget(input.signals, input.weights, input.target);
  const mean = numeric?.mean ?? 0;
  const scale = numeric?.scale ?? 0.02;
  const studentT =
    numeric !== null
      ? Object.freeze({ ...numeric, mean, scale: Math.max(scale, 0.005) })
      : Object.freeze({ kind: 'student_t' as const, mean: 0, scale: 0.02, degreesOfFreedom: 4 });
  const conformalInterval = buildConformalInterval({
    mean: studentT.mean,
    residuals: input.store.conformalResiduals,
    target: input.target,
    asOf: input.asOf,
    coverageLevel: CONFORMAL_COVERAGE,
  });
  return Object.freeze({
    knowledgeLayer: 'model_inference',
    researchOnly: true,
    notAFact: true,
    studentT,
    conformalInterval,
  });
}

function weightShares(weights: ReturnType<typeof effectiveMixtureWeights>): Readonly<Record<EarningsExpertKind, number>> {
  const out = {} as Record<EarningsExpertKind, number>;
  for (const row of weights) {
    out[row.expertKind] = row.effectiveWeight;
  }
  return Object.freeze(out);
}

export function estimateProbabilisticEarningsState(
  input: EstimateProbabilisticEarningsStateInput,
  store: EarningsStateEstimatorStoreSnapshot,
  options?: { readonly skipContributions?: boolean },
): ProbabilisticEarningsState {
  const signals = enrichSignals(input.expertSignals);
  const gateWeights = signals.map((signal) => computeExpertGateWeight(signal, input.gating));
  const reliabilityWeights = signals.map((signal) => {
    const record = store.reliabilityByExpert[signal.expertKind] ?? defaultExpertReliability(signal.expertKind);
    return reliabilityWeight(record);
  });
  const weights = effectiveMixtureWeights(signals, gateWeights, reliabilityWeights);

  const nextQuarterEps = buildNumericalForecast({
    target: 'nextQuarterEps',
    signals,
    weights,
    store,
    asOf: input.asOf,
  });
  const nextQuarterRevenue = buildNumericalForecast({
    target: 'nextQuarterRevenue',
    signals,
    weights,
    store,
    asOf: input.asOf,
  });

  const beatProbability = buildProbabilityForecast(signals, weights, 'beatProbability');
  const missProbability = Object.freeze({
    probability: Math.min(0.999, Math.max(0.001, 1 - beatProbability.probability)),
    uncertainty: beatProbability.uncertainty,
  });
  const revenueBeatProbability = buildProbabilityForecast(signals, weights, 'revenueBeatProbability');
  const guidanceRaiseProbability = buildProbabilityForecast(signals, weights, 'guidanceRaiseProbability');
  const guidanceCutProbability = buildProbabilityForecast(signals, weights, 'guidanceCutProbability');
  const marginExpansionProbability = buildProbabilityForecast(signals, weights, 'marginExpansionProbability');
  const earningsQualityRiskProbability = buildProbabilityForecast(signals, weights, 'earningsQualityRiskProbability');

  const includeReturns = input.includeResearchReturnDistributions === true;
  const announcementReturnDistribution = includeReturns
    ? buildReturnForecast({
        signals,
        weights,
        target: 'announcementReturn',
        store,
        asOf: input.asOf,
      })
    : null;
  const postEventResidualReturnDistribution = includeReturns
    ? buildReturnForecast({
        signals,
        weights,
        target: 'postEventResidualReturn',
        store,
        asOf: input.asOf,
      })
    : null;

  const calibrationObservations: CalibrationObservation[] = [];
  if (store.calibrationHistory.length > 0) {
    const last = store.calibrationHistory[store.calibrationHistory.length - 1];
    if (last && last.sampleCount > 0) {
      calibrationObservations.push({
        predictedProbability: beatProbability.probability,
        actualBinary: 0,
        predictedNumeric: nextQuarterEps.studentT.mean,
        actualNumeric: nextQuarterEps.studentT.mean,
        numericDistribution: nextQuarterEps.studentT,
        intervalHit: null,
      });
    }
  }
  const calibration =
    store.calibrationHistory.length > 0
      ? store.calibrationHistory[store.calibrationHistory.length - 1]!
      : buildCalibrationSnapshot(calibrationObservations);

  const baseState = Object.freeze({
    schema: HELIOS_EARNINGS_STATE_ESTIMATOR_SCHEMA,
    authority: HELIOS_EARNINGS_STATE_ESTIMATOR_AUTHORITY,
    instrumentId: input.instrumentId,
    fiscalPeriodKey: input.fiscalPeriodKey,
    asOf: input.asOf,
    gatingContext: input.gating,
    gatingVariablesUsed: listGatingVariablesUsed(input.gating),
    nextQuarterEps,
    nextQuarterRevenue,
    beatProbability,
    missProbability,
    revenueBeatProbability,
    guidanceRaiseProbability,
    guidanceCutProbability,
    marginExpansionProbability,
    earningsQualityRiskProbability,
    announcementReturnDistribution,
    postEventResidualReturnDistribution,
    evidenceContributions: Object.freeze([] as const),
    calibration,
    grantsExecutionAuthority: false as const,
    researchOnly: true as const,
  });

  if (options?.skipContributions) {
    return baseState;
  }

  const leaveOneOut = {} as Record<EarningsExpertKind, ProbabilisticEarningsState | null>;
  for (const signal of signals) {
    const reducedSignals = signals.filter((row) => row.expertKind !== signal.expertKind);
    leaveOneOut[signal.expertKind] =
      reducedSignals.length === 0
        ? null
        : estimateProbabilisticEarningsState(
            { ...input, expertSignals: reducedSignals },
            store,
            { skipContributions: true },
          );
  }

  const evidenceContributions = buildEvidenceContributions({
    full: baseState,
    leaveOneOut,
    weightShares: weightShares(weights),
  });

  return Object.freeze({ ...baseState, evidenceContributions });
}
