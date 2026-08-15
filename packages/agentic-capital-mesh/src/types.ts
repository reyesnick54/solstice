import type { UtcInstant } from '../../domain/src/time.ts';
import type { ModelId, ModelVersion } from '../../model-registry/src/ids.ts';
import type { Ratio } from '../../risk/src/arithmetic.ts';
import type { RiskOutcome } from '../../risk/src/types.ts';
import type {
  CapitalAgentNodeId,
  CapitalAllocationCandidateId,
  CapitalArbitrationId,
  CapitalContextId,
  CapitalMeshId,
  CapitalMeshRunId,
  CapitalProposalId,
  CapitalReviewId,
  CapitalScenarioId,
  CapitalThesisId,
} from './ids.ts';
import type { MeshRunState } from './lifecycle.ts';

export const SPECIALIST_ROLES = [
  'MARKET_RESEARCH',
  'PORTFOLIO_CONSTRUCTION',
  'MANDATE_CRITIC',
  'RISK_CRITIC',
  'LIQUIDITY_CRITIC',
  'REGULATORY_CRITIC',
  'EXECUTION_FEASIBILITY',
  'OUTCOME_OBSERVER',
] as const;

export type SpecialistRole = (typeof SPECIALIST_ROLES)[number];

export const APPROVED_MESH_TOOLS = [
  'getPortfolio',
  'getMarketSnapshot',
  'getRiskSnapshot',
  'getMandate',
  'getGrowthPlan',
  'getEconomicValueSnapshot',
  'getInstrumentMetadata',
  'getRdtReadiness',
] as const;

export type ApprovedMeshTool = (typeof APPROVED_MESH_TOOLS)[number];

export const SCENARIO_KINDS = ['DOWNSIDE', 'BASE', 'UPSIDE'] as const;
export type ScenarioKind = (typeof SCENARIO_KINDS)[number];

export const FORBIDDEN_OUTCOME_SEMANTICS = ['GUARANTEED', 'CERTAIN_RETURN', 'GUARANTEED_PROFIT'] as const;

export const STRATEGY_VALIDATION_STATES = [
  'UNVALIDATED',
  'NEEDS_BACKTEST',
  'PAPER_ONLY_PENDING_VALIDATION',
  'REJECTED',
] as const;
export type StrategyValidationState = (typeof STRATEGY_VALIDATION_STATES)[number];

export const ARBITER_OUTCOMES = [
  'PROPOSAL_READY',
  'NEEDS_MORE_DATA',
  'NEEDS_BACKTEST',
  'NEEDS_HUMAN_REVIEW',
  'BLOCKED',
] as const;
export type ArbiterOutcome = (typeof ARBITER_OUTCOMES)[number];

export const HARD_VETO_REASONS = [
  'RISK_BLOCK',
  'MANDATE_VIOLATION',
  'POLICY_BLOCK',
  'COMPLIANCE_BLOCK',
  'ACCOUNT_RESTRICTED',
  'UNSUPPORTED_PRODUCT',
  'INSUFFICIENT_CAPITAL',
  'STALE_CRITICAL_DATA',
  'UNAPPROVED_MATERIAL_MODEL',
  'RDT_NOT_SUPPORTED',
  'INSTRUMENT_UNAVAILABLE',
] as const;
export type HardVetoReason = (typeof HARD_VETO_REASONS)[number];

export type ModelRef = {
  readonly modelId: ModelId;
  readonly version: ModelVersion;
};

export type HoldingFact = {
  readonly instrumentId: string;
  readonly instrumentType: string;
  readonly quantityUnits: bigint;
  readonly marketValueMinor: bigint;
  readonly priceMinor: bigint;
  readonly currency: string;
};

export type MarketPriceFact = {
  readonly instrumentId: string;
  readonly priceMinor: bigint;
  readonly currency: string;
  readonly quotedAt: UtcInstant;
  readonly stale: boolean;
};

export type InstrumentUniverseFact = {
  readonly instrumentId: string;
  readonly instrumentType: string;
  readonly available: boolean;
  readonly fractionalSupported: boolean;
  readonly incrementUnits: bigint;
  readonly currency: string;
};

export type MandateFact = {
  readonly mandateId: string;
  readonly version: number;
  readonly status: string;
  readonly hardConstraintKinds: readonly string[];
  readonly prohibitedCategories: readonly string[];
  readonly minimumLiquidMinor: bigint;
  readonly compatibleWithInvestment: boolean;
};

