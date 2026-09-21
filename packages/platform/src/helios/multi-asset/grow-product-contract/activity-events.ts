import type { UtcInstant } from '@solstice/domain';
import type { FinancialProposal, GrowExecutionRecord } from '../../../grow/types.ts';
import type { GrowCycleStatus } from '../../paper-grow/taxonomy.ts';
import type { GrowIndependentOutcomeAttribution } from '../../outcome-attribution/types.ts';
import type { PaperGrowReadModelInput } from '../../paper-grow/read-model.ts';
import type { GrowMoneyDto, GrowProductActivityEvent, GrowProductActivityKind } from './types.ts';
import { resolveOperatingMode } from './mode.ts';

function money(minorUnits: string, currency: string): GrowMoneyDto {
  return Object.freeze({ minorUnits, currency });
}

function mapProposalToKind(proposal: FinancialProposal): GrowProductActivityKind {
  if (proposal.state === 'REJECTED' || proposal.state === 'CANCELLED') {
    return 'OPPORTUNITY_REJECTED';
  }
  if (proposal.state === 'APPROVED') {
    return 'CAPITAL_ALLOCATED';
  }
  return 'STRATEGY_EVALUATED';
}

function mapExecutionToKind(execution: GrowExecutionRecord): GrowProductActivityKind {
  if (execution.state === 'COMPLETED' || execution.state === 'PARTIALLY_COMPLETED') {
    return 'FILL';
  }
  if (execution.state === 'FAILED' || execution.state === 'CANCELLED') {
    return 'RISK_INTERVENTION';
  }
  return 'TRADE_SUBMITTED';
}

function userSafeSummary(kind: GrowProductActivityKind, label: string): string {
  switch (kind) {
    case 'OPPORTUNITY_FOUND':
      return `Grow identified an opportunity: ${label}`;
    case 'OPPORTUNITY_REJECTED':
      return `Grow declined an opportunity: ${label}`;
    case 'STRATEGY_EVALUATED':
      return `Grow evaluated a strategy action: ${label}`;
    case 'CAPITAL_ALLOCATED':
      return `Capital was reserved for Grow deployment: ${label}`;
    case 'TRADE_SUBMITTED':
      return `A paper trade was submitted: ${label}`;
    case 'FILL':
      return `A paper trade was filled: ${label}`;
    case 'EXIT':
      return `Grow processed a position exit: ${label}`;
    case 'SETTLEMENT':
      return 'Grow settlement state was updated';
    case 'RECONCILIATION':
      return 'Grow reconciliation completed';
    case 'RISK_INTERVENTION':
      return `Grow risk controls intervened: ${label}`;
    case 'USER_PAUSE':
      return 'Grow deployment was paused at your request';
    case 'USER_RESUME':
      return 'Grow deployment was resumed at your request';
    default:
      return label;
  }
}

