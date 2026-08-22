import { addMs } from '../../config/src/clock.ts';
import { asUtcInstant, type UtcInstant } from '../../domain/src/time.ts';
import { Money } from '../../money/src/money.ts';
import {
  approvalIdFor,
  asGrowApprovalId,
  commandIdFor,
  executionIdFor,
} from './ids.ts';
import { assertNoGuaranteedReturnClaim } from './no-guaranteed-returns.ts';
import { intendedActionFor, routeProposalType } from './routing.ts';
import { suitabilityBlocksExecution } from './suitability.ts';
import type { GrowExecutionState } from './taxonomy.ts';
import type {
  FinancialProposal,
  GrowApproval,
  GrowExecutionCommand,
  GrowExecutionRecord,
  GrowFailure,
  GrowRevalidationFact,
  GrowRevalidationResult,
} from './types.ts';

const COMMAND_TTL_MS = 10 * 60 * 1000;

export function recordApproval(input: {
  readonly proposal: FinancialProposal;
  readonly actorId: string;
  readonly actorKind: GrowApproval['actorKind'];
  readonly now: UtcInstant;
  readonly authenticationAssurance: GrowApproval['authenticationAssurance'];
  readonly stepUpSatisfied: boolean;
}): GrowApproval | GrowFailure {
  if (input.actorKind !== 'CUSTOMER' && input.actorKind !== 'HUMAN_OPERATOR') {
    return { code: 'AGENT_CANNOT_SELF_APPROVE', message: 'only a human customer or operator may approve' };
  }
  if (input.proposal.state === 'EXPIRED' || input.proposal.expiresAt <= input.now) {
    return { code: 'PROPOSAL_EXPIRED', message: 'expired proposal cannot be approved' };
  }
  if (input.proposal.state === 'SUPERSEDED') {
    return { code: 'PROPOSAL_SUPERSEDED', message: 'superseded proposal cannot be approved' };
  }
  const stepUpRequired = input.proposal.requiredAuthAssurance === 'STEP_UP_SATISFIED';
  if (stepUpRequired && !input.stepUpSatisfied) {
    return { code: 'STEP_UP_REQUIRED', message: 'step-up authentication is required before approval completes' };
  }
  return Object.freeze({
    approvalId: approvalIdFor(input.proposal.proposalId, input.proposal.version),
    proposalId: input.proposal.proposalId,
    proposalVersion: input.proposal.version,
    proposalContentHash: input.proposal.contentHash,
    subjectId: input.proposal.subjectId,
    customerId: input.proposal.customerId,
    actorId: input.actorId,
    actorKind: input.actorKind,
    approvedAt: input.now,
    authenticationAssurance: input.authenticationAssurance,
    stepUpRequired,
    stepUpSatisfied: input.stepUpSatisfied,
  });
}

export function createExecutionCommand(input: {
  readonly proposal: FinancialProposal;
  readonly approval: GrowApproval;
  readonly now: UtcInstant;
  readonly idempotencyKey: string;
}): GrowExecutionCommand | GrowFailure {
  if (input.proposal.state !== 'APPROVED') {
    return { code: 'PROPOSAL_NOT_APPROVED', message: 'execution command requires an approved proposal' };
  }
  if (input.approval.proposalContentHash !== input.proposal.contentHash) {
    return { code: 'PROPOSAL_FORGED', message: 'approval does not bind this server-owned proposal content' };
  }
  if (input.approval.proposalVersion !== input.proposal.version) {
    return { code: 'PROPOSAL_SUPERSEDED', message: 'approval is not for this proposal version' };
  }
  if (suitabilityBlocksExecution(input.proposal.suitability)) {
    return { code: 'SUITABILITY_MISMATCH', message: `suitability is ${input.proposal.suitability}` };
  }
  const command: GrowExecutionCommand = Object.freeze({
    commandId: commandIdFor(input.proposal.proposalId, input.proposal.version, input.idempotencyKey),
    proposalId: input.proposal.proposalId,
    proposalVersion: input.proposal.version,
    proposalContentHash: input.proposal.contentHash,
    customerId: input.proposal.customerId,
    subjectId: input.proposal.subjectId,
    approvalId: asGrowApprovalId(input.approval.approvalId),
    authenticationAssurance: input.approval.authenticationAssurance,
    suitability: input.proposal.suitability,
    policyDecision: input.proposal.policyDecision,
    idempotencyKey: input.idempotencyKey,
    expiresAt: asUtcInstant(addMs(input.now, COMMAND_TTL_MS)),
    financialResource: Object.freeze({
      sourceAccountId: input.proposal.sourceAccountId,
      destinationAccountId: input.proposal.destinationAccountId,
      instrumentId: input.proposal.instrumentId,
      amount: input.proposal.amount,
    }),
    intendedAction: intendedActionFor(input.proposal.proposalType),
    proposalType: input.proposal.proposalType,
    domain: routeProposalType(input.proposal.proposalType),
    createdAt: input.now,
    clientBodyTrusted: false,
  });
  assertNoGuaranteedReturnClaim(command, 'execution command');
  return command;
}