export type GrowthFact = {
  readonly planId: string;
  readonly version: number;
  readonly considersInvestment: boolean;
  readonly state: string;
};

export type PeveFact = {
  readonly snapshotId?: string;
  readonly resilienceLabel: string;
  readonly goalProgressLabel: string;
  readonly opportunityCapacityLabel: string;
  readonly compositeOptimizationForbidden: true;
  readonly humanWorthSemantics: false;
};

export type RdtFact = {
  readonly state: string;
  readonly legalReviewStatus: string;
  readonly simulationOnly: true;
  readonly regulatoryApproved: false;
};

export type TreasuryReadFact = {
  readonly note: string;
  readonly readOnly: true;
};

export type RiskBudgetFact = {
  readonly budgetId: string;
  readonly version: string;
  readonly maximumInstrumentConcentrationUnits: bigint;
  readonly minimumBrokerageCashMinor: bigint;
};

export type PortfolioFact = {
  readonly portfolioId: string;
  readonly brokerageCashMinor: bigint;
  readonly unsettledCashMinor: bigint;
  readonly pendingOrderNotionalMinor: bigint;
  readonly holdings: readonly HoldingFact[];
  readonly accountRestricted: boolean;
};

export type CapitalContext = {
  readonly contextId: CapitalContextId;
  readonly meshId: CapitalMeshId;
  readonly subjectId: string;
  readonly generatedAt: UtcInstant;
  readonly writePath: false;
  readonly pegSnapshotRef?: string;
  readonly mandate: MandateFact;
  readonly growth: GrowthFact;
  readonly peve: PeveFact;
  readonly portfolio: PortfolioFact;
  readonly riskBudget: RiskBudgetFact;
  readonly riskSnapshotRef?: string;
  readonly registeredModels: readonly ModelRef[];
  readonly universe: readonly InstrumentUniverseFact[];
  readonly market: readonly MarketPriceFact[];
  readonly rdt: RdtFact;
  readonly treasury?: TreasuryReadFact;
  readonly scheduledObligationMinor: bigint;
};

export type SpecialistNode = {
  readonly nodeId: CapitalAgentNodeId;
  readonly role: SpecialistRole;
  readonly model: ModelRef;
  readonly approvedTools: readonly ApprovedMeshTool[];
  readonly inputSchema: string;
  readonly outputSchema: string;
  readonly limits: readonly string[];
  readonly simulationOnly: true;
};

export type NodeOutput = {
  readonly nodeId: CapitalAgentNodeId;
  readonly role: SpecialistRole;
  readonly stance: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'CHALLENGE';
  readonly summary: string;
  readonly facts: readonly string[];
  readonly assumptions: readonly string[];
  readonly model: ModelRef;
};

export type CapitalThesis = {
  readonly thesisId: CapitalThesisId;
  readonly subjectId: string;
  readonly objective: string;
  readonly instrumentRefs: readonly string[];
  readonly horizon: string;
  readonly rationale: string;
  readonly sourceFacts: readonly string[];
  readonly assumptions: readonly string[];
  readonly expectedMechanism: string;
  readonly supportingEvidence: readonly string[];
  readonly contradictingEvidence: readonly string[];
  readonly riskFactors: readonly string[];
  readonly invalidationConditions: readonly string[];
  readonly scenarioOutcomes: readonly CapitalScenario[];
  readonly modelRefs: readonly ModelRef[];
  readonly createdAt: UtcInstant;
  readonly isTrade: false;
  readonly guaranteedReturn: false;
};

export type CapitalScenario = {
  readonly scenarioId: CapitalScenarioId;
  readonly kind: ScenarioKind;
  readonly narrative: string;
  readonly estimatedPortfolioMinor?: bigint;
  readonly guaranteed: false;
};

export type AllocationSlice = {
  readonly instrumentId: string;
  readonly weight: Ratio;
  readonly kind: 'INSTRUMENT' | 'BROKERAGE_CASH';
};

export type CapitalAllocationCandidate = {
  readonly candidateId: CapitalAllocationCandidateId;
  readonly subjectId: string;
  readonly slices: readonly AllocationSlice[];
  readonly scale: 8;
  readonly totalsExactly: true;
};

