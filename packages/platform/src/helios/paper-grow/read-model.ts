/**
 * HELIOS H15 — server-owned paper Grow read model.
 * Aggregates canonical Grow lifecycle, investment, and ledger state.
 * Frontend must not calculate authoritative financial fields.
 */

import type { UtcInstant } from '@solstice/domain';
import type { InMemoryGrowStore } from '../../grow/store.ts';
import type { FinancialProposal, GrowExecutionRecord } from '../../grow/types.ts';
import type { GrowthPlan } from '../../growth/types.ts';
import type { EconomicWorkOrder } from '../../work-order/types.ts';
import type {
  GrowActionCard,
  GrowActivityRecord,
  GrowAgentStateResponse,
  GrowAllocateSection,
  GrowActiveCapitalSection,
  GrowAttributionModel,
  GrowCashSnapshot,
  GrowFundingState,
  GrowMoneyDto,
  GrowOverviewResponse,
  GrowPaperPerformanceSection,
  GrowPlanSection,
  GrowProviderConsumerState,
  PaperDisclosureContract,
} from './types.ts';
import type { GrowCycleStatus, GrowDegradedReason } from './taxonomy.ts';
import {
  deriveNextRequiredCustomerAction,
  mapConsumerGrowStatus,
  type ConsumerGrowStatus,
} from './status-semantics.ts';
import { buildPaperDisclosure, projectActivityItems, projectOverview } from './projection.ts';

export type PaperGrowLedgerCash = {
  readonly totalSandboxCashMinorUnits: string;
  readonly growReservedMinorUnits: string;
  readonly paperDeployedMinorUnits: string;
  readonly unsettledMinorUnits: string;
  readonly currency: string;
};

export type PaperGrowInvestmentSnapshot = {
  readonly holdings: readonly {
    readonly instrumentId: string;
    readonly displayName: string;
    readonly quantityUnits: string;
    readonly marketValueMinorUnits: string | null;
    readonly unrealizedMinorUnits: string | null;
    readonly positionStatus: 'OPEN' | 'CLOSED' | 'PENDING';
  }[];
  readonly realizedMinorUnits: string;
  readonly unrealizedMinorUnits: string;
  readonly simulatedFeesMinorUnits: string;
  readonly simulatedSpreadSlippageMinorUnits: string;
  readonly currentValueMinorUnits: string;
  readonly netContributionsMinorUnits: string;
  readonly initialAllocationMinorUnits: string;
  readonly benchmarkId: string | null;
  readonly benchmarkPeriodReturnBps: string | null;
  readonly currency: string;
};

export type PaperGrowReadModelInput = {
  readonly customerId: string;
  readonly subjectId: string;
  readonly growStore: InMemoryGrowStore;
  readonly plan: GrowthPlan | null;
  readonly workOrder: EconomicWorkOrder | null;
  readonly mandateState: string | null;
  readonly ledgerCash: PaperGrowLedgerCash;
  readonly investment: PaperGrowInvestmentSnapshot | null;
  readonly degradedReasons: readonly GrowDegradedReason[];
  readonly researchTaskCount: number;
  readonly qualifiedOpportunityCount: number;
  readonly providerDisplay?: GrowProviderConsumerState | null;
  readonly valuationFreshness?: UtcInstant | null;
  readonly operatingResearchCostMinorUnits?: string;
};

function money(minorUnits: string, currency: string): GrowMoneyDto {
  return Object.freeze({ minorUnits, currency });
}

function zero(currency: string): GrowMoneyDto {
  return money('0', currency);
}

