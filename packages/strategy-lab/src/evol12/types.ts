import type { StrategyGenome } from '../os05/types.ts';
import type {
  HELIOS_EVOL12_STRATEGY_SCIENTIST_BLOCKED,
  HELIOS_EVOL12_STRATEGY_SCIENTIST_QUALIFIED,
  STRATEGY_SCIENTIST_GENOME_PROPOSAL_SCHEMA,
} from './taxonomy.ts';
import { STRATEGY_SCIENTIST_AGENT_ROLE } from './taxonomy.ts';

/** HELIOS research agent identity scoped to strategy-scientist lane (proposal-only). */
export type StrategyScientistAgent = {
  readonly role: typeof STRATEGY_SCIENTIST_AGENT_ROLE;
  /** Opaque agent reference, e.g. agent/strategy-scientist/research-1 */
  readonly agentRef: string;
};

/** Economic and experimental framing required for every genome proposal. */
export type StrategyRationale = {
  readonly economicRationale: string;
  readonly expectedEdge: string;
  readonly failureModes: readonly string[];
  readonly expectedRegime: string;
  readonly requiredFeatures: readonly string[];
  /** Human-readable horizon (deterministic evaluation still owns numeric horizons). */
  readonly expectedHoldingHorizonDescription: string;
  readonly falsifiableHypothesis: string;
};

export type ResearchHypothesis = {
  readonly hypothesisId: string;
  readonly statement: string;
  readonly prediction: string;
  readonly negation: string;
};

export type MutationProposal = {
  readonly kind: 'MUTATION';
  /** Declarative operator from catalog, or null when proposing a new catalog candidate for governance review. */
  readonly mutationOperatorCatalogRef: string | null;
  readonly description: string;
  readonly parentGenomeHash: string;
};

export type CrossoverProposal = {
  readonly kind: 'CROSSOVER';
  readonly parentGenomeHashes: readonly [string, string];
  readonly recombinationDescription: string;
};

export type NewFeatureHypothesis = {
  readonly kind: 'NEW_FEATURE_COMBINATION';
  readonly featureCombinationDescription: string;
  readonly regimeLogicDescription: string;
};

export type GenomeProposalMechanism = MutationProposal | CrossoverProposal | NewFeatureHypothesis;

export type GenomeProposalNoveltyMode = 'NOVEL' | 'PARAMETER_REFINEMENT';

/**
 * Typed envelope: LLM-authored narrative and mechanism fields + machine-validated declarative genome.
 * Sealed holdout outcomes are never present (`sealedHoldoutAccessDenied` is a const truth).
 */
export type GenomeProposal = {
  readonly schema: typeof STRATEGY_SCIENTIST_GENOME_PROPOSAL_SCHEMA;
  readonly proposalId: string;
  readonly scientist: StrategyScientistAgent;
  readonly researchHypothesis: ResearchHypothesis;
  readonly mechanism: GenomeProposalMechanism;
  readonly rationale: StrategyRationale;
  /** Must pass `validateStrategyGenome`; no executable strategy code. */
  readonly declarativeGenome: StrategyGenome;
  readonly novelty: {
    readonly mode: GenomeProposalNoveltyMode;
    /**
     * Archive genomes considered similar (for PARAMETER_REFINEMENT or governance review).
     * Empty when proposing a genuinely new lineage in NOVEL mode.
     */
    readonly similarArchiveGenomeHashes: readonly string[];
  };
  readonly suggestedExperiments: readonly string[];
  readonly sealedHoldoutAccessDenied: true;
};

/** Sandboxed memory visible to the scientist — excludes hidden holdout evaluation outcomes. */
export type FailedStrategySummary = {
  readonly genomeHash: string;
  readonly summary: string;
  readonly falsifiedAspect: string | null;
};

export type SuccessfulStrategySummary = {
  readonly genomeHash: string;
  readonly summary: string;
};

export type OperatorProductivityRow = {
  readonly operatorCatalogRef: string;
  readonly proposalsAccepted: number;
  readonly proposalsRejected: number;
};

export type NicheMapEntry = {
  readonly nicheId: string;
  readonly description: string;
  readonly coverage: 'SPARSE' | 'MODERATE' | 'DENSE';
};

export type ResearchGap = {
  readonly gapId: string;
  readonly description: string;
};

export type StrategyScientistResearchMemory = {
  readonly failedStrategies: readonly FailedStrategySummary[];
  readonly successfulStrategies: readonly SuccessfulStrategySummary[];
  readonly operatorProductivity: readonly OperatorProductivityRow[];
  readonly nicheMap: readonly NicheMapEntry[];
  readonly researchGaps: readonly ResearchGap[];
  readonly holdoutOutcomesWithheld: true;
};

export type Evol12QualificationChecks = {
  readonly proposalSchemaValid: boolean;
  readonly scientistRoleValid: boolean;
  readonly genomeStaticValidationPasses: boolean;
  readonly noveltyGatePasses: boolean;
  readonly holdoutSealed: boolean;
  readonly noExecutableStrategyEscape: boolean;
  readonly scientificLoopDocumented: boolean;
};

export type Evol12QualificationResult = {
  readonly marker:
    | typeof HELIOS_EVOL12_STRATEGY_SCIENTIST_QUALIFIED
    | typeof HELIOS_EVOL12_STRATEGY_SCIENTIST_BLOCKED;
  readonly blockers: readonly string[];
};
