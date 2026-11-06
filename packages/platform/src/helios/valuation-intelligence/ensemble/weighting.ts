import { DEFAULT_MIN_INTRINSIC_MODEL_WEIGHT } from './taxonomy.ts';
import type { ModelApplicabilityState, ModelReliabilityState, ModelWeight } from './types.ts';

export type WeightingInput = {
  readonly applicability: readonly ModelApplicabilityState[];
  readonly reliability: readonly ModelReliabilityState[];
  readonly currentUncertaintyByMethod: Readonly<Record<string, number>>;
};

function normalizeWeights(
  raw: readonly { method: string; lane: ModelWeight['lane']; weight: number; rationale: readonly string[] }[],
): readonly ModelWeight[] {
  const applicable = raw.filter((r) => r.weight > 0);
  const sum = applicable.reduce((acc, r) => acc + r.weight, 0);
  if (sum <= 0) {
    return Object.freeze([]);
  }
  return Object.freeze(
    applicable.map((r) =>
      Object.freeze({
        method: r.method as ModelWeight['method'],
        lane: r.lane,
        priorWeight: r.weight / sum,
        posteriorWeight: r.weight / sum,
        rationale: Object.freeze(r.rationale),
      }),
    ),
  );
}

function uncertaintyDiscount(uncertainty: number | undefined): number {
  if (uncertainty === undefined || !Number.isFinite(uncertainty)) return 1;
  return Math.max(0.35, 1 - Math.min(0.65, uncertainty));
}

/** Transparent BMA-style weighting: prior from applicability, posterior from reliability + uncertainty. */
export function computeAdaptiveModelWeights(input: WeightingInput): readonly ModelWeight[] {
  const reliabilityByMethod = new Map(input.reliability.map((r) => [String(r.method), r]));

  const raw = input.applicability
    .filter((a) => a.economicallyValid)
    .map((a) => {
      const rel = reliabilityByMethod.get(String(a.method));
      const prior = a.applicabilityScore;
      const posteriorBase = rel?.shrinkageApplied ?? prior * 0.5;
      const uncertainty = input.currentUncertaintyByMethod[String(a.method)] ?? 0.25;
      const weight = posteriorBase * uncertaintyDiscount(uncertainty);
      const rationale = Object.freeze([
        `prior_applicability=${prior.toFixed(3)}`,
        `posterior_reliability=${posteriorBase.toFixed(3)}`,
        `uncertainty_discount=${uncertaintyDiscount(uncertainty).toFixed(3)}`,
      ]);
      return Object.freeze({
        method: String(a.method),
        lane: a.lane,
        weight,
        rationale,
      });
    });

  let normalized = normalizeWeights(raw);

  const intrinsicWeights = normalized.filter((w) => w.lane === 'INTRINSIC');
  if (intrinsicWeights.length >= 2) {
    const minShare = DEFAULT_MIN_INTRINSIC_MODEL_WEIGHT;
    const adjusted = normalized.map((w) => {
      if (w.lane !== 'INTRINSIC') return w;
      const boosted = Math.max(w.posteriorWeight, minShare / intrinsicWeights.length);
      return Object.freeze({ ...w, posteriorWeight: boosted });
    });
    const renormalized = normalizeWeights(
      adjusted.map((w) =>
        Object.freeze({
          method: String(w.method),
          lane: w.lane,
          weight: w.posteriorWeight,
          rationale: [...w.rationale, 'min_diversity_floor'],
        }),
      ),
    );
    normalized = renormalized.map((w) => {
      const prior = raw.find((r) => r.method === String(w.method));
      return Object.freeze({
        ...w,
        priorWeight: prior ? prior.weight / (raw.reduce((s, r) => s + r.weight, 0) || 1) : w.priorWeight,
      });
    });
  }

  return normalized;
}