function deriveCycleStatus(
  proposals: readonly FinancialProposal[],
  executions: readonly GrowExecutionRecord[],
  degradedReasons: readonly GrowDegradedReason[],
  researchTaskCount: number,
  plan: GrowthPlan | null,
): GrowCycleStatus {
  if (degradedReasons.length > 0) {
    const blocking = degradedReasons.some(
      (r) =>
        r === 'AUTHORITY_REVOKED' ||
        r === 'INSUFFICIENT_SANDBOX_CAPITAL' ||
        r === 'PAPER_EXECUTOR_UNAVAILABLE',
    );
    return blocking ? 'BLOCKED' : 'DEGRADED';
  }
  const latestProposal = proposals[0];
  const latestExecution = [...executions].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
  if (latestExecution) {
    if (latestExecution.state === 'SUBMITTED' || latestExecution.state === 'PROCESSING' || latestExecution.state === 'QUEUED') {
      return 'PAPER_SUBMITTED';
    }
    if (latestExecution.state === 'COMPLETED' || latestExecution.state === 'PARTIALLY_COMPLETED') {
      return 'PAPER_ACTIVE';
    }
    if (latestExecution.state === 'FAILED' || latestExecution.state === 'CANCELLED') {
      return 'PAPER_CLOSED';
    }
    if (latestExecution.state === 'REQUIRES_REVIEW') {
      return 'AWAITING_CONTROL';
    }
  }
  if (latestProposal) {
    if (latestProposal.state === 'REJECTED' || latestProposal.state === 'CANCELLED') {
      return 'REJECTED';
    }
    if (latestProposal.state === 'AWAITING_APPROVAL' || latestProposal.state === 'AWAITING_STEP_UP') {
      return 'AWAITING_CONTROL';
    }
    if (latestProposal.state === 'APPROVED') {
      return 'PROPOSAL_READY';
    }
    if (latestProposal.state === 'DRAFT' || latestProposal.state === 'EXPIRED' || latestProposal.state === 'SUPERSEDED') {
      return latestProposal.state === 'EXPIRED' ? 'NO_ACTION' : 'PROPOSAL_READY';
    }
  }
  if (researchTaskCount > 0 || (plan && plan.candidateActions.length > 0)) {
    return 'RESEARCHING';
  }
  return 'NO_ACTION';
}

function buildPlanSection(
  input: PaperGrowReadModelInput,
  status: GrowCycleStatus,
): GrowPlanSection {
  const wo = input.workOrder;
  const plan = input.plan;
  return Object.freeze({
    workOrderId: wo?.workOrderId ?? null,
    planId: plan?.planId ?? wo?.planId ?? null,
    planVersion: plan?.version ?? wo?.planVersion ?? null,
    status,
    objective: wo?.objective.description ?? (plan ? 'Grow surplus allocation' : null),
    mandateState: input.mandateState,
    environment: 'simulation',
    createdAt: wo?.createdAt ?? plan?.generatedAt ?? null,
    updatedAt: wo?.updatedAt ?? plan?.generatedAt ?? null,
  });
}

function deriveFundingState(deployed: string, reserved: string, assigned: string): GrowFundingState {
  if (BigInt(deployed) > 0n) {
    return 'DEPLOYED';
  }
  if (BigInt(reserved) > 0n) {
    return 'RESERVED';
  }
  if (BigInt(assigned) > 0n) {
    return 'FUNDED';
  }
  return 'UNFUNDED';
}

function buildAllocateSection(input: PaperGrowReadModelInput): GrowAllocateSection {
  const currency = input.ledgerCash.currency;
  const reserved = input.ledgerCash.growReservedMinorUnits;
  const deployed = input.ledgerCash.paperDeployedMinorUnits;
  const total = input.ledgerCash.totalSandboxCashMinorUnits;
  const unallocated = (BigInt(total) - BigInt(reserved) - BigInt(deployed)).toString();
  const latestProposal = input.growStore.listProposals(input.subjectId)[0];
  const assigned = latestProposal?.amount.minorUnits ?? '0';
  const fundingAccount = latestProposal?.sourceAccountId ?? input.workOrder?.capitalBoundary.accountId ?? null;
  return Object.freeze({
    amountAssigned: money(assigned, currency),
    fundingAccountId: fundingAccount,
    reservedAmount: money(reserved, currency),
    deployedCapital: money(deployed, currency),
    retainedLiquidity: money((BigInt(total) - BigInt(assigned)).toString(), currency),
    unallocatedAvailable: money(unallocated, currency),
    fundingState: deriveFundingState(deployed, reserved, assigned),
    currency,
  });
}