export function revalidateBeforeExecution(input: {
  readonly proposal: FinancialProposal;
  readonly command: GrowExecutionCommand;
  readonly approval: GrowApproval;
  readonly now: UtcInstant;
  readonly facts: Omit<GrowRevalidationFact, 'proposalExpired' | 'proposalSuperseded' | 'approvalValid' | 'authenticationSufficient' | 'materialChange'>;
}): GrowRevalidationResult {
  const proposalExpired = input.proposal.state === 'EXPIRED' || input.proposal.expiresAt <= input.now || input.command.expiresAt <= input.now;
  const proposalSuperseded = input.proposal.state === 'SUPERSEDED';
  const approvalValid =
    input.approval.proposalContentHash === input.proposal.contentHash &&
    input.approval.proposalId === input.proposal.proposalId &&
    input.approval.proposalVersion === input.proposal.version;
  const authenticationSufficient =
    !input.approval.stepUpRequired || input.approval.stepUpSatisfied;
  const available = Money.fromMinorUnitsString(input.facts.availableMinorUnits, input.command.financialResource.amount.currency);
  const requested = Money.fromMinorUnitsString(
    input.command.financialResource.amount.minorUnits,
    input.command.financialResource.amount.currency,
  );
  const insufficient = available.cmp(requested) < 0;
  const materialChange =
    proposalExpired ||
    proposalSuperseded ||
    !approvalValid ||
    !authenticationSufficient ||
    input.facts.accountStatus !== 'ACTIVE' ||
    insufficient ||
    !input.facts.productAvailable ||
    !input.facts.providerAvailable ||
    suitabilityBlocksExecution(input.facts.suitability) ||
    input.facts.kernelPolicy !== 'ALLOW' ||
    !input.facts.complianceClear ||
    !input.facts.marketQuoteValid;
  const facts: GrowRevalidationFact = Object.freeze({
    ...input.facts,
    proposalExpired,
    proposalSuperseded,
    approvalValid,
    authenticationSufficient,
    materialChange,
  });
  if (materialChange) {
    const code = proposalExpired
      ? 'PROPOSAL_EXPIRED'
      : proposalSuperseded
        ? 'PROPOSAL_SUPERSEDED'
        : !approvalValid
          ? 'PROPOSAL_FORGED'
          : !authenticationSufficient
            ? 'AUTH_ASSURANCE_INSUFFICIENT'
            : input.facts.accountStatus === 'RESTRICTED'
              ? 'ACCOUNT_RESTRICTED'
              : insufficient
                ? 'INSUFFICIENT_FUNDS'
                : !input.facts.providerAvailable
                  ? 'PROVIDER_UNAVAILABLE'
                  : !input.facts.productAvailable
                    ? 'PRODUCT_UNAVAILABLE'
                    : !input.facts.marketQuoteValid
                      ? 'QUOTE_EXPIRED'
                      : suitabilityBlocksExecution(input.facts.suitability)
                        ? 'SUITABILITY_MISMATCH'
                        : input.facts.kernelPolicy !== 'ALLOW'
                          ? 'REFRESH_PROPOSAL_REQUIRED'
                          : 'MATERIAL_STATE_CHANGED';
    return Object.freeze({
      accepted: false,
      requireRefreshedProposal: code === 'REFRESH_PROPOSAL_REQUIRED' || code === 'MATERIAL_STATE_CHANGED' || code === 'PROPOSAL_EXPIRED',
      code,
      message: 'material conditions changed; do not silently substitute a new action',
      facts,
    });
  }
  return Object.freeze({
    accepted: true,
    requireRefreshedProposal: false,
    code: 'OK',
    message: 'pre-execution revalidation accepted',
    facts,
  });
}

