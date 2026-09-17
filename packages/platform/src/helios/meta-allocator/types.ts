import type { CustomerId, UtcInstant } from '@solstice/domain';
import type { WorkOrderDisposition } from '../../work-order/taxonomy.ts';
import type { ResearchBudgetSnapshot } from '../execution-types.ts';
import type { OpportunityCandidateId } from '../executable-opportunity/ids.ts';
import type { EconomicWorkOrderId } from '../ids.ts';
import type { EconomicWorkOrder } from '../types.ts';
import type { StrategyCapsuleRef as DecisionValidityCapsuleRef } from '../strategy-capsule/types.ts';
import type {
  CapitalRecommendationDecision,
  ConfidenceState,
  CostAttributionClass,
  EvidenceQualityLevel,
  LiquidityState,
  MetaAllocatorReasonCode,
  ResearchReuseRights,
  ResearchSpendDecision,
  StrategyQualificationState,
} from './taxonomy.ts';
import type { META_ALLOCATOR_POLICY_VERSION } from './taxonomy.ts';
import type {
  CapitalRecommendationId,
  MetaAllocationCandidateId,
  MetaAllocationDecisionId,
  MetaAllocationRunId,
  ResearchSpendRecommendationId,
} from './ids.ts';

export const HELIOS_H20_META_ALLOCATOR = 'HELIOS_H20_META_ALLOCATOR' as const;

export type SpecialistOutputSummary = {
  readonly specialistId: string;
  readonly role: string;
  readonly stance: 'SUPPORTING' | 'OPPOSING' | 'NEUTRAL';
  readonly summary: string;
  readonly confidenceState: ConfidenceState;
  readonly evidenceRefs: readonly string[];
};

export type StrategyCapsuleRef = {
  readonly strategyId: string;
  readonly version: string;
  readonly qualificationState: StrategyQualificationState;
  readonly validationEvidenceRefs: readonly string[];
};

export type AccountStateReference = {
  readonly accountId: string;
  readonly availableCashMinor: string;
  readonly currency: string;
  readonly reservedCashMinor: string;
  readonly accountSizeMinor: string;
  readonly stateVersion: string;
  readonly capturedAt: UtcInstant;
};

export type PortfolioExposure = {
  readonly instrumentId: string;
  readonly sector: string;
  readonly currency: string;
  readonly marketValueMinor: string;
  readonly concentrationBps: number;
};

export type PortfolioContext = {
  readonly exposures: readonly PortfolioExposure[];
  readonly sectorConcentrationBps: Readonly<Record<string, number>>;
  readonly currencyConcentrationBps: Readonly<Record<string, number>>;
  readonly liquidityRequirementMinor: string;
  readonly mandateConstraintRefs: readonly string[];
  readonly stateVersion: string;
};

export type TradingCostAssumptions = {
  readonly minimumOrderSizeMinor: string;
  readonly spreadBps: number;
  readonly commissionMinor: string;
  readonly slippageBps: number;
  readonly inferenceCostMinor: string;
  readonly dataCostMinor: string;
  readonly currency: string;
};

export type ResearchValueInput = {
  readonly evidenceQuality: EvidenceQualityLevel;
  readonly unresolvedUncertainty: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly specialistDisagreement: boolean;
  readonly estimatedOpportunitySizeMinor: string;
  readonly confidenceState: ConfidenceState;
  readonly calibratedProbabilityBps: number | null;
  readonly estimatedResearchCostMinor: string;
  readonly opportunityHalfLifeHours: number;
  readonly timeRemainingHours: number;
  readonly dataAvailable: boolean;
  readonly accountSizeFeasible: boolean;
};

export type ResearchValueAssessment = {
  readonly informationValueTier: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  readonly economicallyJustified: boolean;
  readonly confidenceState: ConfidenceState;
  readonly reasonCodes: readonly MetaAllocatorReasonCode[];
  readonly marginalResearchCostMinor: string;
  readonly publicReuseApplied: boolean;
};

export type ResearchSpendRecommendation = {
  readonly recommendationId: ResearchSpendRecommendationId;
  readonly decision: ResearchSpendDecision;
  readonly maxResearchSpendMinor: string;
  readonly currency: string;
  readonly assessment: ResearchValueAssessment;
  readonly budgetSnapshotRef: string;
  readonly reasonCodes: readonly MetaAllocatorReasonCode[];
  readonly expiresAt: UtcInstant;
};

export type FeasibilityAssessment = {
  readonly feasible: boolean;
  readonly minimumOrderSizeMinor: string;
  readonly estimatedDeploymentMinor: string;
  readonly estimatedTotalCostMinor: string;
  readonly edgeAfterCostsMinor: string;
  readonly liquidityState: LiquidityState;
  readonly concentrationImpactBps: number;
  readonly reasonCodes: readonly MetaAllocatorReasonCode[];
};

export type CapitalAllocationRecommendation = {
  readonly recommendationId: CapitalRecommendationId;
  readonly candidateId: MetaAllocationCandidateId;
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: CustomerId;
  readonly strategyCapsule: StrategyCapsuleRef;
  readonly availableCapitalRef: AccountStateReference;
  readonly recommendedMaxCapitalMinor: string;
  readonly recommendedPercentageBps: number;
  readonly expectedHoldingHorizonDays: number;
  readonly costAssumptions: TradingCostAssumptions;
  readonly liquidityState: LiquidityState;
  readonly concentrationImpactBps: number;
  readonly supportingOutputs: readonly SpecialistOutputSummary[];
  readonly opposingOutputs: readonly SpecialistOutputSummary[];
  readonly uncertainty: ConfidenceState;
  readonly validityExpiresAt: UtcInstant;
  readonly recommendation: CapitalRecommendationDecision;
  readonly reasonCodes: readonly MetaAllocatorReasonCode[];
  readonly grantsFinancialEffect: false;
  readonly postsReservation: false;
};