function buildActiveCapitalSection(
  input: PaperGrowReadModelInput,
  proposals: readonly FinancialProposal[],
  executions: readonly GrowExecutionRecord[],
): GrowActiveCapitalSection {
  const currency = input.ledgerCash.currency;
  const latestProposal = proposals[0];
  const pendingExecution = executions.find(
    (e) => e.state === 'QUEUED' || e.state === 'SUBMITTED' || e.state === 'PROCESSING',
  );
  const positions =
    input.investment?.holdings.map((h) =>
      Object.freeze({
        instrumentId: h.instrumentId,
        displayName: h.displayName,
        quantityUnits: h.quantityUnits,
        marketValue: h.marketValueMinorUnits ? money(h.marketValueMinorUnits, currency) : null,
        unrealized: h.unrealizedMinorUnits ? money(h.unrealizedMinorUnits, currency) : null,
        positionStatus: h.positionStatus,
      }),
    ) ?? [];
  const consumerStatus = mapConsumerGrowStatus({
    cycleStatus: deriveCycleStatus(
      proposals,
      executions,
      input.degradedReasons,
      input.researchTaskCount,
      input.plan,
    ),
    degradedReasons: input.degradedReasons,
    executionState: pendingExecution?.state ?? executions[0]?.state ?? null,
    proposalState: latestProposal?.state ?? null,
  });
  const strategyRef = input.workOrder?.objective.description ? 'grow-primary' : 'sandbox-balanced';
  return Object.freeze({
    reservedAmount: money(input.ledgerCash.growReservedMinorUnits, currency),
    paperDeployedAmount: money(input.ledgerCash.paperDeployedMinorUnits, currency),
    paperPositions: Object.freeze(positions),
    strategies: Object.freeze([
      Object.freeze({
        strategyRef,
        displayName: 'Grow primary strategy',
        deployedAmount: money(input.ledgerCash.paperDeployedMinorUnits, currency),
        status: consumerStatus,
      }),
    ]),
    strategyCapsules: Object.freeze(
      input.workOrder
        ? [
            Object.freeze({
              capsuleId: `scap_${input.workOrder.workOrderId}_primary`,
              displayLabel: 'Primary Grow capsule',
              promotionState: 'SANDBOX',
              qualificationState: 'QUALIFIED_FOR_SIMULATION',
              consumerVisible: true as const,
            }),
          ]
        : [],
    ),
    pendingProposalId:
      latestProposal &&
      (latestProposal.state === 'AWAITING_APPROVAL' || latestProposal.state === 'APPROVED')
        ? latestProposal.proposalId
        : null,
    pendingExecutionId: pendingExecution?.executionId ?? null,
    pendingOrders: Object.freeze(
      pendingExecution ? [pendingExecution.executionId] : [],
    ),
    settlementStates: Object.freeze(
      executions
        .filter((row) => row.state === 'SUBMITTED' || row.state === 'PROCESSING' || row.state === 'QUEUED')
        .map((row) => row.state),
    ),
    restrictions: Object.freeze(
      input.degradedReasons.length > 0 ? input.degradedReasons.map((reason) => `DEGRADED:${reason}`) : [],
    ),
    providerState: input.providerDisplay ?? null,
  });
}

function buildPerformanceSection(input: PaperGrowReadModelInput): GrowPaperPerformanceSection {
  const currency = input.ledgerCash.currency;
  const inv = input.investment;
  if (!inv) {
    return Object.freeze({
      initialPaperAllocation: zero(currency),
      netContributions: zero(currency),
      currentPaperValue: zero(currency),
      realizedPaperPnl: zero(currency),
      unrealizedPaperChange: zero(currency),
      incomeReceived: zero(currency),
      simulatedFees: zero(currency),
      simulatedSpreadSlippage: zero(currency),
      operatingResearchCost: zero(currency),
      netPaperResult: zero(currency),
      benchmark: null,
      valuationFreshness: input.valuationFreshness ?? null,
      resultKind: 'PAPER_SIMULATION',
      notLiveCustomerReturn: true,
    });
  }
  const netResult = (
    BigInt(inv.realizedMinorUnits) +
    BigInt(inv.unrealizedMinorUnits) -
    BigInt(inv.simulatedFeesMinorUnits) -
    BigInt(inv.simulatedSpreadSlippageMinorUnits)
  ).toString();
  return Object.freeze({
    initialPaperAllocation: money(inv.initialAllocationMinorUnits, currency),
    netContributions: money(inv.netContributionsMinorUnits, currency),
    currentPaperValue: money(inv.currentValueMinorUnits, currency),
    realizedPaperPnl: money(inv.realizedMinorUnits, currency),
    unrealizedPaperChange: money(inv.unrealizedMinorUnits, currency),
    incomeReceived: zero(currency),
    simulatedFees: money(inv.simulatedFeesMinorUnits, currency),
    simulatedSpreadSlippage: money(inv.simulatedSpreadSlippageMinorUnits, currency),
    operatingResearchCost: money(input.operatingResearchCostMinorUnits ?? '0', currency),
    netPaperResult: money(netResult, currency),
    benchmark:
      inv.benchmarkId && inv.benchmarkPeriodReturnBps
        ? Object.freeze({
            benchmarkId: inv.benchmarkId,
            periodReturnBps: inv.benchmarkPeriodReturnBps,
            methodology: 'sandbox-benchmark-simulation',
          })
        : null,
    valuationFreshness: input.valuationFreshness ?? null,
    resultKind: 'PAPER_SIMULATION',
    notLiveCustomerReturn: true,
  });
}

