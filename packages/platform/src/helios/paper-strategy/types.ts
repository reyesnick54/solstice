import type { CustomerId } from '../../../../domain/src/customer.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { CreatePaperOrderIntent } from '../../../../permissions/src/action-types.ts';
import type { SerializedMoney } from '../../mandate/types.ts';
import type { EconomicWorkOrderId } from '../ids.ts';
import type { EconomicWorkOrder } from '../types.ts';
import type { ExecutableOpportunity, QualificationTermsSnapshot } from '../executable-opportunity/types.ts';
import type { CompiledEconomicMandate } from '../../mandate/types.ts';
import type {
  HeliosPaperCycleId,
  HeliosPaperPositionId,
  HeliosPaperProposalId,
} from './ids.ts';
import type {
  HeliosPaperStrategyId,
  PaperAttributionClass,
  PaperCycleOutcome,
  PaperPositionStatus,
  PaperProposalState,
  ValidationReasonCode,
} from './taxonomy.ts';

export const HELIOS_PAPER_FILL_METHODOLOGY_VERSION = 'helios-paper-fill-v1' as const;

export type HeliosPaperResearchResult = {
  readonly researchId: string;
  readonly strategyId: HeliosPaperStrategyId;
  readonly hypothesis: string;
  readonly synthesizedAt: UtcInstant;
  readonly evidenceRefs: readonly string[];
  readonly referencePrice: SerializedMoney;
  readonly referenceAsOf: UtcInstant;
  readonly informationTimeObservedAt: UtcInstant;
  readonly informationTimeArrivedAt: UtcInstant;
  readonly deterministic: true;
  readonly llmSourced: false;
};

export type HeliosStrategyDecision = {
  readonly strategyId: HeliosPaperStrategyId;
  readonly action: 'BUY' | 'SELL' | 'NO_ACTION';
  readonly instrumentId: string;
  readonly quantityUnits: string;
  readonly rationale: string;
  readonly ruleVersion: string;
  readonly entryThresholdMinor: string;
  readonly exitThresholdMinor: string;
  readonly referenceMidMinor: string;
  readonly decidedAt: UtcInstant;
};

export type HeliosPaperGrowProposal = {
  readonly proposalId: HeliosPaperProposalId;
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: CustomerId;
  readonly subjectId: string;
  readonly sandboxAllocationMinor: string;
  readonly sandboxAllocationCurrency: string;
  readonly instrumentId: string;
  readonly direction: 'BUY' | 'SELL';
  readonly quantityUnits: string;
  readonly notional: SerializedMoney;
  readonly referencePrice: SerializedMoney;
  readonly evidenceRefs: readonly string[];
  readonly research: HeliosPaperResearchResult;
  readonly strategyDecision: HeliosStrategyDecision;
  readonly rationale: string;
  readonly invalidationConditions: readonly string[];
  readonly expiresAt: UtcInstant;
  readonly environment: 'PAPER';
  readonly state: PaperProposalState;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly grantsFinancialEffect: false;
};

export type HeliosPaperFillAssumptions = {
  readonly methodologyVersion: typeof HELIOS_PAPER_FILL_METHODOLOGY_VERSION;
  readonly spreadBps: number;
  readonly slippageBps: number;
  readonly feeMinorUnits: string;
  readonly feeCurrency: string;
  readonly referenceMidMinor: string;
  readonly executionPriceMinor: string;
  readonly dataTimestamp: UtcInstant;
};

export type HeliosPaperExecutionRecord = {
  readonly orderId: string;
  readonly fillId: string | null;
  readonly submissionState: 'SUBMITTED' | 'ACKNOWLEDGED' | 'FILLED' | 'PARTIAL' | 'REJECTED';
  readonly quantityUnits: string;
  readonly executionPrice: SerializedMoney;
  readonly grossNotional: SerializedMoney;
  readonly netNotional: SerializedMoney;
  readonly fee: SerializedMoney;
  readonly spreadCost: SerializedMoney;
  readonly slippageCost: SerializedMoney;
  readonly assumptions: HeliosPaperFillAssumptions;
  readonly environment: 'PAPER';
  readonly providerSourced: false;
  readonly simulation: true;
  readonly executedAt: UtcInstant;
  readonly authorityId: string | null;
  readonly riskAssessmentId: string | null;
};

