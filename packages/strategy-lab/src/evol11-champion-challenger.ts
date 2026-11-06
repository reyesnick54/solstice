/**
 * HELIOS EVOL11 — champion–challenger strategy lifecycle (research / simulation only).
 * A champion designation is not live capital authorization; `liveEligible` stays false everywhere.
 */

import type { UtcInstant } from '@solstice/domain';
import type { ForwardShadowEvidenceSummary } from './forward-shadow.ts';
import type { StrategyPromotionState } from './promotion-state.ts';

/** Program qualification marker for EVOL11 champion–challenger lifecycle. */
export const HELIOS_EVOL11_CHAMPION_CHALLENGER_QUALIFIED =
  'HELIOS_EVOL11_CHAMPION_CHALLENGER_QUALIFIED' as const;

/** Ordered research gates before shadow (logical sequence; enforcement is promotion-state). */
export const EVOL11_CHALLENGE_PROCESS_STAGES = Object.freeze([
  'CANDIDATE',
  'AAF',
  'HISTORICAL',
  'NESTED_VALIDATION',
  'SEALED_HOLDOUT',
  'WALK_FORWARD',
  'FALSIFICATION',
  'SHADOW',
  'PAPER',
  'CHAMPION_COMPARISON',
] as const);

export type Evol11ChallengeProcessStage = (typeof EVOL11_CHALLENGE_PROCESS_STAGES)[number];

/** Comparison dimensions for challenger vs incumbent (no mandatory single scalar score). */
export const EVOL11_CHALLENGE_COMPARISON_DIMENSIONS = Object.freeze([
  'NET_RETURNS_MINOR',
  'MAX_DRAWDOWN_BPS',
  'RISK_ADJUSTED_SCORE',
  'TURNOVER_BPS',
  'COSTS_MINOR',
  'CAPACITY_MINOR',
  'TAIL_RISK_PROXY',
  'REGIME_ROBUSTNESS',
  'STABILITY',
  'PBO',
  'DSR',
  'BEHAVIORAL_DIVERSITY',
] as const);

export type Evol11ComparisonDimension = (typeof EVOL11_CHALLENGE_COMPARISON_DIMENSIONS)[number];

/** Per-dimension challenger minus incumbent; lower-is-better dimensions use challenger minus incumbent with invertDominance. */
export type Evol11SignedDeltaMinor = bigint;

export type Evol11ComparisonDeltas = Readonly<Partial<Record<Evol11ComparisonDimension, Evol11SignedDeltaMinor>>>;

/** Dimensions where a smaller raw value is better (e.g. drawdown magnitude, costs). */
export const EVOL11_LOWER_IS_BETTER: ReadonlySet<Evol11ComparisonDimension> = new Set([
  'MAX_DRAWDOWN_BPS',
  'TURNOVER_BPS',
  'COSTS_MINOR',
  'TAIL_RISK_PROXY',
  'PBO',
]);

export type Evol11ParetoDominanceResult = {
  readonly challengerDominatesIncumbent: boolean;
  readonly incumbentDominatesChallenger: boolean;
  readonly incomparableDimensions: readonly Evol11ComparisonDimension[];
  readonly dimensionOutcomes: Readonly<
    Partial<
      Record<
        Evol11ComparisonDimension,
        'CHALLENGER_STRICTLY_BETTER' | 'INCUMBENT_STRICTLY_BETTER' | 'TIE' | 'UNSIGNED'
      >
    >
  >;
};

/**
 * Pareto-style strict comparison on signed deltas (challenger − incumbent).
 * For "lower is better" dimensions, a negative delta favors the challenger.
 */