export function buildGrowProductActivityEvents(input: {
  readonly readModel: PaperGrowReadModelInput;
  readonly cycleStatus: GrowCycleStatus;
  readonly attribution: GrowIndependentOutcomeAttribution | null;
  readonly deploymentPaused: boolean;
  readonly pauseUpdatedAt: UtcInstant | null;
}): readonly GrowProductActivityEvent[] {
  const currency = input.readModel.ledgerCash.currency;
  const operatingMode = resolveOperatingMode(input.readModel);
  const proposals = input.readModel.growStore.listProposals(input.readModel.subjectId);
  const executions = input.readModel.growStore.listExecutions(input.readModel.customerId);
  const events: GrowProductActivityEvent[] = [];

  if (input.readModel.plan && input.readModel.plan.candidateActions.length > 0) {
    const candidate = input.readModel.plan.orderedProposedActions[0] ?? input.readModel.plan.candidateActions[0];
    if (candidate) {
      events.push(
        Object.freeze({
          eventId: `evt_opp_${candidate.actionId}`,
          kind: 'OPPORTUNITY_FOUND',
          occurredAt: input.readModel.plan.generatedAt,
          summary: userSafeSummary('OPPORTUNITY_FOUND', candidate.title),
          instrumentId: null,
          instrumentLabel: candidate.title,
          amount: candidate.proposedAmount?.minorUnits
            ? money(candidate.proposedAmount.minorUnits, currency)
            : null,
          operatingMode,
          evidenceRefs: Object.freeze([`action:${candidate.actionId}`]),
          proposalId: null,
          executionId: null,
        }),
      );
    }
  }

  for (const proposal of proposals) {
    const kind = mapProposalToKind(proposal);
    const execution = executions.find((row) => row.proposalId === proposal.proposalId);
    events.push(
      Object.freeze({
        eventId: `evt_prop_${proposal.proposalId}_v${String(proposal.version)}`,
        kind,
        occurredAt: proposal.createdAt,
        summary: userSafeSummary(kind, proposal.intendedAction),
        instrumentId: proposal.instrumentId,
        instrumentLabel: proposal.instrumentId,
        amount: money(proposal.amount.minorUnits, proposal.amount.currency),
        operatingMode,
        evidenceRefs: Object.freeze([
          ...proposal.explainability.supportingFacts,
          ...proposal.opportunityIds.map((id) => `opp:${id}`),
        ]),
        proposalId: proposal.proposalId,
        executionId: execution?.executionId ?? null,
      }),
    );
    if (execution) {
      const execKind = mapExecutionToKind(execution);
      events.push(
        Object.freeze({
          eventId: `evt_exec_${execution.executionId}`,
          kind: execKind,
          occurredAt: execution.updatedAt,
          summary: userSafeSummary(execKind, proposal.intendedAction),
          instrumentId: proposal.instrumentId,
          instrumentLabel: proposal.instrumentId,
          amount: money(execution.filledMinorUnits, currency),
          operatingMode,
          evidenceRefs: Object.freeze([`execution:${execution.executionId}`]),
          proposalId: proposal.proposalId,
          executionId: execution.executionId,
        }),
      );
    }
  }

  if (BigInt(input.readModel.ledgerCash.unsettledMinorUnits) > 0n) {
    events.push(
      Object.freeze({
        eventId: `evt_settle_${input.readModel.customerId}`,
        kind: 'SETTLEMENT',
        occurredAt: input.readModel.valuationFreshness ?? input.readModel.plan?.generatedAt ?? proposalTimestamp(proposals),
        summary: userSafeSummary('SETTLEMENT', 'pending settlement'),
        instrumentId: null,
        instrumentLabel: null,
        amount: money(input.readModel.ledgerCash.unsettledMinorUnits, currency),
        operatingMode,
        evidenceRefs: Object.freeze(['ledger:pending_settlement']),
        proposalId: null,
        executionId: null,
      }),
    );
  }

  if (input.attribution?.reconciliation) {
    events.push(
      Object.freeze({
        eventId: `evt_recon_${input.readModel.customerId}`,
        kind: 'RECONCILIATION',
        occurredAt: input.attribution.generatedAt,
        summary: userSafeSummary('RECONCILIATION', input.attribution.reconciliation.result),
        instrumentId: null,
        instrumentLabel: null,
        amount: null,
        operatingMode,
        evidenceRefs: Object.freeze([...input.attribution.reconciliation.findings]),
        proposalId: null,
        executionId: null,
      }),
    );
  }

  if (input.deploymentPaused && input.pauseUpdatedAt) {
    events.push(
      Object.freeze({
        eventId: `evt_pause_${input.readModel.customerId}`,
        kind: 'USER_PAUSE',
        occurredAt: input.pauseUpdatedAt,
        summary: userSafeSummary('USER_PAUSE', 'deployment paused'),
        instrumentId: null,
        instrumentLabel: null,
        amount: null,
        operatingMode,
        evidenceRefs: Object.freeze(['controls:pause']),
        proposalId: null,
        executionId: null,
      }),
    );
  }

  if (input.readModel.degradedReasons.length > 0) {
    for (const reason of input.readModel.degradedReasons) {
      events.push(
        Object.freeze({
          eventId: `evt_risk_${reason}_${input.readModel.customerId}`,
          kind: 'RISK_INTERVENTION',
          occurredAt: input.readModel.valuationFreshness ?? proposalTimestamp(proposals),
          summary: userSafeSummary('RISK_INTERVENTION', reason),
          instrumentId: null,
          instrumentLabel: null,
          amount: null,
          operatingMode,
          evidenceRefs: Object.freeze([`degraded:${reason}`]),
          proposalId: null,
          executionId: null,
        }),
      );
    }
  }

  return Object.freeze(events.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1)));
}

function proposalTimestamp(proposals: readonly FinancialProposal[]): UtcInstant {
  return proposals[0]?.createdAt ?? ('1970-01-01T00:00:00.000Z' as UtcInstant);
}
