import type { GenomeNodeParams, StrategyGenome } from '../os05/types.ts';

import {
  HELIOS_EVOL07_BEHAVIOR_FINGERPRINT_SCHEMA_VERSION,
  HELIOS_EVOL07_NEAREST_NEIGHBOR_ENGINE_SCHEMA_VERSION,
  HELIOS_EVOL07_SEMANTIC_FINGERPRINT_SCHEMA_VERSION,
} from './taxonomy.ts';

/**
 * Behavioral summary on a fixed neutral diagnostic dataset — drives behavioral distance and anti-clone.
 * Values are bounded simulation diagnostics (no live capital paths).
 */
export type StrategyBehaviorFingerprint = {
  readonly datasetId: string;
  readonly schemaVersion: typeof HELIOS_EVOL07_BEHAVIOR_FINGERPRINT_SCHEMA_VERSION;
  /** Normalized trades per evaluation year [0, 1]. */
  readonly tradeFrequency: number;
  /** Mean holding horizon in bar periods, normalized [0, 1]. */
  readonly holdingPeriod: number;
  /** Share of evaluation periods with regime activation [0, 1]. */
  readonly regimeActivation: number;
  /** Net directional bias: -1 (short) … +1 (long). */
  readonly positionDirectionBias: number;
  /** Scalar proxy for factor/feature loadings [0, 1]. */
  readonly factorExposure: number;
  /** Market beta proxy from diagnostic run [-1, 1] scaled to [0, 1] in fingerprint helpers. */
  readonly beta: number;
  /** Turnover proxy [0, 1]. */
  readonly turnover: number;
  /** Drawdown severity proxy [0, 1] (deeper = higher). */
  readonly drawdownDepth: number;
  /** Recovery speed proxy [0, 1] after drawdown. */
  readonly drawdownRecovery: number;
  /** Lag-1 autocorrelation of diagnostic log-return shocks [-1, 1] stored as [0, 1] in normalization. */
  readonly returnAutocorr: number;
  /** Signal timing — mean decision lag in bars, normalized [0, 1]. */
  readonly signalTimingLag: number;
  /** Breadth of asset / instrument selection [0, 1]. */
  readonly assetSelectionBreadth: number;
};

export type StrategySemanticFingerprint = {
  readonly schemaVersion: typeof HELIOS_EVOL07_SEMANTIC_FINGERPRINT_SCHEMA_VERSION;
  /** Sorted edge list signatures for genome topology (structural distance). */
  readonly topologyEdgeSignatures: readonly string[];
  /** Multiset of feature family keys (catalog families / namespaces). */
  readonly featureFamilies: readonly string[];
  /** Encoded decision rules (conditions, signals, regime gates). */
  readonly decisionRuleSignatures: readonly string[];
};

export type StrategyNoveltyScore = {
  readonly schemaVersion: typeof HELIOS_EVOL07_NEAREST_NEIGHBOR_ENGINE_SCHEMA_VERSION;
  /** Minimum combined distance to archive / population (structural + parameter + behavioral). */
  readonly nearestNeighborDistance: number;
  /** Nearest-neighbor novelty in [0, 1]; higher = more novel relative to archive. */
  readonly noveltyScore: number;
  readonly nearestNeighborGenomeId: string | null;
};

export type PopulationDiversityArchiveEntry = {
  readonly genomeId: string;
  /** Snapshot of tunable genome parameters for anti-clone / distance without full node list. */
  readonly parameters: GenomeNodeParams;
  readonly behavior: StrategyBehaviorFingerprint;
  readonly semantic: StrategySemanticFingerprint;
};

/**
 * Rolling state for diversity — holds archived fingerprints for nearest-neighbor novelty.
 */
export type PopulationDiversityState = {
  readonly archive: readonly PopulationDiversityArchiveEntry[];
};

export type NoveltyDistanceWeights = {
  readonly structural: number;
  readonly parameter: number;
  readonly behavioral: number;
};

export type AntiCloneThresholds = {
  /** Maximum combined distance to treat as genome clone (structure + parameters). */
  readonly genomeRedundantMaxDistance: number;
  /** Maximum behavioral distance to treat as behavior clone (after genome passes). */
  readonly behaviorRedundantMaxDistance: number;
};

export type AntiCloneOutcome =
  | { readonly kind: 'ACCEPT' }
  | {
      readonly kind: 'GENOME_REDUNDANT';
      readonly nearestGenomeId: string;
      readonly genomeDistance: number;
    }
  | {
      readonly kind: 'BEHAVIOR_REDUNDANT';
      readonly nearestGenomeId: string;
      readonly behaviorDistance: number;
    };

export type ResearchSelectionNoveltyInput = {
  readonly candidateGenome: StrategyGenome;
  readonly behavior: StrategyBehaviorFingerprint;
  readonly novelty: StrategyNoveltyScore;
  /** True when the candidate passes validity / constraint gates upstream. */
  readonly candidateValid: boolean;
  /**
   * Rank in [0, 1]: 0 = best in cohort, 1 = worst. Used to avoid rewarding trivially inferior candidates.
   */
  readonly cohortFitnessRank: number;
};

export type ResearchSelectionNoveltyResult = {
  /** Additional selection mass from novelty (never the sole signal). */
  readonly noveltyReward: number;
  readonly applied: boolean;
  readonly reason: string;
};
