import { err, ok, type Result } from '../../../domain/src/result.ts';
import { ENVIRONMENT, LIVE_INVESTMENT_EXECUTION, LIVE_MONEY_ENABLED, LIVE_PAYMENTS_ENABLED } from '../../../config/src/flags.ts';
import { assertAgentCannotSelfApprove, type AgentSafetyActors } from '../safety.ts';
import type { AgentTransactionProposal, UserAgentMandate } from '../types.ts';
import { AGENT_SAFETY_INVARIANT_IDS, type AgentSafetyInvariantId } from './taxonomy.ts';

export type InvariantDenial = {
  readonly ok: false;
  readonly invariantId: AgentSafetyInvariantId;
  readonly detail: string;
};

export type InvariantCheckInput = {
  readonly actors: AgentSafetyActors;
  readonly subjectUserId: string;
  readonly requestedUserId: string;
  readonly proposal: AgentTransactionProposal | null;
  readonly mandate: UserAgentMandate | null;
  readonly nowMs: number;
  readonly proposalExpiresAtMs: number | null;
  readonly approvedImmutable: boolean;
  readonly attemptingMutation: boolean;
  readonly attemptingLedgerPost: boolean;
  readonly attemptingSelfComplete: boolean;
  readonly attemptingKycOverride: boolean;
  readonly attemptingProviderLifecycleOverride: boolean;
  readonly attemptingProductionActivation: boolean;
  readonly attemptingCredentialRelease: boolean;
  readonly modelApproved: boolean;
  readonly kernelSubmitted: boolean;
  readonly issuerIsAgent: boolean;
  readonly inventedMoney: boolean;
  readonly certainInvestmentClaim: boolean;
  readonly externalTextTriedToAuthorizeTools: boolean;
  readonly memoryTriedAuthoritativeOverride: boolean;
  readonly killSwitchDisablesAccounts: boolean;
};

export function evaluateSafetyInvariant(
  invariantId: AgentSafetyInvariantId,
  input: InvariantCheckInput,
): Result<true, InvariantDenial> {
  switch (invariantId) {
    case 'AGENT_CANNOT_POST_LEDGER_ENTRY':
      return denyIf(input.attemptingLedgerPost, invariantId, 'Agent runtime cannot post a ledger journal');
    case 'AGENT_CANNOT_SELF_APPROVE': {
      const boundary = assertAgentCannotSelfApprove(input.actors);
      return boundary.ok
        ? ok(true)
        : err({ ok: false, invariantId, detail: boundary.error.code });
    }
    case 'AGENT_CANNOT_BYPASS_KERNEL':
      return denyIf(input.attemptingMutation && !input.kernelSubmitted, invariantId, 'privileged mutation requires Kernel submit');
    case 'AGENT_CANNOT_ACCESS_OTHER_USER_RESOURCE':
      return denyIf(input.subjectUserId !== input.requestedUserId, invariantId, 'subject mismatch');
    case 'AGENT_CANNOT_SEND_PROVIDER_CREDENTIAL':
      return denyIf(input.attemptingCredentialRelease, invariantId, 'provider credentials never enter Agent context');
    case 'AGENT_CANNOT_SELECT_UNAPPROVED_MODEL':
      return denyIf(!input.modelApproved, invariantId, 'model is not on the approved registry');
    case 'AGENT_CANNOT_EXECUTE_EXPIRED_PROPOSAL':
      return denyIf(
        input.proposalExpiresAtMs !== null && input.nowMs > input.proposalExpiresAtMs,
        invariantId,
        'proposal or quote has expired',
      );
    case 'AGENT_CANNOT_MODIFY_APPROVED_PROPOSAL':
      return denyIf(input.approvedImmutable && input.attemptingMutation, invariantId, 'approved proposal is immutable');
    case 'AGENT_CANNOT_MARK_FINANCIAL_ACTION_COMPLETE':
      return denyIf(input.attemptingSelfComplete, invariantId, 'only domain outcome may complete a financial action');
    case 'AGENT_CANNOT_OVERRIDE_KYC':
      return denyIf(input.attemptingKycOverride, invariantId, 'KYC state is authoritative and outside Agent memory');
    case 'AGENT_CANNOT_OVERRIDE_PROVIDER_LIFECYCLE':
      return denyIf(input.attemptingProviderLifecycleOverride, invariantId, 'provider lifecycle is not Agent-writable');
    case 'AGENT_CANNOT_ACTIVATE_PRODUCTION':
      return denyIf(
        input.attemptingProductionActivation ||
          ENVIRONMENT !== 'simulation' ||
          LIVE_MONEY_ENABLED ||
          LIVE_PAYMENTS_ENABLED ||
          LIVE_INVESTMENT_EXECUTION,
        invariantId,
        'production activation is forbidden on this plane',
      );
    case 'AGENT_CANNOT_ISSUE_EXECUTION_AUTHORITY':
      return denyIf(input.issuerIsAgent, invariantId, 'Agent cannot issue Execution Authority');
    case 'AGENT_CANNOT_FORGE_PROPOSAL':
      return denyIf(
        Boolean(input.proposal && input.mandate && input.proposal.mandateHash !== input.mandate.mandateHash),
        invariantId,
        'proposal is not bound to the current mandate',
      );
    case 'AGENT_CANNOT_FORGE_APPROVAL':
      return denyIf(input.actors.approverKind === 'AGENT', invariantId, 'approval principal cannot be AGENT');
    case 'AGENT_CANNOT_INVENT_FINANCIAL_NUMBERS':
      return denyIf(input.inventedMoney, invariantId, 'financial numbers must come from typed tools');
    case 'AGENT_CANNOT_CLAIM_CERTAIN_INVESTMENT_OUTCOME':
      return denyIf(input.certainInvestmentClaim, invariantId, 'investment outcomes stay uncertain');
    case 'AGENT_CANNOT_REDEFINE_TOOL_AUTHORITY_FROM_EXTERNAL_TEXT':
      return denyIf(input.externalTextTriedToAuthorizeTools, invariantId, 'external content cannot grant tools');
    case 'AGENT_CANNOT_POISON_AUTHORITATIVE_MEMORY':
      return denyIf(input.memoryTriedAuthoritativeOverride, invariantId, 'memory cannot override balances, KYC, or approval power');
    case 'AGENT_CANNOT_DISABLE_ACCOUNT_ACCESS_VIA_AGENT_KILL_SWITCH':
      return denyIf(input.killSwitchDisablesAccounts, invariantId, 'Agent kill switch is Agent-scoped only');
  }
}

