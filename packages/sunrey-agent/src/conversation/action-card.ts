import type { UtcInstant } from '../../../domain/src/time.ts';
import { contentHash } from '../ids.ts';
import type { ActionCardStatus, ActionCardType, AvailableActionControl } from './taxonomy.ts';
import type { ActionCard, ActionCardFinancialTerms, DomainProposalRef, MoneyTerm } from './types.ts';

export function availableActionsFor(status: ActionCardStatus): readonly AvailableActionControl[] {
  switch (status) {
    case 'COLLECTING':
      return Object.freeze(['ASK_AGENT']);
    case 'PROPOSAL_CREATED':
    case 'AWAITING_APPROVAL':
      return Object.freeze(['APPROVE', 'MODIFY', 'REJECT', 'CANCEL', 'ASK_AGENT']);
    case 'AWAITING_STEP_UP':
    case 'ACTION_REQUIRED':
      return Object.freeze(['APPROVE', 'CANCEL', 'ASK_AGENT']);
    case 'APPROVED':
    case 'PROCESSING':
    case 'SUBMITTED':
      return Object.freeze(['ASK_AGENT']);
    case 'REQUIRES_REVIEW':
      return Object.freeze(['ASK_AGENT', 'CANCEL']);
    case 'COMPLETED':
    case 'FAILED':
    case 'REJECTED':
    case 'CANCELLED':
    case 'EXPIRED':
    case 'SUPERSEDED':
      return Object.freeze(['ASK_AGENT']);
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function buildActionCard(input: {
  readonly actionId: string;
  readonly type: ActionCardType;
  readonly title: string;
  readonly summary: string;
  readonly status: ActionCardStatus;
  readonly proposal: DomainProposalRef | null;
  readonly now: UtcInstant;
}): ActionCard {
  const terms = termsFrom(input.proposal, input.now);
  return Object.freeze({
    schema: 'sunrey.consumer.action-card.v1',
    actionId: input.actionId,
    proposalId: input.proposal?.proposalId ?? null,
    proposalVersion: input.proposal?.version ?? null,
    type: input.type,
    title: input.title,
    summary: input.summary,
    financialTerms: terms,
    fees: terms.fees,
    risk: input.proposal?.riskSummary ?? 'No financial proposal has been issued yet.',
    expiry: input.proposal?.expiry ?? input.now,
    approvalRequirement: input.proposal?.requiresStepUp ? 'STEP_UP_AUTHENTICATION' : 'CUSTOMER_CONFIRMATION',
    stepUpRequirement: input.proposal?.requiresStepUp ?? false,
    status: input.status,
    availableActions: availableActionsFor(input.status),
    productionMoneyMovement: false,
    agentIsApprover: false,
  });
}

export function actionIdFor(subjectId: string, seed: string): string {
  return `act_${contentHash({ subjectId, seed }).slice(0, 20)}`;
}

function termsFrom(proposal: DomainProposalRef | null, now: UtcInstant): ActionCardFinancialTerms {
  const empty: MoneyTerm = {
    currency: 'USD',
    minorUnits: '0',
    uncertainty: 'UNKNOWN',
    source: 'POLICY',
  };
  if (!proposal) {
    return Object.freeze({
      amount: empty,
      fees: empty,
      rate: null,
      source: 'unresolved',
      destination: 'unresolved',
      asset: 'unresolved',
    });
  }
  return Object.freeze({
    amount: proposal.amount,
    fees: proposal.fees,
    rate: proposal.rate ?? null,
    source: proposal.sourceLabel,
    destination: proposal.destinationLabel,
    asset: proposal.assetLabel,
  });
}