function buildProviderAccount(input: PaperGrowReadModelInput): GrowProviderConsumerState | null {
  return input.providerDisplay ?? null;
}

function buildOverviewEnvelope(
  input: PaperGrowReadModelInput,
  proposals: readonly FinancialProposal[],
  executions: readonly GrowExecutionRecord[],
): GrowOverviewResponse {
  const status = deriveCycleStatus(
    proposals,
    executions,
    input.degradedReasons,
    input.researchTaskCount,
    input.plan,
  );
  const consumerStatus = mapConsumerGrowStatus({
    cycleStatus: status,
    degradedReasons: input.degradedReasons,
    executionState: executions[0]?.state ?? null,
    proposalState: proposals[0]?.state ?? null,
  });
  const disclosure = buildPaperDisclosure();
  const activeCapital = buildActiveCapitalSection(input, proposals, executions);
  const restrictions = Object.freeze([...activeCapital.restrictions]);
  return projectOverview({
    customerId: input.customerId,
    subjectId: input.subjectId,
    cycleStatus: status,
    consumerStatus,
    degradedReasons: input.degradedReasons,
    currentRestrictions: restrictions,
    nextRequiredCustomerAction: deriveNextRequiredCustomerAction(consumerStatus, status),
    disclosure,
    plan: buildPlanSection(input, status),
    allocate: buildAllocateSection(input),
    activeCapital,
    performance: buildPerformanceSection(input),
    providerAccount: buildProviderAccount(input),
  });
}

export function buildPaperGrowOverview(input: PaperGrowReadModelInput): GrowOverviewResponse {
  const proposals = input.growStore.listProposals(input.subjectId);
  const executions = input.growStore.listExecutions(input.customerId);
  return buildOverviewEnvelope(input, proposals, executions);
}

export function buildPaperGrowActivity(input: PaperGrowReadModelInput): readonly GrowActivityRecord[] {
  const proposals = input.growStore.listProposals(input.subjectId);
  const executions = input.growStore.listExecutions(input.customerId);
  const status = deriveCycleStatus(
    proposals,
    executions,
    input.degradedReasons,
    input.researchTaskCount,
    input.plan,
  );
  const currency = input.ledgerCash.currency;
  const consumerStatus = mapConsumerGrowStatus({
    cycleStatus: status,
    degradedReasons: input.degradedReasons,
    executionState: executions[0]?.state ?? null,
    proposalState: proposals[0]?.state ?? null,
  });
  return projectActivityItems({
    proposals,
    executions,
    cycleStatus: status,
    consumerStatus,
    currency,
    investment: input.investment,
  });
}