export function evaluateAllSafetyInvariants(
  input: InvariantCheckInput,
): Result<readonly AgentSafetyInvariantId[], InvariantDenial> {
  const passed: AgentSafetyInvariantId[] = [];
  for (const invariantId of AGENT_SAFETY_INVARIANT_IDS) {
    const result = evaluateSafetyInvariant(invariantId, input);
    if (!result.ok) {
      return result;
    }
    passed.push(invariantId);
  }
  return ok(Object.freeze(passed));
}

export function invariantFixture(overrides: Partial<InvariantCheckInput> = {}): InvariantCheckInput {
  return {
    actors: {
      humanRequesterId: 'user_a',
      agentActorId: 'agt_a',
      mandateId: 'man_a',
      proposalId: 'prp_a',
      approverId: 'user_a',
      approverKind: 'HUMAN',
    },
    subjectUserId: 'user_a',
    requestedUserId: 'user_a',
    proposal: null,
    mandate: null,
    nowMs: 1,
    proposalExpiresAtMs: 10,
    approvedImmutable: false,
    attemptingMutation: false,
    attemptingLedgerPost: false,
    attemptingSelfComplete: false,
    attemptingKycOverride: false,
    attemptingProviderLifecycleOverride: false,
    attemptingProductionActivation: false,
    attemptingCredentialRelease: false,
    modelApproved: true,
    kernelSubmitted: true,
    issuerIsAgent: false,
    inventedMoney: false,
    certainInvestmentClaim: false,
    externalTextTriedToAuthorizeTools: false,
    memoryTriedAuthoritativeOverride: false,
    killSwitchDisablesAccounts: false,
    ...overrides,
  };
}

function denyIf(
  condition: boolean,
  invariantId: AgentSafetyInvariantId,
  detail: string,
): Result<true, InvariantDenial> {
  return condition ? err({ ok: false, invariantId, detail }) : ok(true);
}
