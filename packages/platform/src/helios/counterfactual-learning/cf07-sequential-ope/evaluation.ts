/**
 * HELIOS CF07 — sequential off-policy evaluation (FQE, WIS, sequential DR).
 */

import {
  HELIOS_CF07_SEQUENTIAL_OPE_BLOCKED,
  HELIOS_CF07_SEQUENTIAL_OPE_QUALIFIED,
  HELIOS_CF07_SEQUENTIAL_OPE_SCHEMA_VERSION,
} from './taxonomy.ts';
import type {
  DecisionTrajectory,
  DecisionTrajectoryStep,
  FittedQEvaluationState,
  OpeDiagnostics,
  PortfolioConstraintSpec,
  PortfolioConstraintViolation,
  PortfolioState,
  PortfolioStateTransition,
  SequentialOpeResult,
  SequentialPolicyEstimate,
  TrajectorySupportAssessment,
} from './types.ts';

export type TrajectoryWithPortfolio = {
  readonly trajectory: DecisionTrajectory;
  readonly portfolioStates: readonly PortfolioState[];
  /** When omitted, feasibility flags default to true only if basic cash/mandate checks pass. */
  readonly transitions?: readonly PortfolioStateTransition[];
};

export type FqeConfig = {
  readonly maxIterations: number;
  readonly toleranceMean: number;
  readonly divergenceResidualRatio: number;
};

export type EvaluationPolicyPmf = (
  stateKey: string,
) => readonly { readonly actionKey: string; readonly probability: number }[];

export type QValueFunction = (stateKey: string, actionKey: string) => bigint;

export type ValueFunction = (stateKey: string) => bigint;

export type SequentialOpeInput = {
  readonly trajectories: readonly TrajectoryWithPortfolio[];
  readonly constraints: PortfolioConstraintSpec;
  readonly discountGamma: number;
  /** Lower bound on behavior propensity in the ratio π/σ (stability). */
  readonly propensityFloor: number;
  /** Block if any trajectory cumulative importance weight exceeds this. */
  readonly maxImportanceWeight: number;
  /** Minimum per (stateKey, actionKey) visits to count as in-support. */
  readonly minSupportVisits: number;
  readonly fqe: FqeConfig;
  /** Evaluation-policy Q and V for DR; optional — DR omitted when absent. */
  readonly doublyRobust?: {
    readonly qHat: QValueFunction;
    readonly vHatPi: ValueFunction;
  };
  /** Optional π(a|s) for Bellman target in FQE; default assumes deterministic evaluation along logged action. */
  readonly evaluationPolicyPmf?: EvaluationPolicyPmf;
};

function trajectoryKey(s: DecisionTrajectoryStep): string {
  return `${s.stateKey}\x00${s.actionKey}`;
}

/** Callers may pack absolute position units as a decimal string in `positionEncoding`. */
function parseEncodedPositionUnitsMinor(encoding: string): bigint {
  if (/^\d+$/.test(encoding)) {
    return BigInt(encoding);
  }
  return BigInt(encoding.length);
}

function bigIntToFloatScaled(x: bigint, scale: number): number {
  return Number(x) * scale;
}

function scaleBigIntMinor(x: bigint, factor: number): bigint {
  return BigInt(Math.round(Number(x) * factor));
}

function floatToBigIntMinor(x: number): bigint {
  if (!Number.isFinite(x)) {
    return 0n;
  }
  return BigInt(Math.round(x));
}

/** Per-trajectory sequential importance weights ρ_{0:t} for each t (same length as steps). */
export function perStepImportanceRatios(
  steps: readonly DecisionTrajectoryStep[],
  floor: number,
): number[] {
  const ratios: number[] = [];
  let cumulative = 1;
  for (const step of steps) {
    const sigma = Math.max(step.behaviorPropensity, floor);
    const pi = Math.max(step.evaluationPropensity, floor);
    cumulative *= pi / sigma;
    ratios.push(cumulative);
  }
  return ratios;
}

export function discountedReturnMinor(
  steps: readonly DecisionTrajectoryStep[],
  gamma: number,
): bigint {
  let g = 0n;
  let discount = 1;
  for (let t = 0; t < steps.length; t += 1) {
    g += scaleBigIntMinor(steps[t]!.rewardMinor, discount);
    discount *= gamma;
  }
  return g;
}

