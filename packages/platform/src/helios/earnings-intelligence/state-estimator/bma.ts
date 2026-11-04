/**
 * Robust Bayesian model averaging baseline for hierarchical mixture-of-experts.
 */

import type { EarningsEstimateTarget } from './taxonomy.ts';
import type { EarningsExpertSignal } from './types.ts';
import { combineProbabilitiesLogit, combineStudentTMixture } from './distributions.ts';

export type ExpertMixtureWeight = {
  readonly expertKind: EarningsExpertSignal['expertKind'];
  readonly gateWeight: number;
  readonly reliabilityWeight: number;
  readonly effectiveWeight: number;
};

export function effectiveMixtureWeights(
  signals: readonly EarningsExpertSignal[],
  gateWeights: readonly number[],
  reliabilityWeights: readonly number[],
): readonly ExpertMixtureWeight[] {
  const raw = signals.map((signal, index) => {
    const gateWeight = gateWeights[index] ?? 0;
    const reliabilityWeight = reliabilityWeights[index] ?? 0.05;
    return gateWeight * reliabilityWeight;
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  const denom = sum > 0 ? sum : 1;
  return Object.freeze(
    signals.map((signal, index) => {
      const gateWeight = gateWeights[index] ?? 0;
      const reliabilityWeight = reliabilityWeights[index] ?? 0.05;
      const effectiveWeight = raw[index]! / denom;
      return Object.freeze({ expertKind: signal.expertKind, gateWeight, reliabilityWeight, effectiveWeight });
    }),
  );
}

const NUMERIC_TARGETS: ReadonlySet<EarningsEstimateTarget> = new Set(['nextQuarterEps', 'nextQuarterRevenue']);

export function isNumericTarget(target: EarningsEstimateTarget): boolean {
  return NUMERIC_TARGETS.has(target);
}

export function bmaNumericForTarget(
  signals: readonly EarningsExpertSignal[],
  weights: readonly ExpertMixtureWeight[],
  target: EarningsEstimateTarget,
): ReturnType<typeof combineStudentTMixture> {
  const components = signals
    .map((signal, index) => {
      if (!signal.primaryTargets.includes(target)) return null;
      const w = weights[index]?.effectiveWeight ?? 0;
      if (w <= 0) return null;
      return {
        mean: signal.estimate,
        scale: Math.max(1e-6, signal.uncertainty),
        weight: w,
        df: 4 + 8 * signal.dataQuality,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  return combineStudentTMixture(components);
}

export function bmaProbabilityForTarget(
  signals: readonly EarningsExpertSignal[],
  weights: readonly ExpertMixtureWeight[],
  target: EarningsEstimateTarget,
): ReturnType<typeof combineProbabilitiesLogit> {
  const components = signals
    .map((signal, index) => {
      if (!signal.primaryTargets.includes(target)) return null;
      const w = weights[index]?.effectiveWeight ?? 0;
      if (w <= 0) return null;
      return { probability: signal.estimate, weight: w, uncertainty: signal.uncertainty };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  return combineProbabilitiesLogit(components);
}
