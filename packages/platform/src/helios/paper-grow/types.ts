import type { UtcInstant } from '@solstice/domain';
import type { GrowCycleStatus, GrowDegradedReason, PaperDisclosureKind } from './taxonomy.ts';
import type { ConsumerGrowStatus } from './status-semantics.ts';

export type GrowMoneyDto = {
  readonly minorUnits: string;
  readonly currency: string;
};

export type PaperDisclosureContract = {
  readonly environment: 'simulation';
  readonly executionMode: 'PAPER' | 'SIMULATION_SANDBOX';
  readonly productionMoneyMovement: false;
  readonly liveExecution: false;
  readonly paperResultIsNotLiveReturn: true;
  readonly paperProceedsNotWithdrawableExternal: true;
  readonly depositsAreNotPerformance: true;
  readonly expenseSavingsAreNotInvestmentPnl: true;
  readonly unrealizedIsNotAvailableCash: true;
  readonly disclosures: readonly PaperDisclosureKind[];
};

export type GrowPlanSection = {
  readonly workOrderId: string | null;
  readonly planId: string | null;
  readonly planVersion: number | null;
  readonly status: GrowCycleStatus;
  readonly objective: string | null;
  readonly mandateState: string | null;
  readonly environment: 'simulation';
  readonly createdAt: UtcInstant | null;
  readonly updatedAt: UtcInstant | null;
};

export type GrowFundingState = 'UNFUNDED' | 'PARTIALLY_FUNDED' | 'FUNDED' | 'RESERVED' | 'DEPLOYED';

export type GrowAllocateSection = {
  readonly amountAssigned: GrowMoneyDto;
  readonly fundingAccountId: string | null;
  readonly reservedAmount: GrowMoneyDto;
  readonly deployedCapital: GrowMoneyDto;
  readonly retainedLiquidity: GrowMoneyDto;
  readonly unallocatedAvailable: GrowMoneyDto;
  readonly fundingState: GrowFundingState;
  readonly currency: string;
};

export type GrowStrategyCapsuleRef = {
  readonly capsuleId: string;
  readonly displayLabel: string;
  readonly promotionState: string;
  readonly qualificationState: string;
  readonly consumerVisible: true;
};

export type GrowActiveCapitalSection = {
  readonly reservedAmount: GrowMoneyDto;
  readonly paperDeployedAmount: GrowMoneyDto;
  readonly paperPositions: readonly GrowPaperPositionSummary[];
  readonly strategies: readonly GrowStrategySummary[];
  readonly strategyCapsules: readonly GrowStrategyCapsuleRef[];
  readonly pendingProposalId: string | null;
  readonly pendingExecutionId: string | null;
  readonly pendingOrders: readonly string[];
  readonly settlementStates: readonly string[];
  readonly restrictions: readonly string[];
  readonly providerState: GrowProviderConsumerState | null;
};

export type GrowStrategySummary = {
  readonly strategyRef: string;
  readonly displayName: string;
  readonly deployedAmount: GrowMoneyDto;
  readonly status: ConsumerGrowStatus;
};

export type GrowPaperPositionSummary = {
  readonly instrumentId: string;
  readonly displayName: string;
  readonly quantityUnits: string;
  readonly marketValue: GrowMoneyDto | null;
  readonly unrealized: GrowMoneyDto | null;
  readonly positionStatus: 'OPEN' | 'CLOSED' | 'PENDING';
};

export type GrowPaperPerformanceSection = {
  readonly initialPaperAllocation: GrowMoneyDto;
  readonly netContributions: GrowMoneyDto;
  readonly currentPaperValue: GrowMoneyDto;
  readonly realizedPaperPnl: GrowMoneyDto;
  readonly unrealizedPaperChange: GrowMoneyDto;
  readonly incomeReceived: GrowMoneyDto;
  readonly simulatedFees: GrowMoneyDto;
  readonly simulatedSpreadSlippage: GrowMoneyDto;
  readonly operatingResearchCost: GrowMoneyDto;
  readonly netPaperResult: GrowMoneyDto;
  readonly benchmark: { readonly benchmarkId: string; readonly periodReturnBps: string; readonly methodology: string } | null;
  readonly valuationFreshness: UtcInstant | null;
  readonly resultKind: 'PAPER_SIMULATION';
  readonly notLiveCustomerReturn: true;
};

export type GrowProviderConsumerState = {
  readonly providerDisplayName: string;
  readonly providerId: string;
  readonly accountStatus: 'ACTIVE' | 'PENDING' | 'RESTRICTED' | 'UNAVAILABLE';
  readonly fundingStatus: GrowFundingState;
  readonly actionRequired: boolean;
  readonly restrictions: readonly string[];
  readonly environment: 'simulation';
};

export type GrowActivityRecord = {
  readonly activityId: string;
  readonly status: GrowCycleStatus;
  readonly consumerStatus: ConsumerGrowStatus;
  readonly whyConsidered: string;
  readonly researchSummary: string;
  readonly instrumentId: string | null;
  readonly instrumentLabel: string | null;
  readonly action: string;
  readonly amount: GrowMoneyDto;
  readonly quantityUnits: string | null;
  readonly proposedAt: UtcInstant;
  readonly controlResult: string | null;
  readonly paperSubmissionId: string | null;
  readonly paperFillId: string | null;
  readonly simulatedFees: GrowMoneyDto;
  readonly positionStatus: 'OPEN' | 'CLOSED' | 'PENDING' | 'NONE';
  readonly closeResult: GrowMoneyDto | null;
  readonly evidenceRefs: readonly string[];
  readonly proposalId: string | null;
  readonly executionId: string | null;
};

