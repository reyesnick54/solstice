import { ENVIRONMENT } from '../../config/src/flags.ts';
import type { Clock } from '../../config/src/clock.ts';
import { isExpired } from '../../config/src/clock.ts';
import { err, isOk, ok, type Result } from '../../domain/src/result.ts';
import type { ApprovalState } from './approval.ts';
import type { AuthorityIssuer, ExecutionAuthority, VerifiedExecutionAuthority } from './execution-authority.ts';
import type { ExecutionProposal } from './proposal.ts';

export type ExecutionGateFailure = {
  readonly code:
    | 'AUTHORITY_REJECTED'
    | 'PROPOSAL_NOT_APPROVED'
    | 'PROPOSAL_EXPIRED'
    | 'IDEMPOTENCY_CONFLICT'
    | 'CLIENT_PRIVILEGE_REJECTED'
    | 'ENVIRONMENT_DISABLED'
    | 'ACTOR_MISMATCH'
    | 'AUTHENTICATION_INSUFFICIENT';
  readonly message: string;
};

export type ExecutionGateInput = {
  readonly proposal: ExecutionProposal;
  readonly authority: ExecutionAuthority;
  readonly issuer: AuthorityIssuer;
  readonly clock: Clock;
  readonly expectedActorId: string;
  readonly clientSuppliedAuthority: boolean;
  readonly authenticationMeetsRequirement: boolean;
  readonly priorExecutionKey?: string | null;
};

/**
 * Single reusable boundary through which approved regulated commands
 * are submitted to canonical Execution Authority. Does not issue
 * authority. Does not expose an HTTP endpoint to Lovable.
 */
export function submitRegulatedCommand<T>(
  input: ExecutionGateInput,
  mutate: (verified: VerifiedExecutionAuthority) => Result<T, ExecutionGateFailure>,
): Result<{ readonly value: T; readonly verified: VerifiedExecutionAuthority }, ExecutionGateFailure> {
  if (ENVIRONMENT !== 'simulation') {
    return err({
      code: 'ENVIRONMENT_DISABLED',
      message: 'Execution Authority is available only in simulation',
    });
  }
  if (input.clientSuppliedAuthority) {
    return err({
      code: 'CLIENT_PRIVILEGE_REJECTED',
      message: 'Execution Authority cannot be supplied by the client',
    });
  }
  if (input.proposal.state !== ('APPROVED' satisfies ApprovalState)) {
    return err({
      code: 'PROPOSAL_NOT_APPROVED',
      message: 'proposal is not approved for execution',
    });
  }
  if (isExpired(input.proposal.expiresAt, input.clock.now())) {
    return err({
      code: 'PROPOSAL_EXPIRED',
      message: 'proposal has expired',
    });
  }
  if (input.proposal.requesterActorId !== input.expectedActorId) {
    return err({
      code: 'ACTOR_MISMATCH',
      message: 'proposal actor does not match the authenticated principal',
    });
  }
  if (!input.authenticationMeetsRequirement) {
    return err({
      code: 'AUTHENTICATION_INSUFFICIENT',
      message: 'authentication strength does not meet the proposal requirement',
    });
  }
  if (input.priorExecutionKey && input.priorExecutionKey !== input.proposal.idempotencyKey) {
    return err({
      code: 'IDEMPOTENCY_CONFLICT',
      message: 'idempotency key is bound to a different execution',
    });
  }
  const verified = input.issuer.verify(
    input.authority,
    {
      actionType: input.proposal.actionType,
      accountId: input.proposal.resources[0]?.id ?? input.proposal.proposalId,
      intentId: input.authority.intentId,
    },
    input.clock,
  );
  if (!isOk(verified)) {
    return err({
      code: 'AUTHORITY_REJECTED',
      message: verified.error.message,
    });
  }
  if (input.authority.idempotencyKey !== input.proposal.idempotencyKey) {
    return err({
      code: 'IDEMPOTENCY_CONFLICT',
      message: 'Execution Authority idempotency does not match the proposal',
    });
  }
  const mutated = mutate(verified.value);
  if (!mutated.ok) {
    return mutated;
  }
  return ok({ value: mutated.value, verified: verified.value });
}

export function rejectClientExecutionAuthority(): ExecutionGateFailure {
  return {
    code: 'CLIENT_PRIVILEGE_REJECTED',
    message: 'Execution Authority cannot be supplied by the client',
  };
}