export type CompiledQuantity = {
  readonly instrumentId: string;
  readonly quantityUnits: bigint;
  readonly notionalMinor: bigint;
  readonly currency: string;
};

export type CompiledAllocation = {
  readonly quantities: readonly CompiledQuantity[];
  readonly cashRemainderMinor: bigint;
  readonly currency: string;
  readonly investableCapitalMinor: bigint;
};

export type AdversarialReview = {
  readonly reviewId: CapitalReviewId;
  readonly candidateId: CapitalAllocationCandidateId;
  readonly weakestAssumption: string;
  readonly contradictoryData: readonly string[];
  readonly downsideScenario: string;
  readonly concentration: string;
  readonly liquidity: string;
  readonly mandateFit: string;
  readonly riskLimits: string;
  readonly staleMarketData: string;
  readonly regulatoryReadiness: string;
  readonly modelLimitations: readonly string[];
};

export type Disagreement = {
  readonly role: SpecialistRole;
  readonly stance: NodeOutput['stance'];
  readonly summary: string;
};

export type HardVeto = {
  readonly reason: HardVetoReason;
  readonly message: string;
  readonly defeatedByConfidence: false;
};

export type CapitalArbitration = {
  readonly arbitrationId: CapitalArbitrationId;
  readonly outcome: ArbiterOutcome;
  readonly vetoes: readonly HardVeto[];
  readonly strategyValidation: StrategyValidationState;
  readonly requiredFactsMissing: readonly string[];
  readonly notes: readonly string[];
  readonly agentVotesAuthorize: false;
};

export type ProposalConfirmations = {
  readonly userConfirmationRequired: true;
  readonly stepUpAuthRequired: boolean;
  readonly strategyValidationRequired: true;
  readonly riskRefreshRequired: boolean;
  readonly regulatoryOrHumanReviewOutstanding: boolean;
  readonly silentEnrollment: false;
};

export type CapitalProposal = {
  readonly proposalId: CapitalProposalId;
  readonly runId: CapitalMeshRunId;
  readonly subjectId: string;
  readonly mandateId: string;
  readonly mandateVersion: number;
  readonly growthPlanId: string;
  readonly pegSnapshotRef?: string;
  readonly peveSnapshotRef?: string;
  readonly portfolioRef: string;
  readonly marketSnapshotAt: UtcInstant;
  readonly proposedAllocation: CapitalAllocationCandidate;
  readonly theses: readonly CapitalThesis[];
  readonly scenarios: readonly CapitalScenario[];
  readonly investableCapitalMinor: bigint;
  readonly compiled: CompiledAllocation;
  readonly risks: readonly string[];
  readonly riskAssessmentId?: string;
  readonly riskModel?: ModelRef;
  readonly riskBudgetVersion: string;
  readonly riskDecision?: RiskOutcome;
  readonly stressSummary: readonly string[];
  readonly breaches: readonly string[];
  readonly rdt: RdtFact;
  readonly modelRefs: readonly ModelRef[];
  readonly assumptions: readonly string[];
  readonly disagreements: readonly Disagreement[];
  readonly confirmations: ProposalConfirmations;
  readonly strategyValidation: StrategyValidationState;
  readonly expiresAt: UtcInstant;
  readonly stale: boolean;
  readonly executable: false;
  readonly createdAt: UtcInstant;
};

export type StrategyDraft = {
  readonly draftId: string;
  readonly proposalId: CapitalProposalId;
  readonly subjectId: string;
  readonly allocation: CapitalAllocationCandidate;
  readonly compiled: CompiledAllocation;
  readonly paperOrderCreated: false;
  readonly requiresStrategyLab: true;
};

export type MeshRun = {
  readonly runId: CapitalMeshRunId;
  readonly meshId: CapitalMeshId;
  readonly subjectId: string;
  readonly state: MeshRunState;
  readonly contextId?: CapitalContextId;
  readonly userObjective?: string;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
};

export type MeshStoreSnapshot = {
  readonly runs: readonly MeshRun[];
  readonly contexts: readonly CapitalContext[];
  readonly theses: readonly CapitalThesis[];
  readonly candidates: readonly CapitalAllocationCandidate[];
  readonly reviews: readonly AdversarialReview[];
  readonly arbitrations: readonly CapitalArbitration[];
  readonly proposals: readonly CapitalProposal[];
  readonly nodeOutputs: readonly NodeOutput[];
};
