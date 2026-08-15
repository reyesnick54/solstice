import type { UtcInstant } from '../../domain/src/time.ts';
import type { DecisionStatus } from '../../permissions/src/decision.ts';
import type {
  LegalReviewStatus,
  PolicyPackId,
  PolicyVersionDiff,
  PolicyVersionRecord,
  SourceReference,
} from '../../kernel/src/policy/index.ts';
import type {
  CandidatePolicySetId,
  ImpactReportId,
  OpaqueSubjectRef,
  ReadinessReviewId,
  RegulatoryAssumptionId,
  RegulatoryReadinessAssessmentId,
  RegulatoryScenarioId,
  RegulatoryScenarioSuiteId,
  RegulatorySnapshotId,
  RegulatoryTwinId,
  ScenarioRunId,
} from './ids.ts';
import type {
  DecisionTransition,
  FactSourceKind,
  GrowthImpactState,
  RdtDecisionClass,
  ReadinessDisposition,
  ReadinessState,
  RestrictivenessChange,
  ScenarioCategory,
} from './taxonomy.ts';

export type ClassifiedFact<T> = {
  readonly value: T;
  readonly source: FactSourceKind;
};

export type ScenarioFactBundle = {
  readonly jurisdiction?: ClassifiedFact<string>;
  readonly actorId?: ClassifiedFact<string>;
  readonly customerId?: ClassifiedFact<string>;
  readonly customerStatus?: ClassifiedFact<string>;
  readonly kycState?: ClassifiedFact<string>;
  readonly kycRecordVersion?: ClassifiedFact<number>;
  readonly residency?: ClassifiedFact<string>;
  readonly productId?: ClassifiedFact<string>;
  readonly actionType?: ClassifiedFact<string>;
  readonly amountMinorUnits?: ClassifiedFact<string>;
  readonly currency?: ClassifiedFact<string>;
  readonly beneficiaryStatus?: ClassifiedFact<string>;
  readonly corridorId?: ClassifiedFact<string>;
  readonly corridorSimulationEnabled?: ClassifiedFact<boolean>;
  readonly legalEntityId?: ClassifiedFact<string>;
  readonly sanctionsHit?: ClassifiedFact<boolean>;
  readonly pepHit?: ClassifiedFact<boolean>;
  readonly fraudHold?: ClassifiedFact<boolean>;
  readonly screeningFresh?: ClassifiedFact<boolean>;
  readonly cardProgramId?: ClassifiedFact<string>;
  readonly treasuryRouteId?: ClassifiedFact<string>;
  readonly identityRevoked?: ClassifiedFact<boolean>;
};

export type RegulatorySnapshot = {
  readonly snapshotId: RegulatorySnapshotId;
  readonly twinId: RegulatoryTwinId;
  readonly capturedAt: UtcInstant;
  readonly effectiveAt: UtcInstant;
  readonly environment: 'simulation';
  readonly packRefs: readonly {
    readonly packId: PolicyPackId;
    readonly versionId: string;
    readonly version: string;
    readonly contentHash: string;
    readonly lifecycle: string;
    readonly legalReviewStatus: LegalReviewStatus;
    readonly screeningRequirementsHash: string | null;
  }[];
  readonly sourceRefs: readonly SourceReference[];
  readonly legalEntityCapabilityRefs: readonly {
    readonly capabilityId: string;
    readonly legalEntityId: string;
    readonly enabled: boolean;
    readonly environment: string;
    readonly legalReviewStatus: LegalReviewStatus;
  }[];
  readonly productCapabilityRefs: readonly {
    readonly productId: string;
    readonly servingLegalEntityId: string;
    readonly offeringMode: string;
    readonly requiredCapabilityId: string;
  }[];
  readonly contentHash: string;
  readonly simulationOnly: true;
};