export type HeliosPaperPosition = {
  readonly positionId: HeliosPaperPositionId;
  readonly customerId: CustomerId;
  readonly workOrderId: EconomicWorkOrderId;
  readonly strategyId: HeliosPaperStrategyId;
  readonly instrumentId: string;
  readonly quantityUnits: string;
  readonly costBasis: SerializedMoney;
  readonly status: PaperPositionStatus;
  readonly entryFills: readonly HeliosPaperExecutionRecord[];
  readonly exitFills: readonly HeliosPaperExecutionRecord[];
  readonly referenceValuation: SerializedMoney | null;
  readonly feesAssumed: SerializedMoney;
  readonly realizedResult: SerializedMoney | null;
  readonly unrealizedResult: SerializedMoney | null;
  readonly environment: 'PAPER';
  readonly liveProviderPosition: false;
  readonly openedAt: UtcInstant;
  readonly closedAt: UtcInstant | null;
};

export type HeliosPaperGrowResult = {
  readonly cycleId: HeliosPaperCycleId;
  readonly proposalId: HeliosPaperProposalId | null;
  readonly positionId: HeliosPaperPositionId | null;
  readonly outcome: PaperCycleOutcome;
  readonly attributionClass: PaperAttributionClass;
  readonly grossResult: SerializedMoney | null;
  readonly netResult: SerializedMoney | null;
  readonly feesIncluded: SerializedMoney | null;
  readonly reasonCodes: readonly ValidationReasonCode[];
  readonly evidenceChainRefs: readonly string[];
  readonly completedAt: UtcInstant;
};

export type HeliosPaperExecutionPort = {
  readonly createPaperOrder: (intent: CreatePaperOrderIntent) => {
    readonly outcome: 'OK' | 'KERNEL_REFUSED' | 'REJECTED';
    readonly value?: { readonly orderId: string; readonly fillId?: string | undefined };
    readonly code?: string | undefined;
    readonly message?: string | undefined;
    readonly authorityId?: string | null;
    readonly riskAssessmentId?: string | null;
    readonly executionPriceMinor?: string;
    readonly grossNotionalMinor?: string;
    readonly feeMinor?: string;
  };
  readonly liveProviderInvoked?: boolean;
};

export type HeliosPaperRiskAssessment = {
  readonly outcome: 'ALLOW_SIMULATION' | 'REQUIRE_REVIEW' | 'BLOCK' | 'INSUFFICIENT_DATA';
  readonly assessmentId?: string;
};

export type HeliosPaperRiskPort = {
  readonly assess: (input: {
    readonly proposedNotionalMinor: bigint;
    readonly instrumentId: string;
    readonly portfolioId: string;
  }) => HeliosPaperRiskAssessment;
};

export type PaperStrategyRunInput = {
  readonly taskId: string;
  readonly workOrder: EconomicWorkOrder;
  readonly mandate: CompiledEconomicMandate;
  readonly opportunity: ExecutableOpportunity;
  readonly terms: QualificationTermsSnapshot;
  readonly actorId: string;
  readonly investmentAccountId: string;
  readonly brokerageAccountId: string;
  readonly reservedCapitalMinor: string;
  readonly researchBudgetRemaining: string;
  readonly venueSession: 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'POST_MARKET' | 'UNKNOWN';
  readonly idempotencyKey: string;
};

export type PaperStrategyCloseInput = {
  readonly positionId: HeliosPaperPositionId;
  readonly customerId: CustomerId;
  readonly workOrder: EconomicWorkOrder;
  readonly terms: QualificationTermsSnapshot;
  readonly actorId: string;
  readonly investmentAccountId: string;
  readonly brokerageAccountId: string;
  readonly reason: 'EXPLICIT_CLOSE' | 'WORK_ORDER_COMPLETE' | 'INVALIDATION' | 'TIME_HORIZON';
  readonly idempotencyKey: string;
};

export type PaperStrategyValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reasonCodes: readonly ValidationReasonCode[]; readonly outcome: PaperCycleOutcome };

export type PaperStrategyStoreSnapshot = {
  readonly proposals: readonly HeliosPaperGrowProposal[];
  readonly positions: readonly HeliosPaperPosition[];
  readonly cycles: readonly HeliosPaperGrowResult[];
  readonly completedTaskIds: readonly string[];
};
