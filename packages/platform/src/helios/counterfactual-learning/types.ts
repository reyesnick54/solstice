/**
 * CF01 canonical types — DecisionContext must contain only information knowable at decisionTime.
 * Outcomes are never part of DecisionContext; they attach via separate records after sealing.
 */

import type { UtcInstant } from '@solstice/domain';
import type { AdaptiveAlphaDatasetCertification } from '../adaptive-alpha-v2/types.ts';
import type { FeatureManifest } from '../feature-fabric/types.ts';
import type {
  HELIOS_COUNTERFACTUAL_LEARNING_SCHEMA,
  CounterfactualActionClass,
} from './taxonomy.ts';

export type DecisionReasonCode = string;

export type DecisionReason = {
  readonly code: DecisionReasonCode;
  readonly detail: string | null;
};

export type DecisionPolicySnapshot = {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly policyContentDigest: string;
};

/** Execution Twin / Strategy Lab binding digest — simulation posture only */
export type TwinBindingRef = {
  readonly bindingDigest: string;
  readonly executionTwinRunRef: string | null;
  readonly forwardShadowRunRef: string | null;
};

export type StrategyGenomeRef = {
  readonly genomeId: string;
  readonly genomeVersion: string;
  readonly contentDigest: string;
};

/**
 * Portfolio state as knowable at decisionTime (marks, positions, cash — no future realizations).
 */
export type PortfolioStateAtDecision = {
  readonly snapshotDigest: string;
  readonly reportingCurrency: string | null;
  readonly positionLineDigests: readonly string[];
  readonly cashMinorUnits: string | null;
};

/**
 * Market state as knowable at decisionTime (observations, microstructure summaries — no leaked future bars).
 */
export type MarketStateAtDecision = {
  readonly observationBundleDigest: string;
  readonly sessionLabel: string | null;
};

export type EarningsStateAtDecision = {
  readonly earningsKnowledgeDigest: string;
  readonly nextEventKnowable: boolean;
};

export type ValuationStateAtDecision = {
  readonly valuationSnapshotDigest: string;
  readonly methodologyId: string | null;
};

export type RegimeStateAtDecision = {
  readonly regimeLabel: string | null;
  readonly regimeModelDigest: string | null;
};

export type RiskStateAtDecision = {
  readonly riskBundleDigest: string;
  readonly stressBand: 'LOW' | 'NORMAL' | 'ELEVATED' | 'SEVERE' | 'UNKNOWN';
};

export type LiquidityStateAtDecision = {
  readonly liquidityDigest: string;
  readonly tradability: 'NORMAL' | 'DEGRADED' | 'HALTED' | 'UNKNOWN';
};

/**
 * Full point-in-time context for a research decision.
 * Must not include outcome paths, post-decision fills, or information whose knowable time is after decisionTime.
 */
export type DecisionContext = {
  readonly decisionTime: UtcInstant;
  readonly canonicalEntityId: string;
  readonly instrumentId: string | null;
  readonly portfolioState: PortfolioStateAtDecision;
  readonly marketState: MarketStateAtDecision;
  readonly featureManifest: FeatureManifest | null;
  readonly aafDatasetCertification: AdaptiveAlphaDatasetCertification | null;
  readonly earningsState: EarningsStateAtDecision | null;
  readonly valuationState: ValuationStateAtDecision | null;
  readonly regimeState: RegimeStateAtDecision | null;
  readonly riskState: RiskStateAtDecision | null;
  readonly liquidityState: LiquidityStateAtDecision | null;
  readonly twinBinding: TwinBindingRef | null;
  readonly growIntelligenceDigest: string | null;
  readonly outcomeAttributionSchemaRef: string | null;
};

export type CandidateAction = {
  readonly candidateId: string;
  readonly actionClass: CounterfactualActionClass;
  readonly parametersDigest: string;
  readonly label: string | null;
};

export type CandidateActionSet = {
  readonly setId: string;
  readonly candidates: readonly CandidateAction[];
  readonly contentDigest: string;
};

export type ObservedAction = {
  readonly actionClass: CounterfactualActionClass;
  readonly candidateId: string | null;
  readonly observedDigest: string;
  readonly source: 'CHOICE' | 'EXTERNAL' | 'POLICY_DEFAULT';
};

export type RejectedAction = {
  readonly candidateId: string;
  readonly actionClass: CounterfactualActionClass;
  readonly reasons: readonly DecisionReason[];
};

export type DecisionEvidenceSnapshot = {
  readonly evidenceVaultRefs: readonly string[];
  readonly contextDigest: string;
};

export type CounterfactualResearchManifest = {
  readonly manifestId: string;
  readonly contentDigest: string;
  readonly compilationNotes: string | null;
};

export type DecisionEpisodeSeal = {
  readonly sealedAt: UtcInstant;
  readonly episodeContentHash: string;
};

/**
 * Immutable once seal is non-null. Outcomes attach separately; do not mutate context after seal.
 */
export type DecisionEpisode = {
  readonly schema: typeof HELIOS_COUNTERFACTUAL_LEARNING_SCHEMA;
  readonly episodeId: string;
  readonly context: DecisionContext;
  readonly candidateSet: CandidateActionSet;
  readonly chosenAction: ObservedAction;
  readonly rejectedActions: readonly RejectedAction[];
  readonly reasons: readonly DecisionReason[];
  readonly policySnapshot: DecisionPolicySnapshot;
  readonly strategyGenome: StrategyGenomeRef;
  readonly modelVersions: Readonly<Record<string, string>>;
  readonly evidence: DecisionEvidenceSnapshot;
  readonly manifest: CounterfactualResearchManifest;
  readonly seal: DecisionEpisodeSeal | null;
  readonly grantsExecutionAuthority: false;
};

export type CounterfactualOutcomeKind =
  | 'FORWARD_SHADOW'
  | 'GROW_ATTRIBUTION'
  | 'EXECUTION_TWIN'
  | 'OUTCOME_ATTRIBUTION'
  | 'OTHER';

/**
 * Post-seal attachment linking a sealed episode to downstream outcome intelligence.
 * Kept distinct from DecisionEpisode to preserve immutability of the research-time record.
 */
export type CounterfactualOutcomeAttachment = {
  readonly schema: typeof HELIOS_COUNTERFACTUAL_LEARNING_SCHEMA;
  readonly attachmentId: string;
  readonly episodeId: string;
  readonly attachedAt: UtcInstant;
  readonly outcomeKind: CounterfactualOutcomeKind;
  readonly outcomeEvidenceRef: string;
  readonly contentDigest: string;
  readonly grantsExecutionAuthority: false;
};