export type CandidatePolicySet = {
  readonly candidateSetId: CandidatePolicySetId;
  readonly label: string;
  readonly createdAt: UtcInstant;
  readonly versions: readonly PolicyVersionRecord[];
  readonly sourceRefs: readonly string[];
  readonly legalReviewStatus: LegalReviewStatus;
  readonly notes: string;
};

export type RegulatoryScenario = {
  readonly scenarioId: RegulatoryScenarioId;
  readonly suiteId?: RegulatoryScenarioSuiteId;
  readonly name: string;
  readonly category: ScenarioCategory;
  readonly createdAt: UtcInstant;
  readonly facts: ScenarioFactBundle;
  readonly proposedPolicyVersionId?: string;
  readonly hypotheticalOverrides: readonly string[];
  readonly expectedInvariantDecision?: DecisionStatus;
  readonly invariant: boolean;
  readonly subjectRef?: OpaqueSubjectRef;
  readonly historicalPolicyPin?: {
    readonly packId: PolicyPackId;
    readonly versionId: string;
  };
  readonly historicalDecision?: DecisionStatus;
};

export type RegulatoryScenarioSuite = {
  readonly suiteId: RegulatoryScenarioSuiteId;
  readonly name: string;
  readonly category: ScenarioCategory;
  readonly scenarioIds: readonly RegulatoryScenarioId[];
  readonly invariant: boolean;
  readonly createdAt: UtcInstant;
};

export type SandboxEvaluation = {
  readonly decision: DecisionStatus;
  readonly decisionClass: RdtDecisionClass;
  readonly reasonCodes: readonly string[];
  readonly matchedRuleIds: readonly string[];
  readonly evaluatedRuleIds: readonly string[];
  readonly reviewRequired: boolean;
  readonly packId: string | null;
  readonly versionId: string | null;
  readonly packHash: string | null;
  readonly factsHash: string;
  readonly legalConfidence: LegalReviewStatus;
  readonly missingFacts: readonly string[];
  readonly executionAuthorityIssued: false;
  readonly journalPosted: false;
};

export type CurrentVsCandidateResult = {
  readonly runId: ScenarioRunId;
  readonly scenarioId: RegulatoryScenarioId;
  readonly baselineSnapshotId: RegulatorySnapshotId;
  readonly candidateSetId: CandidatePolicySetId;
  readonly evaluatedAt: UtcInstant;
  readonly current: SandboxEvaluation;
  readonly candidate: SandboxEvaluation;
  readonly changed: boolean;
  readonly transition: DecisionTransition;
  readonly restrictiveness: RestrictivenessChange;
  readonly reasonCodeDiff: {
    readonly added: readonly string[];
    readonly removed: readonly string[];
  };
  readonly ruleDiff: PolicyVersionDiff | null;
  readonly reviewRequirementDiff: {
    readonly currentReviewRequired: boolean;
    readonly candidateReviewRequired: boolean;
    readonly changed: boolean;
  };
  readonly legallyDesirable: null;
  readonly subjectRef?: OpaqueSubjectRef;
};

export type BatchImpactCounts = {
  readonly totalEvaluated: number;
  readonly unchanged: number;
  readonly newReview: number;
  readonly newBlock: number;
  readonly newDefer: number;
  readonly newAllow: number;
  readonly insufficientFacts: number;
};

export type BatchImpactResult = {
  readonly runId: ScenarioRunId;
  readonly suiteId: RegulatoryScenarioSuiteId;
  readonly baselineSnapshotId: RegulatorySnapshotId;
  readonly candidateSetId: CandidatePolicySetId;
  readonly evaluatedAt: UtcInstant;
  readonly counts: BatchImpactCounts;
  readonly transitions: readonly CurrentVsCandidateResult[];
};

