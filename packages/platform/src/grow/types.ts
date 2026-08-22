import type { UtcInstant } from '../../../domain/src/time.ts';
import type { SerializedMoney } from '../mandate/types.ts';
import type { GrowthActionId, GrowthPlanId, GrowthPlanVersion } from '../ids.ts';
import type {
  ActivatedPlanId,
  FinancialProposalId,
  FinancialProposalVersion,
  GrowApprovalId,
  GrowExecutionCommandId,
  GrowExecutionId,
  GrowMonitoringCycleId,
  PlanComponentId,
  RecurringMandateId,
} from './ids.ts';
import type {
  ActivatedPlanLifecycle,
  AuthenticationAssuranceLevel,
  FinancialProposalState,
  FinancialProposalType,
  GrowExecutionDomain,
  GrowExecutionState,
  GrowFailureCode,
  PlanComponentState,
  RecurringFrequency,
  RecurringMandateState,
  ScenarioResultKind,
  SuitabilityOutcome,
} from './taxonomy.ts';

export type GrowMoney = SerializedMoney;

export type ScenarioBand = {
  readonly kind: ScenarioResultKind;
  readonly label: string;
  readonly low: GrowMoney;
  readonly high: GrowMoney;
  readonly assumptions: readonly string[];
  readonly achievementPromised: false;
  readonly legallyGuaranteedProduct: false;
};

export type ProposalExplainability = {
  readonly whyThis: string;
  readonly whyNow: string;
  readonly supportedGoal: string;
  readonly supportingFacts: readonly string[];
  readonly suitabilitySummary: string;
  readonly whatCouldGoWrong: string;
  readonly requiresConfirmation: true;
  readonly canExecuteWithoutAuthority: false;
  readonly resultKind: ScenarioResultKind;
};

export type FinancialProposal = {
  readonly proposalId: FinancialProposalId;
  readonly version: FinancialProposalVersion;
  readonly supersedesVersion: FinancialProposalVersion | null;
  readonly subjectId: string;
  readonly customerId: string;
  readonly planId: GrowthPlanId;
  readonly planVersion: GrowthPlanVersion;
  readonly actionId: GrowthActionId;
  readonly pegSnapshotId: string;
  readonly opportunityIds: readonly string[];
  readonly proposalType: FinancialProposalType;
  readonly state: FinancialProposalState;
  readonly intendedAction: string;
  readonly sourceAccountId: string;
  readonly destinationAccountId: string | null;
  readonly instrumentId: string | null;
  readonly amount: GrowMoney;
  readonly createdAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly contentHash: string;
  readonly serverOwned: true;
  readonly clientInstructionsTrusted: false;
  readonly suitability: SuitabilityOutcome;
  readonly policyDecision: string;
  readonly requiredAuthAssurance: AuthenticationAssuranceLevel;
  readonly explainability: ProposalExplainability;
  readonly scenario: ScenarioBand;
  readonly assumptions: readonly string[];
};

export type GrowApproval = {
  readonly approvalId: GrowApprovalId;
  readonly proposalId: FinancialProposalId;
  readonly proposalVersion: FinancialProposalVersion;
  readonly proposalContentHash: string;
  readonly subjectId: string;
  readonly customerId: string;
  readonly actorId: string;
  readonly actorKind: 'CUSTOMER' | 'HUMAN_OPERATOR';
  readonly approvedAt: UtcInstant;
  readonly authenticationAssurance: AuthenticationAssuranceLevel;
  readonly stepUpRequired: boolean;
  readonly stepUpSatisfied: boolean;
};

export type GrowExecutionCommand = {
  readonly commandId: GrowExecutionCommandId;
  readonly proposalId: FinancialProposalId;
  readonly proposalVersion: FinancialProposalVersion;
  readonly proposalContentHash: string;
  readonly customerId: string;
  readonly subjectId: string;
  readonly approvalId: GrowApprovalId;
  readonly authenticationAssurance: AuthenticationAssuranceLevel;
  readonly suitability: SuitabilityOutcome;
  readonly policyDecision: string;
  readonly idempotencyKey: string;
  readonly expiresAt: UtcInstant;
  readonly financialResource: {
    readonly sourceAccountId: string;
    readonly destinationAccountId: string | null;
    readonly instrumentId: string | null;
    readonly amount: GrowMoney;
  };
  readonly intendedAction: string;
  readonly proposalType: FinancialProposalType;
  readonly domain: GrowExecutionDomain;
  readonly createdAt: UtcInstant;
  readonly clientBodyTrusted: false;
};

export type GrowRevalidationFact = {
  readonly proposalExpired: boolean;
  readonly proposalSuperseded: boolean;
  readonly approvalValid: boolean;
  readonly authenticationSufficient: boolean;
  readonly accountStatus: 'ACTIVE' | 'RESTRICTED' | 'CLOSED' | 'UNKNOWN';
  readonly availableMinorUnits: string;
  readonly productAvailable: boolean;
  readonly providerAvailable: boolean;
  readonly suitability: SuitabilityOutcome;
  readonly kernelPolicy: 'ALLOW' | 'HOLD' | 'BLOCK' | 'DEFER' | 'REQUIRE_MANUAL_REVIEW' | 'UNKNOWN';
  readonly complianceClear: boolean;
  readonly marketQuoteValid: boolean;
  readonly materialChange: boolean;
};

