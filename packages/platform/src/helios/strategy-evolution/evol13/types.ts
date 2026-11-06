import type { UtcInstant } from '@solstice/domain';
import type {
  Evol13AllocationPolicyKind,
  ResearchStrategyNiche,
  StrategyEvolutionOperatorId,
} from './taxonomy.ts';

/** One evolution attempt: metrics are research-quality signals, not trading PnL. */
export type OperatorEvolutionRunEvent = {
  readonly runId: string;
  readonly operatorId: StrategyEvolutionOperatorId;
  readonly nicheId: ResearchStrategyNiche;
  /** Wall-clock instant when the run finished (UTC). */
  readonly evaluatedAt: UtcInstant;
  /** When downstream research outcomes become observable for credit (UTC). */
  readonly outcomeVisibleAt: UtcInstant;
  readonly candidateCount: number;
  readonly validCandidateCount: number;
  readonly aafPassCount: number;
  readonly holdoutPassCount: number;
  readonly falsificationPassCount: number;
  /** Count of distinct novel lineage IDs or feature hashes produced (integer). */
  readonly noveltyProducedCount: number;
  /** Niches newly covered by this run's outputs (subset of research niches). */
  readonly nicheCoverageAdded: readonly ResearchStrategyNiche[];
  readonly paperCandidateCount: number;
  /** Research compute charged for this run (minor units of budget currency). */
  readonly computeCostMinor: string;
};

/** Append-only record of evolution runs (simulation / in-memory port). */
export type OperatorPerformanceLedger = {
  readonly append: (event: OperatorEvolutionRunEvent) => void;
  readonly listRuns: () => readonly OperatorEvolutionRunEvent[];
};

/** Per-operator posterior / shrunk rates after applying priors and delay filter. */
export type OperatorCreditState = {
  readonly schema: 'sunrey.helios.strategy_evolution.operator_credit.v1';
  readonly asOf: UtcInstant;
  readonly creditDelayMs: number;
  readonly entries: Readonly<
    Record<
      StrategyEvolutionOperatorId,
      {
        readonly posteriorValidRateBps: number;
        readonly posteriorAafPassRateBps: number;
        readonly posteriorHoldoutPassRateBps: number;
        readonly posteriorFalsificationPassRateBps: number;
        readonly posteriorPaperCandidateRateBps: number;
        /** Informational: average novelty per candidate (minor integer ratio × 10⁴ bps scale avoided; use bigint numerators in scoring). */
        readonly noveltyPerCandidateBps: number;
        readonly runsCredited: number;
        readonly totalComputeMinor: string;
      }
    >
  >;
};

export type NicheOperatorPerformance = {
  readonly nicheId: ResearchStrategyNiche;
  readonly asOf: UtcInstant;
  readonly perOperator: Readonly<
    Record<
      StrategyEvolutionOperatorId,
      {
        readonly posteriorValidRateBps: number;
        readonly posteriorAafPassRateBps: number;
        readonly runsCredited: number;
      }
    >
  >;
};

export type ResearchAllocationPolicy = {
  readonly kind: Evol13AllocationPolicyKind;
  /** Minimum share of total research compute reserved for exploration (basis points of total). */
  readonly explorationBudgetBps: number;
  /** Hard cap on any single operator's share after exploration reservation (basis points of total). */
  readonly maxOperatorShareBps: number;
  /** Prior strength Beta(α,α) symmetric prior for rate estimates (higher = more shrinkage). */
  readonly symmetricBetaPriorAlpha: number;
  /** Delay before a run's outcomes affect credit and allocation (ms). */
  readonly outcomeCreditDelayMs: number;
  /** UCB exploration coefficient (used when kind === 'UCB'). */
  readonly ucbExplorationCoefficient: number;
};

export type ResearchComputeAllocation = {
  readonly totalResearchComputeMinor: string;
  readonly byOperator: Readonly<Record<StrategyEvolutionOperatorId, string>>;
  readonly policy: ResearchAllocationPolicy;
  readonly asOf: UtcInstant;
};

/** Optional H20 bridge: scales marginal research cost estimate by inverse operator productivity. */
export type H20Evol13ProductivityFactor = {
  readonly operatorId: StrategyEvolutionOperatorId;
  /** Integer in [10_000, 100_000] — 1.0 at 10_000 bps. */
  readonly productivityBps: number;
  readonly suggestedMarginalCostMinor: string;
};