function kishEss(weights: readonly number[]): number {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    return 0;
  }
  const sumSq = weights.reduce((a, b) => a + b * b, 0);
  return (sum * sum) / sumSq;
}

function countSupport(
  trajectories: readonly DecisionTrajectory[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const tr of trajectories) {
    for (const step of tr.steps) {
      const k = trajectoryKey(step);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
  }
  return m;
}

function assessTrajectorySupport(
  trajectories: readonly DecisionTrajectory[],
  perTrajectoryFinalWeights: readonly number[],
  visitCounts: ReadonlyMap<string, number>,
  minVisits: number,
): TrajectorySupportAssessment {
  let covSum = 0;
  let trajCount = 0;
  let extrapPairs = 0;
  let totalPairs = 0;
  for (const tr of trajectories) {
    trajCount += 1;
    let inner = 0;
    for (const step of tr.steps) {
      totalPairs += 1;
      const k = trajectoryKey(step);
      const v = visitCounts.get(k) ?? 0;
      const supported = v >= minVisits;
      inner += supported ? 1 : 0;
      if (!supported) {
        extrapPairs += 1;
      }
    }
    covSum += inner / Math.max(tr.steps.length, 1);
  }
  const trajectoryCoverage = trajCount > 0 ? covSum / trajCount : 0;
  const importanceWeightMax =
    perTrajectoryFinalWeights.length > 0 ? Math.max(...perTrajectoryFinalWeights) : 0;
  const stateExtrapolationFraction = totalPairs > 0 ? extrapPairs / totalPairs : 0;
  const blockReasons: string[] = [];
  if (importanceWeightMax > 1e6) {
    blockReasons.push('importance_weight_explosion');
  }
  if (stateExtrapolationFraction > 0.25) {
    blockReasons.push('state_extrapolation');
  }
  if (trajectoryCoverage < 0.5) {
    blockReasons.push('trajectory_coverage_low');
  }
  return Object.freeze({
    trajectoryCoverage,
    effectiveTrajectorySampleSize: kishEss(perTrajectoryFinalWeights),
    importanceWeightMax,
    stateExtrapolationFraction,
    blockReasons: Object.freeze(blockReasons),
  });
}

function checkPortfolioPath(
  bundle: TrajectoryWithPortfolio,
  spec: PortfolioConstraintSpec,
): PortfolioConstraintViolation[] {
  const violations: PortfolioConstraintViolation[] = [];
  const { trajectory, portfolioStates, transitions } = bundle;
  if (portfolioStates.length !== trajectory.steps.length + 1) {
    violations.push({
      kind: 'CAPITAL_CONSERVATION',
      stepIndex: -1,
      detail: 'portfolio_states_length_mismatch',
    });
    return violations;
  }
  const notionals: bigint[] = portfolioStates.map((p) => {
    const absUnreal = p.unrealizedPnlMinor < 0n ? -p.unrealizedPnlMinor : p.unrealizedPnlMinor;
    return p.cashMinor + p.marginUsedMinor + absUnreal + parseEncodedPositionUnitsMinor(p.positionEncoding);
  });

  for (let i = 0; i < trajectory.steps.length; i += 1) {
    const from = portfolioStates[i]!;
    const to = portfolioStates[i + 1]!;
    const trn = transitions?.[i];
    const fromNotional = notionals[i]!;
    const toNotional = notionals[i + 1]!;
    if (from.cashMinor < 0n) {
      violations.push({ kind: 'CAPITAL_CONSERVATION', stepIndex: i, detail: 'negative_cash' });
    }
    if (to.cashMinor < 0n) {
      violations.push({ kind: 'CAPITAL_CONSERVATION', stepIndex: i, detail: 'negative_cash_after' });
    }
    if (fromNotional > spec.capitalMinor && spec.capitalMinor >= 0n) {
      violations.push({ kind: 'CAPITAL_CONSERVATION', stepIndex: i, detail: 'notional_above_capital' });
    }
    if (toNotional > spec.capitalMinor && spec.capitalMinor >= 0n) {
      violations.push({ kind: 'CAPITAL_CONSERVATION', stepIndex: i, detail: 'notional_above_capital_after' });
    }
    if (spec.maxLeverageNumerator != null && spec.maxLeverageDenominator) {
      const maxMargin = (spec.capitalMinor * BigInt(spec.maxLeverageNumerator)) / BigInt(
        spec.maxLeverageDenominator,
      );
      if (from.marginUsedMinor > maxMargin) {
        violations.push({ kind: 'MARGIN', stepIndex: i, detail: 'margin_exceeds_policy' });
      }
    }
    if (spec.maxPositionUnitsMinor != null) {
      const pos = parseEncodedPositionUnitsMinor(to.positionEncoding);
      if (pos > spec.maxPositionUnitsMinor) {
        violations.push({ kind: 'POSITION_LIMIT', stepIndex: i, detail: 'encoded_position_exceeds_limit' });
      }
    }
    if (spec.mandateRemainingMinor != null) {
      const deployed = to.cashMinor + to.marginUsedMinor + parseEncodedPositionUnitsMinor(to.positionEncoding);
      if (deployed > spec.mandateRemainingMinor) {
        violations.push({ kind: 'MANDATE', stepIndex: i, detail: 'mandate_exceeded' });
      }
    }
    if (spec.maxRiskNotionalMinor != null && fromNotional > spec.maxRiskNotionalMinor) {
      violations.push({ kind: 'RISK_LIMIT', stepIndex: i, detail: 'risk_notional_exceeded' });
    }
    if (trn) {
      if (!trn.capitalConserved) {
        violations.push({ kind: 'CAPITAL_CONSERVATION', stepIndex: i, detail: 'transition_not_conserved' });
      }
      if (!trn.settlementFeasible) {
        violations.push({ kind: 'SETTLEMENT', stepIndex: i, detail: 'settlement_infeasible' });
      }
      if (!trn.marginFeasible) {
        violations.push({ kind: 'MARGIN', stepIndex: i, detail: 'margin_infeasible' });
      }
    }
  }
  return violations;
}

function bellmanBackupForKey(
  tr: DecisionTrajectory,
  t: number,
  q: ReadonlyMap<string, bigint>,
  discountGamma: number,
  evaluationPolicyPmf: EvaluationPolicyPmf | undefined,
): bigint {
  const st = tr.steps[t]!;
  const key = trajectoryKey(st);
  const next = tr.steps[t + 1];
  if (!next) {
    return st.rewardMinor;
  }
  const pmf = evaluationPolicyPmf?.(next.stateKey);
  if (pmf && pmf.length > 0) {
    let ev = 0n;
    for (const { actionKey, probability } of pmf) {
      const stepLike = { ...next, actionKey };
      const qn = q.get(trajectoryKey(stepLike)) ?? 0n;
      ev += scaleBigIntMinor(qn, probability);
    }
    return st.rewardMinor + scaleBigIntMinor(ev, discountGamma);
  }
  return st.rewardMinor + scaleBigIntMinor(q.get(trajectoryKey(next)) ?? 0n, discountGamma);
}

function runTabularFqe(
  trajectories: readonly DecisionTrajectory[],
  input: SequentialOpeInput,
): { readonly q: Map<string, bigint>; readonly state: FittedQEvaluationState } {
  const { discountGamma, fqe, evaluationPolicyPmf } = input;
  const keys = new Set<string>();
  for (const tr of trajectories) {
    for (const st of tr.steps) {
      keys.add(trajectoryKey(st));
    }
  }
  const q = new Map<string, bigint>();
  for (const k of keys) {
    q.set(k, 0n);
  }

  let iter = 0;
  let prevResidualMean = Number.POSITIVE_INFINITY;
  let diverged = false;
  let converged = false;
  let bellmanResidualMean = 0;
  let bellmanResidualMax = 0;

  for (; iter < fqe.maxIterations; iter += 1) {
    const nextQ = new Map<string, bigint>();
    let absSum = 0;
    let maxDelta = 0;
    let count = 0;

    for (const k of keys) {
      const samples: bigint[] = [];
      for (const tr of trajectories) {
        for (let t = 0; t < tr.steps.length; t += 1) {
          if (trajectoryKey(tr.steps[t]!) === k) {
            samples.push(bellmanBackupForKey(tr, t, q, discountGamma, evaluationPolicyPmf));
          }
        }
      }
      if (samples.length === 0) {
        continue;
      }
      const sum = samples.reduce((a, b) => a + b, 0n);
      const mean = sum / BigInt(samples.length);
      const old = q.get(k) ?? 0n;
      const delta = mean > old ? mean - old : old - mean;
      absSum += Number(delta);
      maxDelta = Math.max(maxDelta, Number(delta));
      count += 1;
      nextQ.set(k, mean);
    }

    for (const [k, v] of nextQ) {
      q.set(k, v);
    }

    bellmanResidualMean = count > 0 ? absSum / count : 0;
    bellmanResidualMax = maxDelta;
    if (bellmanResidualMean < fqe.toleranceMean && iter > 0 && keys.size > 0) {
      converged = true;
      break;
    }
    if (keys.size === 0) {
      converged = true;
      break;
    }
    if (
      iter > 2 &&
      bellmanResidualMean >
        prevResidualMean * fqe.divergenceResidualRatio
    ) {
      diverged = true;
      break;
    }
    prevResidualMean = bellmanResidualMean;
  }

  const state: FittedQEvaluationState = Object.freeze({
    iteration: iter,
    bellmanResidualMean,
    bellmanResidualMax,
    converged,
    diverged,
  });
  return { q, state };
}

function fqeValueMinor(
  trajectories: readonly DecisionTrajectory[],
  q: ReadonlyMap<string, bigint>,
): bigint {
  if (trajectories.length === 0) {
    return 0n;
  }
  let s = 0n;
  for (const tr of trajectories) {
    const first = tr.steps[0];
    if (!first) {
      continue;
    }
    s += q.get(trajectoryKey(first)) ?? 0n;
  }
  return s / BigInt(trajectories.length);
}

function wisValueMinor(
  trajectories: readonly DecisionTrajectory[],
  discountGamma: number,
  finalWeights: readonly number[],
): bigint {
  const returns: bigint[] = [];
  const w: number[] = [];
  for (let i = 0; i < trajectories.length; i += 1) {
    const tr = trajectories[i]!;
    const g = discountedReturnMinor(tr.steps, discountGamma);
    const fw = finalWeights[i] ?? 1;
    returns.push(g);
    w.push(fw);
  }
  const num = trajectories.reduce((acc, _, i) => {
    const weight = w[i]!;
    const r = returns[i]!;
    return acc + bigIntToFloatScaled(r, weight);
  }, 0);
  const den = w.reduce((a, b) => a + b, 0);
  return den > 0 ? floatToBigIntMinor(num / den) : 0n;
}

/**
 * Sequential DR value for one trajectory:
 * V̂(s0) + Σ_t (Π_{i<t} ρ_i) γ^t ( r_t + γ V̂(s_{t+1}) - Q̂(s_t,a_t) ).
 */
function drTermsPerTrajectory(
  tr: DecisionTrajectory,
  gamma: number,
  rhos: readonly number[],
  qHat: QValueFunction,
  vHat: ValueFunction,
): bigint {
  if (tr.steps.length === 0) {
    return 0n;
  }
  let acc = vHat(tr.steps[0]!.stateKey);
  for (let t = 0; t < tr.steps.length; t += 1) {
    const st = tr.steps[t]!;
    const next = tr.steps[t + 1];
    const weightRho = rhos[t] ?? 1;
    const gpow = Math.pow(gamma, t);
    const r = st.rewardMinor;
    const qsa = qHat(st.stateKey, st.actionKey);
    const vNext = next ? vHat(next.stateKey) : 0n;
    const td = r + scaleBigIntMinor(vNext, gamma) - qsa;
    acc += scaleBigIntMinor(td, weightRho * gpow);
  }
  return acc;
}

export function evaluateSequentialOpe(input: SequentialOpeInput): SequentialOpeResult {
  const blockedReasons: string[] = [];
  const trajList = input.trajectories.map((b) => ({
    ...b.trajectory,
    schema: HELIOS_CF07_SEQUENTIAL_OPE_SCHEMA_VERSION,
  }));

  const allViolations: PortfolioConstraintViolation[] = [];
  for (const b of input.trajectories) {
    allViolations.push(...checkPortfolioPath(b, input.constraints));
  }

  const visitCounts = countSupport(trajList);

  const finalWeights: number[] = [];
  const perTrajRhos: number[][] = [];
  for (const b of input.trajectories) {
    const rhos = perStepImportanceRatios(b.trajectory.steps, input.propensityFloor);
    perTrajRhos.push(rhos);
    finalWeights.push(rhos.length > 0 ? rhos[rhos.length - 1]! : 1);
  }

  const support = assessTrajectorySupport(trajList, finalWeights, visitCounts, input.minSupportVisits);

  const importanceWeightExplosion = finalWeights.some((w) => w > input.maxImportanceWeight);
  const stateExtrapolationSuspected = support.stateExtrapolationFraction > 0.25;

  const { q, state: fqeState } = runTabularFqe(trajList, input);
  const fqeBlocked = fqeState.diverged || !fqeState.converged;

  const wisValue = wisValueMinor(trajList, input.discountGamma, finalWeights);

  const drTerms: bigint[] = [];
  if (input.doublyRobust) {
    for (let i = 0; i < input.trajectories.length; i += 1) {
      const tr = input.trajectories[i]!.trajectory;
      drTerms.push(
        drTermsPerTrajectory(tr, input.discountGamma, perTrajRhos[i]!, input.doublyRobust.qHat, input.doublyRobust.vHatPi),
      );
    }
  }

  const denDr = finalWeights.reduce((a, b) => a + b, 0);
  const drValue =
    input.doublyRobust && denDr > 0
      ? floatToBigIntMinor(
          input.trajectories.reduce(
            (acc, _, i) => acc + bigIntToFloatScaled(drTerms[i]!, finalWeights[i]!),
            0,
          ) / denDr,
        )
      : null;

  if (importanceWeightExplosion) {
    blockedReasons.push('importance_weight_cap');
  }
  if (fqeBlocked) {
    blockedReasons.push('fqe_not_converged');
  }
  if (support.blockReasons.length > 0) {
    blockedReasons.push(...support.blockReasons);
  }
  if (allViolations.length > 0) {
    blockedReasons.push('portfolio_path_invalid');
  }

  const diagnosticsBase: Omit<OpeDiagnostics, 'sequentialDoublyRobustTermsPerTrajectory'> = {
    fqe: fqeState,
    sequentialImportanceWeightsPerTrajectory: finalWeights,
    trajectorySupport: support,
    importanceWeightExplosion,
    stateExtrapolationSuspected,
  };

  const drTermsFloat = drTerms.map((x) => Number(x));

  const wisDiag: OpeDiagnostics = Object.freeze({
    ...diagnosticsBase,
    sequentialDoublyRobustTermsPerTrajectory: drTermsFloat,
  });

  const wisEstimateFinal: SequentialPolicyEstimate = Object.freeze({
    method: 'SEQUENTIAL_IMPORTANCE_SAMPLING' as const,
    valueMinor: wisValue,
    diagnostics: wisDiag,
  });

  const drEstimateFinal: SequentialPolicyEstimate | null =
    drValue != null && input.doublyRobust
      ? Object.freeze({
          method: 'SEQUENTIAL_DR' as const,
          valueMinor: drValue,
          diagnostics: wisDiag,
        })
      : null;

  const fqeEstimateFinal: SequentialPolicyEstimate | null = fqeBlocked
    ? null
    : Object.freeze({
        method: 'FQE_VALUE' as const,
        valueMinor: fqeValueMinor(trajList, q),
        diagnostics: wisDiag,
      });

  const qualified =
    blockedReasons.length === 0 &&
    !importanceWeightExplosion &&
    !fqeBlocked &&
    allViolations.length === 0;

  return Object.freeze({
    qualified,
    qualificationMarker: qualified
      ? HELIOS_CF07_SEQUENTIAL_OPE_QUALIFIED
      : HELIOS_CF07_SEQUENTIAL_OPE_BLOCKED,
    portfolioViolations: Object.freeze(allViolations),
    estimates: Object.freeze({
      wis: wisEstimateFinal,
      dr: drEstimateFinal,
      fqe: fqeEstimateFinal,
    }),
    blockedReasons: Object.freeze(blockedReasons),
  });
}