export function buildPaperGrowCash(input: PaperGrowReadModelInput): GrowCashSnapshot {
  const currency = input.ledgerCash.currency;
  const available = (
    BigInt(input.ledgerCash.totalSandboxCashMinorUnits) -
    BigInt(input.ledgerCash.growReservedMinorUnits) -
    BigInt(input.ledgerCash.paperDeployedMinorUnits) -
    BigInt(input.ledgerCash.unsettledMinorUnits)
  ).toString();
  const restricted = input.degradedReasons.length > 0 ? input.ledgerCash.growReservedMinorUnits : '0';
  return Object.freeze({
    settledWithdrawable: money(available, currency),
    reserved: money(input.ledgerCash.growReservedMinorUnits, currency),
    invested: money(input.ledgerCash.paperDeployedMinorUnits, currency),
    pendingSettlement: money(input.ledgerCash.unsettledMinorUnits, currency),
    restricted: money(restricted, currency),
    totalCanonicalSandboxCash: money(input.ledgerCash.totalSandboxCashMinorUnits, currency),
    growReserved: money(input.ledgerCash.growReservedMinorUnits, currency),
    paperDeployed: money(input.ledgerCash.paperDeployedMinorUnits, currency),
    unsettled: money(input.ledgerCash.unsettledMinorUnits, currency),
    availableUnreserved: money(available, currency),
    notWithdrawableExternal: true,
    unrealizedIsNotWithdrawable: true,
    environment: 'simulation',
  });
}

export function buildPaperGrowActionCards(input: PaperGrowReadModelInput): readonly GrowActionCard[] {
  const proposals = input.growStore.listProposals(input.subjectId);
  const executions = input.growStore.listExecutions(input.customerId);
  const status = deriveCycleStatus(
    proposals,
    executions,
    input.degradedReasons,
    input.researchTaskCount,
    input.plan,
  );
  return Object.freeze(
    proposals.map((proposal) => {
      const consumerStatus = mapConsumerGrowStatus({
        cycleStatus: status,
        degradedReasons: input.degradedReasons,
        executionState: executions.find((row) => row.proposalId === proposal.proposalId)?.state ?? null,
        proposalState: proposal.state,
      });
      const awaitingApproval =
        proposal.state === 'AWAITING_APPROVAL' ||
        proposal.state === 'AWAITING_STEP_UP' ||
        proposal.state === 'APPROVED';
      return Object.freeze({
        actionCardId: `card_${proposal.proposalId}_v${String(proposal.version)}`,
        actionType: proposal.proposalType,
        amount: money(proposal.amount.minorUnits, proposal.amount.currency),
        instrumentId: proposal.instrumentId,
        instrumentLabel: proposal.instrumentId,
        reason: proposal.explainability.whyThis,
        evidenceSummary: proposal.explainability.supportedGoal,
        status: consumerStatus,
        riskFeeSummary: proposal.explainability.whatCouldGoWrong,
        expiresAt: proposal.expiresAt,
        customerActionRequired: awaitingApproval,
        approvalEndpoint: awaitingApproval ? `/api/v1/grow/proposals/${proposal.proposalId}/approve` : null,
        proposalId: proposal.proposalId,
        serverOwned: true as const,
      });
    }),
  );
}

export function buildPaperGrowAgentState(input: PaperGrowReadModelInput): GrowAgentStateResponse {
  const overview = buildPaperGrowOverview(input);
  const activity = buildPaperGrowActivity(input);
  return Object.freeze({
    schema: 'sunrey.consumer.grow.agent-state.v1',
    customerId: input.customerId,
    consumerStatus: overview.consumerStatus,
    summary: `Grow is ${overview.consumerStatus}. ${overview.plan.objective ?? 'No active objective.'}`,
    nextRequiredCustomerAction: overview.nextRequiredCustomerAction,
    overview: Object.freeze({
      cycleStatus: overview.cycleStatus,
      plan: overview.plan,
      allocate: overview.allocate,
      performance: overview.performance,
    }),
    recentActivityCount: activity.length,
    mayExecute: false,
    serverOwned: true,
  });
}

export function buildPaperGrowAttribution(): GrowAttributionModel {
  return Object.freeze({
    principalDepositsAreNotGrowth: true,
    expenseSavingsAreNotInvestmentPnl: true,
    unrealizedIsNotAvailableCash: true,
    tokenValuesAreNotRealizedProfit: true,
    researchEarningsSeparateFromInvestment: true,
    paperSeparateFromLiveRealized: true,
  });
}

export function buildPaperDisclosureContract(): PaperDisclosureContract {
  return buildPaperDisclosure();
}

export { deriveCycleStatus };