export type RegulatoryAssumption = {
  readonly assumptionId: RegulatoryAssumptionId;
  readonly jurisdiction: string;
  readonly subject: string;
  readonly proposition: string;
  readonly sourceReferences: readonly string[];
  readonly legalReviewStatus: LegalReviewStatus;
  readonly createdAt: UtcInstant;
  readonly ownerRef: string;
  readonly reviewerRef?: string;
  readonly supersededBy?: RegulatoryAssumptionId;
};

export type MissingRequirement = {
  readonly code: string;
  readonly detail: string;
  readonly legalReviewStatus: LegalReviewStatus;
};

export type RegulatoryProductReadiness = {
  readonly assessmentId: RegulatoryReadinessAssessmentId;
  readonly kind: 'PRODUCT' | 'CORRIDOR' | 'CARD' | 'WALLET' | 'MERCHANT' | 'INVESTMENT';
  readonly subject: string;
  readonly jurisdiction: string;
  readonly legalEntityId: string;
  readonly state: ReadinessState;
  readonly missingRequirements: readonly MissingRequirement[];
  readonly unknownLegalFacts: readonly string[];
  readonly assumptions: readonly RegulatoryAssumptionId[];
  readonly legalReviewStatus: LegalReviewStatus;
  readonly forbiddenClaims: readonly never[];
  readonly simulationOnly: true;
  readonly liveActivationPermitted: false;
  readonly assessedAt: UtcInstant;
};

export type GrowthPlanImpact = {
  readonly planRef: string;
  readonly evaluatedAt: UtcInstant;
  readonly categories: readonly {
    readonly actionCategory: string;
    readonly state: GrowthImpactState;
    readonly currentDecision: RdtDecisionClass;
    readonly candidateDecision: RdtDecisionClass;
  }[];
  readonly simulationOnly: true;
};

export type PeveImpactEstimate = {
  readonly status: 'DEPENDENCY_NOT_IMPLEMENTED' | 'HYPOTHETICAL_IMPACT';
  readonly impactedOpportunityRefs: readonly string[];
  readonly label: 'HYPOTHETICAL';
  readonly note: string;
};

export type InvariantFailure = {
  readonly scenarioId: RegulatoryScenarioId;
  readonly name: string;
  readonly expected: DecisionStatus;
  readonly actual: DecisionStatus;
  readonly reasonCodes: readonly string[];
};

export type RegulatoryImpactReport = {
  readonly reportId: ImpactReportId;
  readonly twinId: RegulatoryTwinId;
  readonly baselineSnapshotId: RegulatorySnapshotId;
  readonly candidateSnapshotId: RegulatorySnapshotId | null;
  readonly candidateSetId: CandidatePolicySetId;
  readonly suiteId: RegulatoryScenarioSuiteId;
  readonly totalEvaluated: number;
  readonly counts: BatchImpactCounts;
  readonly decisionChanges: number;
  readonly materialChanges: number;
  readonly newBlocks: number;
  readonly newReviews: number;
  readonly invariantFailures: readonly InvariantFailure[];
  readonly assumptionIds: readonly RegulatoryAssumptionId[];
  readonly missingFacts: readonly string[];
  readonly legalReviewGaps: readonly string[];
  readonly candidateSimulationReady: boolean;
  readonly generatedAt: UtcInstant;
  readonly simulationOnly: true;
};

export type ReadinessReviewRecord = {
  readonly reviewId: ReadinessReviewId;
  readonly assessmentId: RegulatoryReadinessAssessmentId;
  readonly disposition: ReadinessDisposition;
  readonly decidedByKind: 'HUMAN_OPERATOR';
  readonly decidedByRef: string;
  readonly decidedAt: UtcInstant;
  readonly notes: string;
  readonly legalStatusUnchanged: true;
};

export type PolicyActivationRefusal = {
  readonly ok: false;
  readonly code: 'RDT_CANNOT_ACTIVATE_POLICY';
  readonly message: string;
};

export type RegulatoryTwinRecord = {
  readonly twinId: RegulatoryTwinId;
  readonly createdAt: UtcInstant;
  readonly label: string;
};