export function initialExecutionRecord(command: GrowExecutionCommand, now: UtcInstant): GrowExecutionRecord {
  return Object.freeze({
    executionId: executionIdFor(command.commandId),
    commandId: command.commandId,
    proposalId: command.proposalId,
    proposalVersion: command.proposalVersion,
    customerId: command.customerId,
    state: 'QUEUED',
    domain: command.domain,
    reservationHoldId: null,
    providerId: null,
    providerResult: null,
    ledgerJournalId: null,
    custodyRef: null,
    filledMinorUnits: '0',
    requestedMinorUnits: command.financialResource.amount.minorUnits,
    authorityId: null,
    createdAt: now,
    updatedAt: now,
    failureCode: null,
    notes: Object.freeze([]),
  });
}

const LEGAL_EXECUTION: Readonly<Record<GrowExecutionState, readonly GrowExecutionState[]>> = Object.freeze({
  AUTHORIZED: Object.freeze(['QUEUED', 'CANCELLED', 'REQUIRES_REVIEW']),
  QUEUED: Object.freeze(['AUTHORIZED', 'SUBMITTED', 'CANCELLED', 'FAILED', 'REQUIRES_REVIEW']),
  SUBMITTED: Object.freeze(['PROCESSING', 'PARTIALLY_COMPLETED', 'COMPLETED', 'FAILED', 'REQUIRES_REVIEW']),
  PROCESSING: Object.freeze(['PARTIALLY_COMPLETED', 'COMPLETED', 'FAILED', 'REQUIRES_REVIEW']),
  PARTIALLY_COMPLETED: Object.freeze(['COMPLETED', 'FAILED', 'REQUIRES_REVIEW', 'REVERSED']),
  COMPLETED: Object.freeze(['REVERSED']),
  FAILED: Object.freeze(['REVERSED', 'REQUIRES_REVIEW']),
  CANCELLED: Object.freeze([]),
  REVERSED: Object.freeze([]),
  REQUIRES_REVIEW: Object.freeze(['QUEUED', 'CANCELLED', 'FAILED']),
});

export function transitionExecution(
  record: GrowExecutionRecord,
  to: GrowExecutionState,
  now: UtcInstant,
  patch: Partial<GrowExecutionRecord> = {},
): GrowExecutionRecord | GrowFailure {
  if (!LEGAL_EXECUTION[record.state].includes(to)) {
    return { code: 'MATERIAL_STATE_CHANGED', message: `cannot transition ${record.state} to ${to}` };
  }
  if (to === 'COMPLETED' && record.state === 'SUBMITTED' && patch.filledMinorUnits === undefined) {
    return { code: 'PROVIDER_PENDING', message: 'submitted is not completed; wait for fill or settlement' };
  }
  return Object.freeze({
    ...record,
    ...patch,
    state: to,
    updatedAt: now,
  });
}

export function classifyProviderOutcome(outcome: {
  readonly kind: 'FILL' | 'PARTIAL_FILL' | 'PENDING' | 'UNKNOWN' | 'REJECTION' | 'SETTLEMENT_FAILURE' | 'QUOTE_EXPIRED';
  readonly filledMinorUnits?: string;
  readonly requestedMinorUnits: string;
}): { readonly state: GrowExecutionState; readonly code: GrowExecutionRecord['failureCode'] } {
  switch (outcome.kind) {
    case 'FILL':
      return { state: 'COMPLETED', code: null };
    case 'PARTIAL_FILL':
      return { state: 'PARTIALLY_COMPLETED', code: 'PARTIAL_FILL' };
    case 'PENDING':
      return { state: 'PROCESSING', code: 'PROVIDER_PENDING' };
    case 'UNKNOWN':
      return { state: 'REQUIRES_REVIEW', code: 'PROVIDER_UNKNOWN' };
    case 'REJECTION':
      return { state: 'FAILED', code: 'PROVIDER_REJECTION' };
    case 'SETTLEMENT_FAILURE':
      return { state: 'FAILED', code: 'SETTLEMENT_FAILURE' };
    case 'QUOTE_EXPIRED':
      return { state: 'FAILED', code: 'QUOTE_EXPIRED' };
    default: {
      const exhaustive: never = outcome.kind;
      return exhaustive;
    }
  }
}