export type GrowRevalidationResult = {
  readonly accepted: boolean;
  readonly requireRefreshedProposal: boolean;
  readonly code: GrowFailureCode | 'OK';
  readonly message: string;
  readonly facts: GrowRevalidationFact;
};

export type GrowExecutionRecord = {
  readonly executionId: GrowExecutionId;
  readonly commandId: GrowExecutionCommandId;
  readonly proposalId: FinancialProposalId;
  readonly proposalVersion: FinancialProposalVersion;
  readonly customerId: string;
  readonly state: GrowExecutionState;
  readonly domain: GrowExecutionDomain;
  readonly reservationHoldId: string | null;
  readonly providerId: string | null;
  readonly providerResult: string | null;
  readonly ledgerJournalId: string | null;
  readonly custodyRef: string | null;
  readonly filledMinorUnits: string;
  readonly requestedMinorUnits: string;
  readonly authorityId: string | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly failureCode: GrowFailureCode | null;
  readonly notes: readonly string[];
};

export type ActivatedGrowthPlan = {
  readonly activatedPlanId: ActivatedPlanId;
  readonly planId: GrowthPlanId;
  readonly planVersion: GrowthPlanVersion;
  readonly subjectId: string;
  readonly customerId: string;
  readonly lifecycle: ActivatedPlanLifecycle;
  readonly fundedComponentIds: readonly PlanComponentId[];
  readonly pendingComponentIds: readonly PlanComponentId[];
  readonly completedComponentIds: readonly PlanComponentId[];
  readonly failedComponentIds: readonly PlanComponentId[];
  readonly recurringMandateIds: readonly RecurringMandateId[];
  readonly activatedAt: UtcInstant;
};

export type PlanComponent = {
  readonly componentId: PlanComponentId;
  readonly activatedPlanId: ActivatedPlanId;
  readonly actionId: string;
  readonly state: PlanComponentState;
  readonly amount: GrowMoney;
};

export type RecurringContributionMandate = {
  readonly recurringMandateId: RecurringMandateId;
  readonly subjectId: string;
  readonly customerId: string;
  readonly amount: GrowMoney;
  readonly frequency: RecurringFrequency;
  readonly sourceAccountId: string;
  readonly destinationAccountId: string;
  readonly startAt: UtcInstant;
  readonly endAt: UtcInstant | null;
  readonly maxAmountMinorUnits: string;
  readonly revocation: 'CUSTOMER_MAY_REVOKE';
  readonly policy: string;
  readonly authorizationModel: 'EACH_OCCURRENCE_REVALIDATED' | 'BOUNDED_MANDATE';
  readonly state: RecurringMandateState;
  readonly agentMayIncreaseAmount: false;
  readonly perpetualAuthorization: false;
};

export type GrowPerformanceReadModel = {
  readonly subjectId: string;
  readonly planId: string;
  readonly plannedContributions: GrowMoney;
  readonly executedContributions: GrowMoney;
  readonly withdrawals: GrowMoney;
  readonly currentValue: GrowMoney;
  readonly performance: GrowMoney;
  readonly fees: GrowMoney;
  readonly deviation: GrowMoney;
  readonly goalProgressMinorUnits: string;
  readonly goalTargetMinorUnits: string;
  readonly timeRemainingDays: number | null;
  readonly marketPerformanceSeparatedFromDeposits: true;
  readonly depositsAreNotPerformance: true;
};

export type GrowMonitoringFinding = {
  readonly kind:
    | 'GOAL_PROGRESS'
    | 'PORTFOLIO_DRIFT'
    | 'CASH_RESERVE'
    | 'PERFORMANCE'
    | 'MATERIAL_RISK_CHANGE'
    | 'PRODUCT_AVAILABILITY'
    | 'CUSTOMER_CIRCUMSTANCE';
  readonly summary: string;
  readonly createsOpportunity: boolean;
  readonly silentTradeForbidden: true;
};

export type GrowMonitoringCycle = {
  readonly cycleId: GrowMonitoringCycleId;
  readonly subjectId: string;
  readonly generatedAt: UtcInstant;
  readonly findings: readonly GrowMonitoringFinding[];
  readonly newOpportunityIds: readonly string[];
  readonly newProposalIds: readonly string[];
  readonly silentInvestmentChange: false;
};

export type GrowEvidenceTrace = {
  readonly pegSnapshotId: string | null;
  readonly opportunityIds: readonly string[];
  readonly planId: string | null;
  readonly proposalId: string | null;
  readonly proposalVersion: number | null;
  readonly suitability: SuitabilityOutcome | null;
  readonly policyDecision: string | null;
  readonly approvalId: string | null;
  readonly stepUpSatisfied: boolean | null;
  readonly executionAuthorityId: string | null;
  readonly providerId: string | null;
  readonly providerResult: string | null;
  readonly ledgerJournalId: string | null;
  readonly custodyRef: string | null;
  readonly settlementRef: string | null;
  readonly performanceResult: string | null;
};

export type GrowFailure = {
  readonly code: GrowFailureCode;
  readonly message: string;
};
