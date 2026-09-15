import type { FinancialProposalState, GrowExecutionState } from '../taxonomy.ts';
import type {
  CanonicalExecutionLifecycleState,
  CanonicalProposalLifecycleState,
  ExecutionMode,
} from './taxonomy.ts';
import { providerConfirmedState, submittedIsNotCompleted } from './execution-states.ts';

export type GrowExecutionProjectionInput = {
  readonly executionId: string;
  readonly commandId: string;
  readonly proposalId: string;
  readonly state: GrowExecutionState;
  readonly providerId: string | null;
  readonly filledMinorUnits: string;
  readonly requestedMinorUnits: string;
  readonly authorityId: string | null;
  readonly ledgerJournalId: string | null;
  readonly failureCode?: string | null;
};

export type GrowExecutionClientProjection = {
  readonly executionId: string;
  readonly commandId: string;
  readonly proposalId: string;
  readonly state: GrowExecutionState;
  readonly canonicalLifecycleState: CanonicalExecutionLifecycleState;
  readonly executionMode: ExecutionMode;
  readonly providerId: string | null;
  readonly filledMinorUnits: string;
  readonly requestedMinorUnits: string;
  readonly authorityId: string | null;
  readonly ledgerJournalId: string | null;
  readonly submittedIsNotCompleted: boolean;
  readonly providerConfirmed: boolean;
  readonly authorizationIsNotExecution: true;
  readonly approvalIsNotExecution: true;
  readonly submissionIsNotAcknowledgement: boolean;
  readonly acknowledgementIsNotFill: boolean;
  readonly fillIsNotSettlement: boolean;
  readonly settlementIsNotReconciliation: boolean;
  readonly productionMoneyMovement: false;
  readonly liveExecution: false;
};

export type GrowProposalClientProjection = {
  readonly proposalId: string;
  readonly version: number;
  readonly state: FinancialProposalState;
  readonly canonicalLifecycleState: CanonicalProposalLifecycleState;
  readonly serverOwned: true;
  readonly clientInstructionsTrusted: false;
  readonly proposalIsNotExecution: true;
  readonly approvalIsNotExecution: true;
  readonly authorizationIsNotExecution: true;
  readonly productionMoneyMovement: false;
  readonly executesMoney: false;
};

const PROPOSAL_TO_CANONICAL: Readonly<Record<FinancialProposalState, CanonicalProposalLifecycleState>> = Object.freeze({
  DRAFT: 'PROPOSED',
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  AWAITING_STEP_UP: 'AWAITING_APPROVAL',
  APPROVED: 'AUTHORIZED',
  SUPERSEDED: 'SUPERSEDED',
  EXPIRED: 'EXPIRED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
});

const EXECUTION_TO_CANONICAL: Readonly<Record<GrowExecutionState, CanonicalExecutionLifecycleState>> = Object.freeze({
  AUTHORIZED: 'AUTHORIZED',
  QUEUED: 'PROPOSED',
  SUBMITTED: 'SUBMITTED',
  PROCESSING: 'ACKNOWLEDGED',
  PARTIALLY_COMPLETED: 'PARTIALLY_FILLED',
  COMPLETED: 'FILLED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REVERSED: 'FAILED',
  REQUIRES_REVIEW: 'UNKNOWN',
});

export function mapGrowProposalToCanonicalLifecycle(state: FinancialProposalState): CanonicalProposalLifecycleState {
  return PROPOSAL_TO_CANONICAL[state];
}

export function mapGrowExecutionToCanonicalLifecycle(state: GrowExecutionState): CanonicalExecutionLifecycleState {
  return EXECUTION_TO_CANONICAL[state];
}

export function inferGrowExecutionMode(providerId: string | null): ExecutionMode {
  if (!providerId) {
    return 'SIMULATION_FIXTURE';
  }
  const normalized = providerId.toUpperCase();
  if (normalized.includes('PAPER')) {
    return 'PAPER';
  }
  if (normalized.includes('SANDBOX') || normalized.includes('SIM') || normalized.includes('CERT')) {
    return 'SIMULATION_SANDBOX';
  }
  if (normalized.includes('LIVE') || normalized.includes('PRODUCTION')) {
    return 'LIVE';
  }
  return 'PROVIDER_SANDBOX';
}

export function projectGrowExecutionForClient(row: GrowExecutionProjectionInput): GrowExecutionClientProjection {
  const canonicalLifecycleState = mapGrowExecutionToCanonicalLifecycle(row.state);
  const executionMode = inferGrowExecutionMode(row.providerId);
  const providerConfirmed = providerConfirmedState(row.state);
  const incomplete = submittedIsNotCompleted(row.state);
  return Object.freeze({
    executionId: row.executionId,
    commandId: row.commandId,
    proposalId: row.proposalId,
    state: row.state,
    canonicalLifecycleState,
    executionMode,
    providerId: row.providerId,
    filledMinorUnits: row.filledMinorUnits,
    requestedMinorUnits: row.requestedMinorUnits,
    authorityId: row.authorityId,
    ledgerJournalId: row.ledgerJournalId,
    submittedIsNotCompleted: incomplete,
    providerConfirmed,
    authorizationIsNotExecution: true,
    approvalIsNotExecution: true,
    submissionIsNotAcknowledgement: row.state === 'SUBMITTED' || row.state === 'QUEUED' || row.state === 'AUTHORIZED',
    acknowledgementIsNotFill:
      row.state === 'PROCESSING' ||
      row.state === 'SUBMITTED' ||
      row.state === 'QUEUED' ||
      row.state === 'AUTHORIZED',
    fillIsNotSettlement: row.state === 'COMPLETED' || row.state === 'PARTIALLY_COMPLETED',
    settlementIsNotReconciliation: row.state === 'COMPLETED',
    productionMoneyMovement: false,
    liveExecution: executionMode === 'LIVE',
  });
}

export function projectGrowProposalForClient(input: {
  readonly proposalId: string;
  readonly version: number;
  readonly state: FinancialProposalState;
}): GrowProposalClientProjection {
  return Object.freeze({
    proposalId: input.proposalId,
    version: input.version,
    state: input.state,
    canonicalLifecycleState: mapGrowProposalToCanonicalLifecycle(input.state),
    serverOwned: true,
    clientInstructionsTrusted: false,
    proposalIsNotExecution: true,
    approvalIsNotExecution: true,
    authorizationIsNotExecution: true,
    productionMoneyMovement: false,
    executesMoney: false,
  });
}

export function executionModeMustNotAppearLive(mode: ExecutionMode): boolean {
  return mode !== 'LIVE';
}
