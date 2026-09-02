/**
 * Wave 4 — Information Consensus evaluation boundary types.
 *
 * Information Consensus asks: "Do we have sufficient evidence that this
 * economic fact is true?" It never asks monetary authorization questions.
 */

import type {
  CandidateEconomicProposition,
  EntityResolutionBinding,
  NormalizedEconomicObservation,
  ObservationContradiction,
  ProviderLineage,
  RightsStatus,
} from '../types.ts';
import type { AuthorityClass } from '../../../../provider-sdk/src/observation-types.ts';
import type { FreshnessStatus } from '../../../../provider-sdk/src/observation-types.ts';

export const INFORMATION_CONSENSUS_SCHEMA_VERSION = 'sunrey.information-consensus.v1' as const;

export const INFORMATION_CONSENSUS_RESULTS = [
  'VERIFIED',
  'INSUFFICIENT_EVIDENCE',
  'DISPUTED',
  'STALE',
  'INVALID',
  'RIGHTS_RESTRICTED',
  'SOURCE_DEPENDENCY_FAILURE',
  'MANUAL_REVIEW_REQUIRED',
] as const;
export type InformationConsensusResult = (typeof INFORMATION_CONSENSUS_RESULTS)[number];

export const EXPLANATION_CODES = [
  'INDEPENDENT_SOURCE_QUORUM_MET',
  'INDEPENDENT_SOURCE_QUORUM_NOT_MET',
  'SHARED_UPSTREAM_LINEAGE',
  'CORROBORATION_RULE_SATISFIED',
  'CORROBORATION_RULE_UNSATISFIED',
  'MATERIAL_CONFLICT_DETECTED',
  'WITHIN_TOLERANCE',
  'OUTLIER_EXCLUDED',
  'FRESHNESS_OK',
  'FRESHNESS_STALE',
  'RIGHTS_CLEAR',
  'RIGHTS_RESTRICTED',
  'INTEGRITY_VERIFIED',
  'INTEGRITY_FAILED',
  'PROVIDER_UNVERIFIED',
  'REPUTATION_SUPPORTING',
  'REPUTATION_INSUFFICIENT',
  'HUMAN_ATTESTATION_REQUIRED',
  'HUMAN_ATTESTATION_PRESENT',
  'PRODUCTIVE_SOURCE_CLASS_REQUIRED',
  'ENTITY_RESOLUTION_BOUND',
  'ENTITY_RESOLUTION_MISSING',
  'SOURCE_DEPENDENCY_UNAVAILABLE',
  'MANUAL_REVIEW_TRIGGERED',
  'AI_ASSISTANCE_ONLY',
  'ZERO_MONETARY_AUTHORITY',
] as const;
export type ExplanationCode = (typeof EXPLANATION_CODES)[number];

export type ConfidenceAssessment = {
  readonly score: number;
  readonly band: 'HIGH' | 'MEDIUM' | 'LOW';
  readonly basis: readonly string[];
};

export type MethodologyReference = {
  readonly methodologyId: string;
  readonly version: string;
  readonly domain: 'PRODUCTIVE' | 'HUMAN' | 'REFERENCE' | 'GENERIC';
};

export type InformationConsensusInput = {
  readonly candidate: CandidateEconomicProposition;
  readonly observations: readonly NormalizedEconomicObservation[];
  readonly sourceIdentities: readonly string[];
  readonly sourceClasses: readonly string[];
  readonly providerLineage: readonly ProviderLineage[];
  readonly provenanceRefs: readonly string[];
  readonly freshness: FreshnessStatus;
  readonly confidence: ConfidenceAssessment | null;
  readonly rightsStatus: RightsStatus;
  readonly integrityStatus: 'VERIFIED' | 'TAMPERED' | 'INCOMPLETE' | 'UNVERIFIED';
  readonly entityResolution: EntityResolutionBinding | null;
  readonly contradictions: readonly ObservationContradiction[];
  readonly methodology: MethodologyReference;
  readonly evaluatedAt: string;
  readonly aiAssistance?: {
    readonly anomalyHints: readonly string[];
    readonly conflictExplanation: string | null;
    readonly entityMatchSuggestion: string | null;
  } | null;
};

export type IndependentSourceClassSummary = {
  readonly sourceClass: string;
  readonly lineageRootId: string;
  readonly providerIds: readonly string[];
  readonly observationIds: readonly string[];
};

export type CorroborationResult = {
  readonly satisfied: boolean;
  readonly requiredRules: readonly string[];
  readonly matchedRules: readonly string[];
  readonly independentSourceClassCount: number;
  readonly rawProviderCount: number;
};

export type ConflictAssessment = {
  readonly hasMaterialConflict: boolean;
  readonly hasOutlier: boolean;
  readonly withinTolerance: boolean;
  readonly conflicts: readonly {
    readonly leftObservationId: string;
    readonly rightObservationId: string;
    readonly leftValue: number;
    readonly rightValue: number;
    readonly relativeDelta: number;
    readonly material: boolean;
    readonly outlier: boolean;
  }[];
};

export type FreshnessAssessment = {
  readonly status: FreshnessStatus;
  readonly policyWindowMs: number;
  readonly oldestObservationAgeMs: number;
  readonly staleObservationIds: readonly string[];
};

export type RightsAssessment = {
  readonly status: RightsStatus;
  readonly restrictedObservationIds: readonly string[];
};

export type ReputationSummary = {
  readonly version: string;
  readonly scores: readonly {
    readonly providerId: string;
    readonly score: number;
    readonly factors: readonly {
      readonly factor: string;
      readonly value: number;
      readonly explanation: string;
    }[];
  }[];
};

export type InformationConsensusReceipt = {
  readonly schemaVersion: typeof INFORMATION_CONSENSUS_SCHEMA_VERSION;
  readonly evaluationId: string;
  readonly candidate: CandidateEconomicProposition;
  readonly observationIdsEvaluated: readonly string[];
  readonly independentSourceClasses: readonly IndependentSourceClassSummary[];
  readonly providerLineage: readonly ProviderLineage[];
  readonly corroboration: CorroborationResult;
  readonly conflicts: ConflictAssessment;
  readonly freshness: FreshnessAssessment;
  readonly rights: RightsAssessment;
  readonly reputation: ReputationSummary;
  readonly methodology: MethodologyReference;
  readonly result: InformationConsensusResult;
  readonly explanationCodes: readonly ExplanationCode[];
  readonly evaluatedAt: string;
  readonly referenceTimestamp: string;
  readonly grantsMonetaryAuthority: false;
  readonly grantsExecutionAuthority: false;
};

export type InformationConsensusEvaluation = {
  readonly receipt: InformationConsensusReceipt;
  readonly verifiedFact: import('./verified-fact.ts').InformationVerifiedEconomicFact | null;
};

export type InformationConsensusEvaluator = {
  readonly evaluate: (input: InformationConsensusInput) => InformationConsensusEvaluation;
};