export function evaluateEvol11ParetoDominance(input: {
  readonly deltas: Evol11ComparisonDeltas;
  readonly dimensions: readonly Evol11ComparisonDimension[];
}): Evol11ParetoDominanceResult {
  const incomparable: Evol11ComparisonDimension[] = [];
  const dimensionOutcomes: Partial<
    Record<
      Evol11ComparisonDimension,
      'CHALLENGER_STRICTLY_BETTER' | 'INCUMBENT_STRICTLY_BETTER' | 'TIE' | 'UNSIGNED'
    >
  > = {};
  let challengerBetterCount = 0;
  let incumbentBetterCount = 0;
  for (const dimension of input.dimensions) {
    const raw = input.deltas[dimension];
    if (raw === undefined) {
      incomparable.push(dimension);
      dimensionOutcomes[dimension] = 'UNSIGNED';
      continue;
    }
    const lowerBetter = EVOL11_LOWER_IS_BETTER.has(dimension);
    const favorsChallenger = lowerBetter ? raw < 0n : raw > 0n;
    const favorsIncumbent = lowerBetter ? raw > 0n : raw < 0n;
    if (raw === 0n) {
      dimensionOutcomes[dimension] = 'TIE';
      continue;
    }
    if (favorsChallenger) {
      dimensionOutcomes[dimension] = 'CHALLENGER_STRICTLY_BETTER';
      challengerBetterCount += 1;
    } else if (favorsIncumbent) {
      dimensionOutcomes[dimension] = 'INCUMBENT_STRICTLY_BETTER';
      incumbentBetterCount += 1;
    }
  }
  const challengerDominatesIncumbent =
    challengerBetterCount > 0 && incumbentBetterCount === 0 && incomparable.length === 0;
  const incumbentDominatesChallenger =
    incumbentBetterCount > 0 && challengerBetterCount === 0 && incomparable.length === 0;
  return Object.freeze({
    challengerDominatesIncumbent,
    incumbentDominatesChallenger,
    incomparableDimensions: Object.freeze([...incomparable]),
    dimensionOutcomes: Object.freeze(dimensionOutcomes),
  });
}

/**
 * Material improvement with uncertainty: require strict Pareto dominance on a core subset
 * and non-trivial margin on at least one dimension (|delta| >= materialityMinor), unless
 * statistical confidence is explicitly high (confidenceHigh allows tie-break on magnitude).
 */
export function assessEvol11MaterialChampionReplacement(input: {
  readonly deltas: Evol11ComparisonDeltas;
  readonly coreDimensions: readonly Evol11ComparisonDimension[];
  readonly materialityMinor: bigint;
  readonly confidenceHigh: boolean;
  readonly pareto: Evol11ParetoDominanceResult;
}): { readonly permitsReplacement: false; readonly rationale: string } | { readonly permitsReplacement: true } {
  if (!input.pareto.challengerDominatesIncumbent) {
    return Object.freeze({
      permitsReplacement: false,
      rationale:
        'challenger does not strictly Pareto-dominate incumbent on the evaluated core dimensions; trivial noise or trade-offs remain',
    });
  }
  let hasMaterialEdge = false;
  for (const dimension of input.coreDimensions) {
    const delta = input.deltas[dimension];
    if (delta === undefined) {
      return Object.freeze({
        permitsReplacement: false,
        rationale: `missing delta for core dimension ${dimension}`,
      });
    }
    const magnitude = delta < 0n ? -delta : delta;
    if (magnitude >= input.materialityMinor) {
      hasMaterialEdge = true;
      break;
    }
  }
  if (!hasMaterialEdge && !input.confidenceHigh) {
    return Object.freeze({
      permitsReplacement: false,
      rationale: 'improvement margin below materiality threshold with insufficient statistical confidence',
    });
  }
  return Object.freeze({ permitsReplacement: true });
}

export type Evol11ChampionComparisonEvidence = {
  readonly comparedAt: UtcInstant;
  readonly incumbentStrategyId: string;
  readonly incumbentStrategyVersion: string;
  readonly challengerStrategyId: string;
  readonly challengerStrategyVersion: string;
  readonly deltas: Evol11ComparisonDeltas;
  readonly pareto: Evol11ParetoDominanceResult;
  readonly shadowSummary: ForwardShadowEvidenceSummary | null;
  readonly permitsChampionReplacement: boolean;
  readonly championIsResearchOnly: true;
  readonly noLiveCapitalAuthorization: true;
};

export type Evol11ForwardShadowRole = 'CHALLENGER' | 'INCUBATION';

export type Evol11PaperRole = 'CHALLENGER' | 'INCUBATION';

export function evol11DefaultForwardShadowRole(state: StrategyPromotionState): Evol11ForwardShadowRole {
  if (state === 'SHADOW_CHALLENGER' || state === 'QUALIFIED_CHALLENGER') return 'CHALLENGER';
  return 'INCUBATION';
}

export function evol11DefaultPaperRole(state: StrategyPromotionState): Evol11PaperRole {
  if (state === 'PAPER_CHALLENGER') return 'CHALLENGER';
  return 'INCUBATION';
}
