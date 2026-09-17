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
  GrowActivityRecord,
  GrowAllocateSection,
  GrowActiveCapitalSection,
  GrowAttributionModel,
  GrowCashSnapshot,
  GrowMoneyDto,
  GrowOverviewResponse,
  GrowPaperPerformanceSection,
  GrowPlanSection,
  PaperDisclosureContract,
} from './types.ts';
import type { GrowCycleStatus, GrowDegradedReason } from './taxonomy.ts';
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
  const latestExecution = executions.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
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

function buildAllocateSection(input: PaperGrowReadModelInput): GrowAllocateSection {
  const currency = input.ledgerCash.currency;
  const reserved = input.ledgerCash.growReservedMinorUnits;
  const total = input.ledgerCash.totalSandboxCashMinorUnits;
  const unallocated = (
    BigInt(total) - BigInt(reserved) - BigInt(input.ledgerCash.paperDeployedMinorUnits)
  ).toString();
  const latestProposal = input.growStore.listProposals(input.subjectId)[0];
  const assigned = latestProposal?.amount.minorUnits ?? '0';
  const fundingAccount = latestProposal?.sourceAccountId ?? input.workOrder?.capitalBoundary.accountId ?? null;
  return Object.freeze({
    amountAssigned: money(assigned, currency),
    fundingAccountId: fundingAccount,
    reservedAmount: money(reserved, currency),
    retainedLiquidity: money(
      (BigInt(total) - BigInt(assigned)).toString(),
      currency,
    ),
    unallocatedAvailable: money(unallocated, currency),
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
  return Object.freeze({
    reservedAmount: money(input.ledgerCash.growReservedMinorUnits, currency),
    paperDeployedAmount: money(input.ledgerCash.paperDeployedMinorUnits, currency),
    paperPositions: Object.freeze(positions),
    pendingProposalId:
      latestProposal &&
      (latestProposal.state === 'AWAITING_APPROVAL' || latestProposal.state === 'APPROVED')
        ? latestProposal.proposalId
        : null,
    pendingExecutionId: pendingExecution?.executionId ?? null,
    restrictions: Object.freeze([]),
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
      simulatedFees: zero(currency),
      simulatedSpreadSlippage: zero(currency),
      netPaperResult: zero(currency),
      benchmark: null,
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
    simulatedFees: money(inv.simulatedFeesMinorUnits, currency),
    simulatedSpreadSlippage: money(inv.simulatedSpreadSlippageMinorUnits, currency),
    netPaperResult: money(netResult, currency),
    benchmark:
      inv.benchmarkId && inv.benchmarkPeriodReturnBps
        ? Object.freeze({
            benchmarkId: inv.benchmarkId,
            periodReturnBps: inv.benchmarkPeriodReturnBps,
          })
        : null,
    resultKind: 'PAPER_SIMULATION',
    notLiveCustomerReturn: true,
  });
}

export function buildPaperGrowOverview(input: PaperGrowReadModelInput): GrowOverviewResponse {
  const proposals = input.growStore.listProposals(input.subjectId);
  const executions = input.growStore.listExecutions(input.customerId);
  const status = deriveCycleStatus(
    proposals,
    executions,
    input.degradedReasons,
    input.researchTaskCount,
    input.plan,
  );
  const disclosure = buildPaperDisclosure();
  return projectOverview({
    customerId: input.customerId,
    subjectId: input.subjectId,
    cycleStatus: status,
    degradedReasons: input.degradedReasons,
    disclosure,
    plan: buildPlanSection(input, status),
    allocate: buildAllocateSection(input),
    activeCapital: buildActiveCapitalSection(input, proposals, executions),
    performance: buildPerformanceSection(input),
  });
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
  return projectActivityItems({
    proposals,
    executions,
    cycleStatus: status,
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
  return Object.freeze({
    totalCanonicalSandboxCash: money(input.ledgerCash.totalSandboxCashMinorUnits, currency),
    growReserved: money(input.ledgerCash.growReservedMinorUnits, currency),
    paperDeployed: money(input.ledgerCash.paperDeployedMinorUnits, currency),
    unsettled: money(input.ledgerCash.unsettledMinorUnits, currency),
    availableUnreserved: money(available, currency),
    notWithdrawableExternal: true,
    environment: 'simulation',
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
