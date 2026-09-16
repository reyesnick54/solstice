import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { GrowCycleStatus, GrowDegradedReason, PaperDisclosureKind } from './taxonomy.ts';

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

export type GrowAllocateSection = {
  readonly amountAssigned: GrowMoneyDto;
  readonly fundingAccountId: string | null;
  readonly reservedAmount: GrowMoneyDto;
  readonly retainedLiquidity: GrowMoneyDto;
  readonly unallocatedAvailable: GrowMoneyDto;
};

export type GrowActiveCapitalSection = {
  readonly reservedAmount: GrowMoneyDto;
  readonly paperDeployedAmount: GrowMoneyDto;
  readonly paperPositions: readonly GrowPaperPositionSummary[];
  readonly pendingProposalId: string | null;
  readonly pendingExecutionId: string | null;
  readonly restrictions: readonly string[];
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
  readonly simulatedFees: GrowMoneyDto;
  readonly simulatedSpreadSlippage: GrowMoneyDto;
  readonly netPaperResult: GrowMoneyDto;
  readonly benchmark: { readonly benchmarkId: string; readonly periodReturnBps: string } | null;
  readonly resultKind: 'PAPER_SIMULATION';
  readonly notLiveCustomerReturn: true;
};

export type GrowActivityRecord = {
  readonly activityId: string;
  readonly status: GrowCycleStatus;
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
  readonly totalCanonicalSandboxCash: GrowMoneyDto;
  readonly growReserved: GrowMoneyDto;
  readonly paperDeployed: GrowMoneyDto;
  readonly unsettled: GrowMoneyDto;
  readonly availableUnreserved: GrowMoneyDto;
  readonly notWithdrawableExternal: true;
  readonly environment: 'simulation';
};

export type GrowOverviewResponse = {
  readonly schema: 'sunrey.consumer.grow.overview.v1';
  readonly customerId: string;
  readonly subjectId: string;
  readonly cycleStatus: GrowCycleStatus;
  readonly degradedReasons: readonly GrowDegradedReason[];
  readonly disclosure: PaperDisclosureContract;
  readonly plan: GrowPlanSection;
  readonly allocate: GrowAllocateSection;
  readonly activeCapital: GrowActiveCapitalSection;
  readonly performance: GrowPaperPerformanceSection;
  readonly frontendMathAuthoritative: false;
  readonly serverOwned: true;
};

export type GrowActivityResponse = {
  readonly schema: 'sunrey.consumer.grow.activity.v1';
  readonly customerId: string;
  readonly items: readonly GrowActivityRecord[];
  readonly disclosure: PaperDisclosureContract;
  readonly serverOwned: true;
};

export type GrowResultsResponse = {
  readonly schema: 'sunrey.consumer.grow.results.v1';
  readonly customerId: string;
  readonly performance: GrowPaperPerformanceSection;
  readonly attribution: GrowAttributionModel;
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