export type CostAttributionRecord = {
  readonly class: CostAttributionClass;
  readonly amountMinor: string;
  readonly currency: string;
  readonly candidateId: MetaAllocationCandidateId | null;
  readonly recordedAt: UtcInstant;
};

export type PublicResearchReuseRecord = {
  readonly reuseId: string;
  readonly sourceResearchId: string;
  readonly provenanceRef: string;
  readonly rights: ResearchReuseRights;
  readonly marginalCostMinor: string;
  readonly freshnessExpiresAt: UtcInstant;
  readonly customerContextLeaked: false;
};

export type CalibrationRecord = {
  readonly recordId: string;
  readonly candidateId: MetaAllocationCandidateId;
  readonly predictedConfidenceState: ConfidenceState;
  readonly predictedProbabilityBps: number | null;
  readonly observedOutcome: 'PENDING' | 'CONFIRMED' | 'REFUTED' | 'INCONCLUSIVE';
  readonly recordedAt: UtcInstant;
};

export type MetaAllocationCandidateInput = {
  readonly candidateId: MetaAllocationCandidateId;
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: CustomerId;
  readonly subjectId: string;
  readonly instrumentId: string;
  readonly sector: string;
  readonly currency: string;
  readonly strategyCapsule: StrategyCapsuleRef;
  readonly researchValue: ResearchValueInput;
  readonly specialistOutputs: readonly SpecialistOutputSummary[];
  readonly evidenceRefs: readonly string[];
  readonly estimatedDeploymentMinor: string;
  readonly liquidityState: LiquidityState;
  readonly costAssumptions: TradingCostAssumptions;
  readonly publicResearchReuse?: PublicResearchReuseRecord | null;
};

export type CapitalCoordinationClaim = {
  readonly candidateId: MetaAllocationCandidateId;
  readonly claimedCapitalMinor: string;
  readonly currency: string;
  readonly recommendationId: CapitalRecommendationId;
};

export type MetaAllocationDecision = {
  readonly decisionId: MetaAllocationDecisionId;
  readonly runId: MetaAllocationRunId;
  readonly candidateId: MetaAllocationCandidateId;
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: CustomerId;
  readonly disposition: WorkOrderDisposition;
  readonly researchSpend: ResearchSpendRecommendation;
  readonly capitalRecommendation: CapitalAllocationRecommendation | null;
  readonly feasibility: FeasibilityAssessment;
  readonly reasonCodes: readonly MetaAllocatorReasonCode[];
  readonly policyVersion: typeof META_ALLOCATOR_POLICY_VERSION;
  readonly evidenceRefs: readonly string[];
  readonly specialistOutputRefs: readonly string[];
  readonly accountStateRef: AccountStateReference;
  readonly budgetStateRef: string;
  readonly decidedAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly grantsFinancialEffect: false;
  readonly postsReservation: false;
};

export type MetaAllocationRunResult = {
  readonly runId: MetaAllocationRunId;
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: CustomerId;
  readonly decisions: readonly MetaAllocationDecision[];
  readonly coordinationClaims: readonly CapitalCoordinationClaim[];
  readonly unallocatedCashMinor: string;
  readonly currency: string;
  readonly holdCash: boolean;
  readonly decidedAt: UtcInstant;
  readonly policyVersion: typeof META_ALLOCATOR_POLICY_VERSION;
  readonly grantsFinancialEffect: false;
};

export type MetaAllocationEvaluateInput = {
  readonly runId: MetaAllocationRunId;
  readonly workOrder: EconomicWorkOrder;
  readonly candidates: readonly MetaAllocationCandidateInput[];
  readonly researchBudget: ResearchBudgetSnapshot;
  readonly accountState: AccountStateReference;
  readonly portfolio: PortfolioContext;
  readonly maxSectorConcentrationBps: number;
  readonly now: UtcInstant;
  readonly validityHours?: number;
};

export type MetaAllocatorStoreSnapshot = {
  readonly runs: readonly MetaAllocationRunResult[];
  readonly decisions: readonly MetaAllocationDecision[];
  readonly calibrationRecords: readonly CalibrationRecord[];
  readonly costRecords: readonly CostAttributionRecord[];
};

export type MetaAllocatorFailure = {
  readonly code: 'CUSTOMER_MISMATCH' | 'WORK_ORDER_INACTIVE' | 'EMPTY_CANDIDATES' | 'INVALID_INPUT';
  readonly message: string;
};

/** H21 decision-validity envelope input; uses canonical Strategy Capsule refs. */
export type MetaAllocatorRecommendationId = `marec_${string}`;

export type MetaAllocatorRecommendation = {
  readonly recommendationId: MetaAllocatorRecommendationId;
  readonly candidateId: OpportunityCandidateId;
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: CustomerId;
  readonly capsuleRef: DecisionValidityCapsuleRef;
  readonly recommendedAt: UtcInstant;
  readonly expectedEdgeBps: number;
  readonly rationale: string;
  readonly grantsExecutionAuthority: false;
};
