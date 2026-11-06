/**
 * HELIOS strategy evolution — EVOL04 quality-diversity (MAP-Elites style).
 * Behavior descriptors partition the search space; fitness is compared only within a niche.
 */

import type { Ratio } from '@solstice/risk';

/** High-level asset-class bucket for niche indexing. */
export type BehaviorAssetClass =
  | 'EQUITY'
  | 'FIXED_INCOME'
  | 'COMMODITY'
  | 'CRYPTO'
  | 'FX'
  | 'MULTI_ASSET'
  | 'OTHER';

/** Coarse signal / alpha family label. */
export type BehaviorSignalFamily =
  | 'MOMENTUM'
  | 'MEAN_REVERSION'
  | 'VALUE'
  | 'CARRY'
  | 'EVENT'
  | 'STAT_ARB'
  | 'MACHINE_LEARNED'
  | 'HYBRID'
  | 'OTHER';

export type BehaviorRegimePreference =
  | 'TRENDING'
  | 'MEAN_REVERTING'
  | 'HIGH_VOL'
  | 'LOW_VOL'
  | 'RISK_ON'
  | 'RISK_OFF'
  | 'NEUTRAL';

export type BehaviorDrawdownProfile =
  | 'SHALLOW'
  | 'MODERATE'
  | 'DEEP'
  | 'UNKNOWN';

export type BehaviorLongShortBias =
  | 'LONG_ONLY'
  | 'LONG_BIASED'
  | 'MARKET_NEUTRAL'
  | 'SHORT_BIASED'
  | 'SHORT_ONLY';

/**
 * Ordinal bins for continuous behavior axes used in MAP-Elites cells.
 * Values are 0..bins-1 after `binDescriptorValue`.
 */
export type BehaviorOrdinalBin = number;

/** Discrete behavioral coordinates of a strategy in niche space. */
export type BehaviorDescriptors = {
  readonly holdingHorizonBin: BehaviorOrdinalBin;
  readonly turnoverBin: BehaviorOrdinalBin;
  readonly assetClass: BehaviorAssetClass;
  readonly signalFamily: BehaviorSignalFamily;
  readonly trendSensitivityBin: BehaviorOrdinalBin;
  readonly meanReversionSensitivityBin: BehaviorOrdinalBin;
  readonly valuationSensitivityBin: BehaviorOrdinalBin;
  readonly earningsSensitivityBin: BehaviorOrdinalBin;
  readonly macroSensitivityBin: BehaviorOrdinalBin;
  readonly volatilityPreferenceBin: BehaviorOrdinalBin;
  readonly liquidityRequirementBin: BehaviorOrdinalBin;
  readonly marketBetaBin: BehaviorOrdinalBin;
  readonly drawdownProfile: BehaviorDrawdownProfile;
  readonly longShortBias: BehaviorLongShortBias;
  readonly regimePreference: BehaviorRegimePreference;
};

/**
 * Fully specifies one MAP-Elites cell: descriptor tuple plus archive parameters
 * (bin counts per continuous axis, for serialization stability).
 */
export type NicheDescriptor = {
  readonly descriptorVersion: 1;
  readonly behavior: BehaviorDescriptors;
  readonly bins: {
    readonly holdingHorizon: number;
    readonly turnover: number;
    readonly trendSensitivity: number;
    readonly meanReversionSensitivity: number;
    readonly valuationSensitivity: number;
    readonly earningsSensitivity: number;
    readonly macroSensitivity: number;
    readonly volatilityPreference: number;
    readonly liquidityRequirement: number;
    readonly marketBeta: number;
  };
};

/** Stable string key for a niche cell (for Map storage and logs). */
export type StrategyNiche = string;

/** Candidate identity and optional genome hash for diversity/collapse checks. */
export type EvolutionCandidateRef = {
  readonly candidateId: string;
  readonly genomeHash: string | null;
};

/**
 * Multi-objective fitness within a niche. All comparisons use this structure only;
 * there is no single universal scalar for cross-niche ranking.
 *
 * Use integer minor units or bounded ratios where applicable; avoid raw Sharpe as the sole objective.
 */
export type NicheFitnessComponents = {
  /** Prefer @solstice/risk Ratio units (scale-8), or null if undefined. */
  readonly riskAdjustedPerformance: Ratio | null;
  /** Maximum drawdown as a ratio (scale-8), lower is better. */
  readonly maxDrawdown: Ratio | null;
  /** Stability of outcomes (e.g. cross-fold agreement), 0..1 higher is better. */
  readonly stabilityScore: number;
  /** Total explicit costs in minor units (lower is better after normalization). */
  readonly transactionCostsMinor: bigint;
  /** Capacity utilization or headroom signal, application-defined scale (higher often better). */
  readonly capacityScore: number;
  /** Annualized turnover in basis points of capital (context for costs, not sole fitness). */
  readonly turnoverBps: bigint;
  /** Adaptive alpha / feature-fabric integrity gate, 0..1 (higher = passes stronger checks). */
  readonly aafIntegrityScore: number;
  /** Holdout-set robustness, 0..1. */
  readonly holdoutRobustnessScore: number;
  /** Walk-forward robustness (e.g. fraction of folds above threshold), 0..1. */
  readonly walkForwardRobustnessScore: number;
  /**
   * Probability of backtest overfitting (lower is better). In [0, 1] when calibrated;
   * use null when not computed.
   */
  readonly probabilityOfOverfitting: number | null;
  /**
   * Deflated Sharpe ratio — shrinkage-adjusted significance (higher is better when defined).
   * Stored as unitless statistic; null when not computed.
   */
  readonly deflatedSharpeRatio: number | null;
};

/** One elite entry in the MAP-Elites grid. */
export type NicheElite = {
  readonly niche: StrategyNiche;
  readonly descriptor: NicheDescriptor;
  readonly candidate: EvolutionCandidateRef;
  readonly fitness: NicheFitnessComponents;
  readonly qualityDiversityScore: number;
  readonly qualified: boolean;
  readonly updatedAt: string;
};

export type DiversityCollapseReport = {
  /** Fraction of filled niches whose elite shares the same genome hash as the mode hash. */
  readonly geneticSimilarityMass: number;
  /** Average pairwise cosine similarity of behavior descriptor bin vectors (0..1). */
  readonly behavioralSimilarityMean: number;
  readonly collapseDetected: boolean;
  readonly modeGenomeHash: string | null;
};

export type NicheArchiveStats = {
  readonly nicheCount: number;
  readonly filledNicheCount: number;
  readonly emptyNicheFraction: number;
  readonly researchBudgetForEmptyNiches: number;
  readonly diversity: DiversityCollapseReport;
};

export type NicheArchive = {
  readonly elites: ReadonlyMap<StrategyNiche, NicheElite>;
};
