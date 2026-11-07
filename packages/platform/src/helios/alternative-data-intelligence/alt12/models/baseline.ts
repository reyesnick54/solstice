/**
 * HELIOS ALT12 baseline fusion models (deterministic simulation).
 */

import type { AltBaselineFusionModel } from '../../taxonomy.ts';
import type { FusionRouteDecision, ModelFusionOutput, ModalityState } from '../types.ts';

function presentModalities(modalities: readonly ModalityState[]): readonly ModalityState[] {
  return modalities.filter((m) => m.availability === 'PRESENT' && m.featureValue !== null);
}

function huberWeight(residual: number, delta: number): number {
  const abs = Math.abs(residual);
  if (abs <= delta) return 1;
  return delta / abs;
}

export function runRobustLinearEnsemble(
  modalities: readonly ModalityState[],
  route: FusionRouteDecision,
): ModelFusionOutput {
  const present = presentModalities(modalities);
  if (present.length === 0) {
    return Object.freeze({
      modelKind: 'ROBUST_LINEAR_ENSEMBLE',
      pointEstimate: 0,
      uncertainty: 1,
      activeModalityCount: 0,
      researchOnly: true,
    });
  }

  const median =
    [...present.map((m) => m.featureValue!)].sort((a, b) => a - b)[Math.floor(present.length / 2)] ?? 0;

  let num = 0;
  let den = 0;
  let uncSum = 0;
  for (const state of present) {
    const wRoute = route.modalityRouteWeights[state.modality] ?? 0;
    const residual = state.featureValue! - median;
    const wRobust = huberWeight(residual, 0.35) * wRoute * state.reliability.effectiveTrust;
    num += wRobust * state.featureValue!;
    den += wRobust;
    uncSum += (state.featureUncertainty ?? 0.15) * wRobust;
  }
  const pointEstimate = den > 0 ? num / den : 0;
  const uncertainty = den > 0 ? Math.max(0.05, uncSum / den) : 1;

  return Object.freeze({
    modelKind: 'ROBUST_LINEAR_ENSEMBLE',
    pointEstimate,
    uncertainty,
    activeModalityCount: present.length,
    researchOnly: true,
  });
}

export function runGradientBoosting(
  modalities: readonly ModalityState[],
  route: FusionRouteDecision,
): ModelFusionOutput {
  const present = presentModalities(modalities);
  if (present.length === 0) {
    return Object.freeze({
      modelKind: 'GRADIENT_BOOSTING',
      pointEstimate: 0,
      uncertainty: 1,
      activeModalityCount: 0,
      researchOnly: true,
    });
  }

  const ordered = [...present].sort((a, b) => a.modality.localeCompare(b.modality));
  let prediction = ordered[0]?.featureValue ?? 0;
  const learningRate = 0.35;

  for (let step = 1; step < ordered.length; step += 1) {
    const state = ordered[step]!;
    const weight = (route.modalityRouteWeights[state.modality] ?? 0.1) * state.reliability.effectiveTrust;
    const residual = state.featureValue! - prediction;
    prediction += learningRate * weight * residual;
  }

  const spread =
    ordered.reduce((acc, s) => acc + Math.abs(s.featureValue! - prediction), 0) / Math.max(1, ordered.length);

  return Object.freeze({
    modelKind: 'GRADIENT_BOOSTING',
    pointEstimate: prediction,
    uncertainty: Math.max(0.05, spread * 0.5),
    activeModalityCount: present.length,
    researchOnly: true,
  });
}

export function runBayesianModelAverage(
  modalities: readonly ModalityState[],
  route: FusionRouteDecision,
): ModelFusionOutput {
  const present = presentModalities(modalities);
  if (present.length === 0) {
    return Object.freeze({
      modelKind: 'BAYESIAN_MODEL_AVERAGE',
      pointEstimate: 0,
      uncertainty: 1,
      activeModalityCount: 0,
      researchOnly: true,
    });
  }

  let weightedMean = 0;
  let weightedSecond = 0;
  let weightSum = 0;

  for (const state of present) {
    const prior = 0.15;
    const likelihoodPrecision = 1 / Math.max(1e-6, (state.featureUncertainty ?? 0.15) ** 2);
    const posteriorWeight =
      (route.modalityRouteWeights[state.modality] ?? 0) *
      state.reliability.effectiveTrust *
      (likelihoodPrecision / (likelihoodPrecision + prior));
    const w = Math.max(1e-9, posteriorWeight);
    weightedMean += w * state.featureValue!;
    weightedSecond += w * state.featureValue! ** 2;
    weightSum += w;
  }

  const mean = weightSum > 0 ? weightedMean / weightSum : 0;
  const variance = weightSum > 0 ? Math.max(1e-9, weightedSecond / weightSum - mean ** 2) : 1;

  return Object.freeze({
    modelKind: 'BAYESIAN_MODEL_AVERAGE',
    pointEstimate: mean,
    uncertainty: Math.sqrt(variance),
    activeModalityCount: present.length,
    researchOnly: true,
  });
}

export function runAllBaselineModels(
  modalities: readonly ModalityState[],
  route: FusionRouteDecision,
): Record<AltBaselineFusionModel, ModelFusionOutput> {
  return Object.freeze({
    ROBUST_LINEAR_ENSEMBLE: runRobustLinearEnsemble(modalities, route),
    GRADIENT_BOOSTING: runGradientBoosting(modalities, route),
    BAYESIAN_MODEL_AVERAGE: runBayesianModelAverage(modalities, route),
  });
}