export type GrowCashSnapshot = {
  readonly settledWithdrawable: GrowMoneyDto;
  readonly reserved: GrowMoneyDto;
  readonly invested: GrowMoneyDto;
  readonly pendingSettlement: GrowMoneyDto;
  readonly restricted: GrowMoneyDto;
  readonly totalCanonicalSandboxCash: GrowMoneyDto;
  readonly growReserved: GrowMoneyDto;
  readonly paperDeployed: GrowMoneyDto;
  readonly unsettled: GrowMoneyDto;
  readonly availableUnreserved: GrowMoneyDto;
  readonly notWithdrawableExternal: true;
  readonly unrealizedIsNotWithdrawable: true;
  readonly environment: 'simulation';
};

export type GrowOverviewResponse = {
  readonly schema: 'sunrey.consumer.grow.overview.v1';
  readonly customerId: string;
  readonly subjectId: string;
  readonly cycleStatus: GrowCycleStatus;
  readonly consumerStatus: ConsumerGrowStatus;
  readonly degradedReasons: readonly GrowDegradedReason[];
  readonly currentRestrictions: readonly string[];
  readonly nextRequiredCustomerAction: string | null;
  readonly disclosure: PaperDisclosureContract;
  readonly plan: GrowPlanSection;
  readonly allocate: GrowAllocateSection;
  readonly activeCapital: GrowActiveCapitalSection;
  readonly performance: GrowPaperPerformanceSection;
  readonly providerAccount: GrowProviderConsumerState | null;
  readonly frontendMathAuthoritative: false;
  readonly serverOwned: true;
};

export type GrowAllocateResponse = {
  readonly schema: 'sunrey.consumer.grow.allocate.v1';
  readonly customerId: string;
  readonly allocate: GrowAllocateSection;
  readonly disclosure: PaperDisclosureContract;
  readonly serverOwned: true;
};

export type GrowActiveCapitalResponse = {
  readonly schema: 'sunrey.consumer.grow.active-capital.v1';
  readonly customerId: string;
  readonly activeCapital: GrowActiveCapitalSection;
  readonly disclosure: PaperDisclosureContract;
  readonly serverOwned: true;
};

export type GrowPerformanceResponse = {
  readonly schema: 'sunrey.consumer.grow.performance.v1';
  readonly customerId: string;
  readonly performance: GrowPaperPerformanceSection;
  readonly attribution: GrowAttributionModel;
  readonly disclosure: PaperDisclosureContract;
  readonly serverOwned: true;
};

export type GrowProviderAccountResponse = {
  readonly schema: 'sunrey.consumer.grow.provider-account.v1';
  readonly customerId: string;
  readonly providerAccount: GrowProviderConsumerState | null;
  readonly serverOwned: true;
};

export type GrowActionCard = {
  readonly actionCardId: string;
  readonly actionType: string;
  readonly amount: GrowMoneyDto;
  readonly instrumentId: string | null;
  readonly instrumentLabel: string | null;
  readonly reason: string;
  readonly evidenceSummary: string;
  readonly status: ConsumerGrowStatus;
  readonly riskFeeSummary: string;
  readonly expiresAt: UtcInstant | null;
  readonly customerActionRequired: boolean;
  readonly approvalEndpoint: string | null;
  readonly proposalId: string;
  readonly serverOwned: true;
};

export type GrowActionCardsResponse = {
  readonly schema: 'sunrey.consumer.grow.action-cards.v1';
  readonly customerId: string;
  readonly items: readonly GrowActionCard[];
  readonly serverOwned: true;
};

export type GrowAgentStateResponse = {
  readonly schema: 'sunrey.consumer.grow.agent-state.v1';
  readonly customerId: string;
  readonly consumerStatus: ConsumerGrowStatus;
  readonly summary: string;
  readonly nextRequiredCustomerAction: string | null;
  readonly overview: Pick<GrowOverviewResponse, 'cycleStatus' | 'plan' | 'allocate' | 'performance'>;
  readonly recentActivityCount: number;
  readonly mayExecute: false;
  readonly serverOwned: true;
};

export type GrowActivityResponse = {
  readonly schema: 'sunrey.consumer.grow.activity.v1';
  readonly customerId: string;
  readonly items: readonly GrowActivityRecord[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
  readonly disclosure: PaperDisclosureContract;
  readonly serverOwned: true;
};

export type GrowResultsResponse = {
  readonly schema: 'sunrey.consumer.grow.results.v1';
  readonly customerId: string;
  readonly performance: GrowPaperPerformanceSection;
  readonly attribution: GrowAttributionModel;
  readonly outcomeAttribution: import('../outcome-attribution/types.ts').GrowIndependentOutcomeAttribution | null;
  readonly disclosure: PaperDisclosureContract;
  readonly serverOwned: true;
};

export type GrowAttributionModel = {
  readonly principalDepositsAreNotGrowth: true;
  readonly expenseSavingsAreNotInvestmentPnl: true;
  readonly unrealizedIsNotAvailableCash: true;
  readonly tokenValuesAreNotRealizedProfit: true;
  readonly researchEarningsSeparateFromInvestment: true;
  readonly paperSeparateFromLiveRealized: true;
};

export type PaperGrowMetricsSnapshot = {
  readonly activeWorkOrders: number;
  readonly researchTasks: number;
  readonly qualifiedOpportunities: number;
  readonly proposals: number;
  readonly controlOutcomes: { readonly allowed: number; readonly rejected: number; readonly pending: number };
  readonly paperPositions: number;
  readonly completedCycles: number;
  readonly degradedStates: number;
  readonly restartRecoveryActions: number;
  readonly totalResearchCostMinorUnits: string;
  readonly netPaperResultMinorUnits: string;
};
