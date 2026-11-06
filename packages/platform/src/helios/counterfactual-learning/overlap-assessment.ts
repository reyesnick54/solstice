import type { UtcInstant } from '@solstice/domain';

import {
  addRational,
  divRational,
  mulRational,
  rationalCompare,
  rationalToNumberFinite,
  subtractRational,
} from './rational.ts';
import { normalizeRational } from './rational.ts';
import type { PolicySupportState } from './taxonomy.ts';
import type {
  BehaviorPolicySnapshot,
  EffectiveSampleSize,
  OverlapAssessment,
  PolicySupportStateGate,
  ProbabilityRational,
} from './types.ts';

/** Natural-log KL(behavior || evaluation) for discrete policies over the same action set. */
export function klForwardNaturalLog(
  behavior: ReadonlyMap<string, ProbabilityRational>,
  evaluation: ReadonlyMap<string, ProbabilityRational>,
): number | null {
  if (behavior.size !== evaluation.size) {
    return null;
  }
  let sum = 0;
  for (const [actionId, b] of behavior) {
    const e = evaluation.get(actionId);
    if (!e) return null;
    const pb = rationalToNumberFinite(b);
    const pe = rationalToNumberFinite(e);
    if (pb === 0 && pe === 0) continue;
    if (pb > 0 && pe <= 0) return null;
    if (pb > 0) {
      sum += pb * Math.log(pb / pe);
    }
  }
  return sum;
}

