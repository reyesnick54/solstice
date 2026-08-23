import { addMs } from '../../../config/src/clock.ts';
import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { sha256Hex } from '../../../security/src/hash.ts';
import type { GrowthActionCandidate, GrowthPlan } from '../growth/types.ts';
import {
  asFinancialProposalId,
  asFinancialProposalVersion,
  proposalIdFor,
  type FinancialProposalId,
} from './ids.ts';
import { assertNoGuaranteedReturnClaim } from './no-guaranteed-returns.ts';
import { intendedActionFor, routeProposalType } from './routing.ts';
import { evaluateGrowSuitability, type SuitabilityFacts } from './suitability.ts';
import type { FinancialProposalType } from './taxonomy.ts';
import type { FinancialProposal, GrowMoney, ProposalExplainability, ScenarioBand } from './types.ts';

const PROPOSAL_TTL_MS = 30 * 60 * 1000;

export function proposalTypeForAction(action: string): FinancialProposalType {
  if (action === 'PAPER_INVESTMENT_REVIEW_AVAILABLE' || action === 'INVESTMENT_ACCOUNT_AVAILABLE') {
    return 'INVESTMENT_BUY';
  }
  if (action === 'MOVE_IDLE_CASH_BETWEEN_EXISTING_ELIGIBLE_ACCOUNTS') {
    return 'CASH_TRANSFER';
  }
  if (action === 'ALLOCATE_TO_EMERGENCY_RESERVE') {
    return 'CASH_TRANSFER';
  }
  return 'CASH_TRANSFER';
}

export function hashProposalContent(input: {
  readonly proposalId: string;
  readonly version: number;
  readonly subjectId: string;
  readonly amount: GrowMoney;
  readonly sourceAccountId: string;
  readonly destinationAccountId: string | null;
  readonly intendedAction: string;
}): string {
  return sha256Hex(
    JSON.stringify({
      proposalId: input.proposalId,
      version: input.version,
      subjectId: input.subjectId,
      amount: input.amount,
      sourceAccountId: input.sourceAccountId,
      destinationAccountId: input.destinationAccountId,
      intendedAction: input.intendedAction,
    }),
  );
}

export function generateFinancialProposal(input: {
  readonly plan: GrowthPlan;
  readonly candidate: GrowthActionCandidate;
  readonly customerId: string;
  readonly now: UtcInstant;
  readonly suitabilityFacts: SuitabilityFacts;
  readonly version?: number;
  readonly supersedes?: FinancialProposal;
}): FinancialProposal {
  const version = asFinancialProposalVersion(input.version ?? 1);
  const proposalType = proposalTypeForAction(input.candidate.action);
  const amount = input.candidate.proposedAmount ?? { minorUnits: '0', currency: input.plan.expectedDeterministicEffect.currency };
  const proposalId = input.supersedes
    ? asFinancialProposalId(input.supersedes.proposalId)
    : proposalIdFor(input.plan.planId, input.candidate.actionId, version);
  const intendedAction = intendedActionFor(proposalType);
  const suitability = evaluateGrowSuitability(input.suitabilityFacts);
  const scenario: ScenarioBand = Object.freeze({
    kind: input.candidate.expectedEffect.kind === 'DETERMINISTIC_EFFECT' ? 'ESTIMATE' : 'PROJECTION',
    label: 'sandbox scenario; not a promised outcome',
    low:
      input.candidate.expectedEffect.kind === 'UNCERTAIN_MARKET_OUTCOME'
        ? input.candidate.expectedEffect.low
        : amount,
    high:
      input.candidate.expectedEffect.kind === 'UNCERTAIN_MARKET_OUTCOME'
        ? input.candidate.expectedEffect.high
        : amount,
    assumptions: Object.freeze([
      ...input.candidate.assumptions,
      'Projection and estimate are not actual results.',
    ]),
    achievementPromised: false,
    legallyGuaranteedProduct: false,
  });
  const explainability: ProposalExplainability = Object.freeze({
    whyThis: input.candidate.title,
    whyNow: 'Current PEG facts and mandate constraints support a review now.',
    supportedGoal: input.plan.goalsAddressed[0] ?? 'mandate-goal',
    supportingFacts: Object.freeze([...input.candidate.supportingFactRefs]),
    suitabilitySummary: suitability,
    whatCouldGoWrong: 'Market, funds, or eligibility can change before execution.',
    requiresConfirmation: true,
    canExecuteWithoutAuthority: false,
    resultKind: scenario.kind,
  });
  const contentHash = hashProposalContent({
    proposalId,
    version,
    subjectId: input.plan.subjectId,
    amount,
    sourceAccountId: input.candidate.sourceAccountId ?? '',
    destinationAccountId: input.candidate.destinationAccountId ?? null,
    intendedAction,
  });
  const proposal: FinancialProposal = Object.freeze({
    proposalId,
    version,
    supersedesVersion: input.supersedes ? input.supersedes.version : null,
    subjectId: input.plan.subjectId,
    customerId: input.customerId,
    planId: input.plan.planId,
    planVersion: input.plan.version,
    actionId: input.candidate.actionId,
    pegSnapshotId: input.plan.pegSnapshotId,
    opportunityIds: Object.freeze([...input.candidate.pegOpportunityIds]),
    proposalType,
    state: 'AWAITING_APPROVAL',
    intendedAction,
    sourceAccountId: input.candidate.sourceAccountId ?? '',
    destinationAccountId: input.candidate.destinationAccountId ?? null,
    instrumentId: proposalType === 'INVESTMENT_BUY' || proposalType === 'INVESTMENT_SELL' ? 'SIM-ETF-1' : null,
    amount,
    createdAt: input.now,
    expiresAt: asUtcInstant(addMs(input.now, PROPOSAL_TTL_MS)),
    contentHash,
    serverOwned: true,
    clientInstructionsTrusted: false,
    suitability,
    policyDecision: 'PENDING_KERNEL',
    requiredAuthAssurance: input.candidate.userConfirmationRequired ? 'STEP_UP_SATISFIED' : 'AAL1',
    explainability,
    scenario,
    assumptions: Object.freeze([...scenario.assumptions]),
  });
  assertNoGuaranteedReturnClaim(proposal, 'financial proposal');
  void routeProposalType(proposalType);
  return proposal;
}

export function modifyProposalAmount(
  current: FinancialProposal,
  plan: GrowthPlan,
  candidate: GrowthActionCandidate,
  amount: GrowMoney,
  now: UtcInstant,
  suitabilityFacts: SuitabilityFacts,
): FinancialProposal {
  const next = generateFinancialProposal({
    plan,
    candidate: { ...candidate, proposedAmount: amount },
    customerId: current.customerId,
    now,
    suitabilityFacts,
    version: current.version + 1,
    supersedes: current,
  });
  return Object.freeze({
    ...next,
    proposalId: current.proposalId,
  });
}

export function isProposalCurrent(proposal: FinancialProposal, now: UtcInstant): boolean {
  if (
    proposal.state === 'SUPERSEDED' ||
    proposal.state === 'EXPIRED' ||
    proposal.state === 'CANCELLED' ||
    proposal.state === 'REJECTED' ||
    proposal.state === 'DRAFT'
  ) {
    return false;
  }
  return proposal.expiresAt > now;
}
