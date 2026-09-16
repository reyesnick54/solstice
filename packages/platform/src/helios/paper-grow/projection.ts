import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { FinancialProposal, GrowExecutionRecord } from '../../grow/types.ts';
import type {
  GrowActivityRecord,
  GrowMoneyDto,
  GrowOverviewResponse,
  PaperDisclosureContract,
} from './types.ts';
import type { GrowCycleStatus } from './taxonomy.ts';
import type { PaperGrowInvestmentSnapshot } from './read-model.ts';

export function buildPaperDisclosure(): PaperDisclosureContract {
  return Object.freeze({
    environment: 'simulation',
    executionMode: 'PAPER',
    productionMoneyMovement: false,
    liveExecution: false,
    paperResultIsNotLiveReturn: true,
    paperProceedsNotWithdrawableExternal: true,
    depositsAreNotPerformance: true,
    expenseSavingsAreNotInvestmentPnl: true,
    unrealizedIsNotAvailableCash: true,
    disclosures: Object.freeze([
      'SANDBOX_SIMULATION',
      'PAPER_TRADING',
      'NOT_LIVE_RETURN',
      'NOT_WITHDRAWABLE_EXTERNAL',
    ]),
  });
}

export function projectOverview(input: {
  readonly customerId: string;
  readonly subjectId: string;
  readonly cycleStatus: GrowCycleStatus;
  readonly degradedReasons: readonly string[];
  readonly disclosure: PaperDisclosureContract;
  readonly plan: GrowOverviewResponse['plan'];
  readonly allocate: GrowOverviewResponse['allocate'];
  readonly activeCapital: GrowOverviewResponse['activeCapital'];
  readonly performance: GrowOverviewResponse['performance'];
}): GrowOverviewResponse {
  return Object.freeze({
    schema: 'sunrey.consumer.grow.overview.v1',
    customerId: input.customerId,
    subjectId: input.subjectId,
    cycleStatus: input.cycleStatus,
    degradedReasons: Object.freeze(input.degradedReasons as GrowOverviewResponse['degradedReasons']),
    disclosure: input.disclosure,
    plan: input.plan,
    allocate: input.allocate,
    activeCapital: input.activeCapital,
    performance: input.performance,
    frontendMathAuthoritative: false,
    serverOwned: true,
  });
}

function money(minorUnits: string, currency: string): GrowMoneyDto {
  return Object.freeze({ minorUnits, currency });
}

function controlResultForProposal(proposal: FinancialProposal): string | null {
  if (proposal.state === 'APPROVED') {
    return 'CONTROL_PASSED';
  }
  if (proposal.state === 'REJECTED' || proposal.state === 'CANCELLED') {
    return 'CONTROL_REJECTED';
  }
  if (proposal.state === 'AWAITING_APPROVAL' || proposal.state === 'AWAITING_STEP_UP') {
    return 'AWAITING_CUSTOMER_CONTROL';
  }
  return null;
}

function executionForProposal(
  executions: readonly GrowExecutionRecord[],
  proposalId: string,
): GrowExecutionRecord | undefined {
  return executions.find((e) => e.proposalId === proposalId);
}

export function projectActivityItems(input: {
  readonly proposals: readonly FinancialProposal[];
  readonly executions: readonly GrowExecutionRecord[];
  readonly cycleStatus: GrowCycleStatus;
  readonly currency: string;
  readonly investment: PaperGrowInvestmentSnapshot | null;
}): readonly GrowActivityRecord[] {
  const items: GrowActivityRecord[] = [];
  for (const proposal of input.proposals) {
    const execution = executionForProposal(input.executions, proposal.proposalId);
    const holding = input.investment?.holdings[0];
    const positionStatus: GrowActivityRecord['positionStatus'] =
      execution?.state === 'COMPLETED' || execution?.state === 'PARTIALLY_COMPLETED'
        ? holding?.positionStatus ?? 'OPEN'
        : execution
          ? 'PENDING'
          : 'NONE';
    items.push(
      Object.freeze({
        activityId: `act_${proposal.proposalId}_v${String(proposal.version)}`,
        status: input.cycleStatus,
        whyConsidered: proposal.explainability.whyThis,
        researchSummary: proposal.explainability.supportedGoal,
        instrumentId: proposal.instrumentId,
        instrumentLabel: holding?.displayName ?? proposal.intendedAction,
        action: proposal.intendedAction,
        amount: money(proposal.amount.minorUnits, proposal.amount.currency),
        quantityUnits: holding?.quantityUnits ?? null,
        proposedAt: proposal.createdAt,
        controlResult: controlResultForProposal(proposal),
        paperSubmissionId: execution?.state === 'SUBMITTED' || execution?.state === 'PROCESSING' ? execution.executionId : null,
        paperFillId:
          execution?.state === 'COMPLETED' || execution?.state === 'PARTIALLY_COMPLETED'
            ? execution.executionId
            : null,
        simulatedFees: money(input.investment?.simulatedFeesMinorUnits ?? '0', input.currency),
        positionStatus,
        closeResult:
          positionStatus === 'CLOSED' && input.investment
            ? money(input.investment.realizedMinorUnits, input.currency)
            : null,
        evidenceRefs: Object.freeze([
          ...proposal.explainability.supportingFacts,
          ...proposal.opportunityIds.map((id) => `opp:${id}`),
        ]),
        proposalId: proposal.proposalId,
        executionId: execution?.executionId ?? null,
      }),
    );
  }
  return Object.freeze(items.sort((a, b) => (a.proposedAt < b.proposedAt ? 1 : -1)));
}