export function assessOverlapForOpe(input: {
  readonly decidedAtUtc: UtcInstant;
  readonly behavior: BehaviorPolicySnapshot;
  readonly evaluationPropensityMasses: ReadonlyMap<string, ProbabilityRational>;
  readonly thresholds?: Partial<{
    readonly supportedMinEss: number;
    readonly weakMinEss: number;
    readonly poorMinEss: number;
    readonly supportedMaxWeight: number;
    readonly weakMaxWeight: number;
  }>;
}): { readonly overlap: OverlapAssessment; readonly gate: PolicySupportStateGate } {
  void input.decidedAtUtc;

  const zero: ProbabilityRational = { numerator: '0', denominator: '1' };

  if (input.behavior.policyKind === 'DETERMINISTIC_POLICY') {
    const overlap: OverlapAssessment = {
      supportState: 'NO_SUPPORT',
      effectiveSampleSize: {
        sampleCount: 0,
        essRational: zero,
      },
      maxImportanceWeightRational: zero,
      weightVarianceRational: zero,
      actionSupportRational: zero,
      contextualSupportRational: zero,
      klDivergenceDiagnostics: Object.freeze([{ kind: 'KL_FORWARD_NATURAL', value: null }]),
      importanceWeightDiagnostics: {
        weightCount: 0,
        maxImportanceWeightRational: zero,
        weightVarianceRational: zero,
        propensityExtremes: {
          minPropensityRational: zero,
          maxPropensityRational: zero,
        },
      },
    };
    return {
      overlap,
      gate: { counterfactualOpeEstimationPermitted: false, refusalReason: 'NO_OVERLAP_SUPPORT' },
    };
  }

  const masses = input.behavior.propensityMasses;
  if (masses.length === 0) {
    throw new Error('no propensity masses');
  }

  const weights: ProbabilityRational[] = [];
  let sumW: ProbabilityRational | null = null;
  let sumW2: ProbabilityRational | null = null;

  for (let i = 0; i < masses.length; i += 1) {
    const row = masses[i]!;
    const b = row.probabilityMass;
    const e = input.evaluationPropensityMasses.get(row.actionId);
    if (!e) {
      throw new Error(`evaluation policy missing mass for ${row.actionId}`);
    }
    const w = divRational(e, b);
    weights.push(w);
    const wSquared = mulRational(w, w);
    if (sumW === null) {
      sumW = w;
      sumW2 = wSquared;
    } else {
      sumW = addRational(sumW, w);
      sumW2 = addRational(sumW2!, wSquared);
    }
  }
  if (sumW === null || sumW2 === null) {
    throw new Error('internal: empty weights');
  }

  const n = BigInt(weights.length);
  const nRat: ProbabilityRational = { numerator: n.toString(), denominator: '1' };
  const mean = divRational(sumW, nRat);
  const sumW2OverN = divRational(sumW2, nRat);
  const variance = subtractRational(sumW2OverN, mulRational(mean, mean));

  const ess = divRational(mulRational(sumW, sumW), sumW2);
  const essFinite = rationalToNumberFinite(ess);

  let maxW = weights[0]!;
  let minW = weights[0]!;
  for (const w of weights) {
    if (rationalCompare(w, maxW) > 0) maxW = w;
    if (rationalCompare(w, minW) < 0) minW = w;
  }
  const maxWFinite = rationalToNumberFinite(maxW);

  const behaviorMap = new Map<string, ProbabilityRational>(
    masses.map((m) => [m.actionId, m.probabilityMass] as const),
  );

  const kl = klForwardNaturalLog(behaviorMap, new Map(input.evaluationPropensityMasses));

  const minPropensity = masses.reduce((min, m) => (rationalCompare(m.probabilityMass, min) < 0 ? m.probabilityMass : min), masses[0]!.probabilityMass);
  const maxPropensity = masses.reduce((max, m) => (rationalCompare(m.probabilityMass, max) > 0 ? m.probabilityMass : max), masses[0]!.probabilityMass);

  let actionSupport = mulRational(masses[0]!.probabilityMass, input.evaluationPropensityMasses.get(masses[0]!.actionId)!);
  for (const m of masses) {
    const e = input.evaluationPropensityMasses.get(m.actionId)!;
    const prod = mulRational(m.probabilityMass, e);
    if (rationalCompare(prod, actionSupport) < 0) {
      actionSupport = prod;
    }
  }

  let contextual = mulRational(masses[0]!.probabilityMass, input.evaluationPropensityMasses.get(masses[0]!.actionId)!);
  for (const m of masses) {
    const e = input.evaluationPropensityMasses.get(m.actionId)!;
    const prod = mulRational(m.probabilityMass, e);
    if (rationalCompare(prod, contextual) > 0) {
      contextual = prod;
    }
  }

  const t = input.thresholds ?? {};
  const supportedMinEss = t.supportedMinEss ?? 0.2;
  const weakMinEss = t.weakMinEss ?? 0.05;
  const poorMinEss = t.poorMinEss ?? 0.01;
  const supportedMaxWeight = t.supportedMaxWeight ?? 50;
  const weakMaxWeight = t.weakMaxWeight ?? 200;

  let supportState: PolicySupportState;
  if (essFinite >= supportedMinEss && maxWFinite <= supportedMaxWeight) {
    supportState = 'SUPPORTED';
  } else if (essFinite >= weakMinEss && maxWFinite <= weakMaxWeight) {
    supportState = 'WEAK_SUPPORT';
  } else if (essFinite >= poorMinEss) {
    supportState = 'POOR_SUPPORT';
  } else {
    supportState = 'NO_SUPPORT';
  }

  const effectiveSampleSize: EffectiveSampleSize = {
    sampleCount: weights.length,
    essRational: normalizeRational(ess),
  };

  const overlap: OverlapAssessment = {
    supportState,
    effectiveSampleSize,
    maxImportanceWeightRational: maxW,
    weightVarianceRational: normalizeRational(variance),
    actionSupportRational: actionSupport,
    contextualSupportRational: contextual,
    klDivergenceDiagnostics: Object.freeze([{ kind: 'KL_FORWARD_NATURAL', value: kl }]),
    importanceWeightDiagnostics: {
      weightCount: weights.length,
      maxImportanceWeightRational: maxW,
      weightVarianceRational: normalizeRational(variance),
      propensityExtremes: {
        minPropensityRational: minPropensity,
        maxPropensityRational: maxPropensity,
      },
    },
  };

  const permitted = supportState !== 'NO_SUPPORT';
  return {
    overlap,
    gate: {
      counterfactualOpeEstimationPermitted: permitted,
      refusalReason: permitted ? null : 'NO_OVERLAP_SUPPORT',
    },
  };
}
