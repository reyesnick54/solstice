import { Money } from '../../../contracts/src/money.ts';
import type { AgentProposal } from '../../../contracts/src/proposal.ts';
import type { UtcInstant } from '../../../contracts/src/time.ts';
import type { AgentCapabilityToken } from '../capability/AgentCapabilityToken.ts';
import { CapabilityTokenIssuer } from '../capability/AgentCapabilityToken.ts';
import type { ComplianceKernel, KernelDecision } from '../kernel/ComplianceKernel.ts';
import { ActionType, type ActionIntent, type AgentProposalPayload } from '../kernel/ActionIntent.ts';
import type { DomainEventLog } from '../events/DomainEventLog.ts';
import { assertSimulationOnly } from '../flags/live.ts';

export type GateRejection = {
  readonly outcome: 'BLOCKED';
  readonly code:
    | 'TOKEN_SIGNATURE_INVALID'
    | 'TOKEN_REVOKED'
    | 'TOKEN_EXPIRED'
    | 'PROPOSAL_TYPE_NOT_ALLOWED'
    | 'FORBIDDEN_ACTION'
    | 'PER_TRANSACTION_LIMIT'
    | 'DAILY_LIMIT'
    | 'ACCOUNT_CLASS_NOT_ALLOWED';
  readonly reason: string;
};

export type GateResult = KernelDecision | GateRejection;

function dayKey(instant: UtcInstant): string {
  return instant.slice(0, 10);
}

/**
 * ProposalGate — infrastructure enforcement of the Agent Capability Token.
 *
 * A proposal is NOT an ActionIntent. This gate is the only conversion site.
 * Limits are never inferred from a prompt.
 */
export class ProposalGate {
  private readonly spentByDay = new Map<string, bigint>();
  readonly #tokens: CapabilityTokenIssuer;
  readonly #kernel: ComplianceKernel;
  readonly #events: DomainEventLog;

  constructor(
    tokens: CapabilityTokenIssuer,
    kernel: ComplianceKernel,
    events: DomainEventLog,
  ) {
    this.#tokens = tokens;
    this.#kernel = kernel;
    this.#events = events;
  }

  submitProposal(
    proposal: AgentProposal,
    token: AgentCapabilityToken,
    now: UtcInstant,
  ): GateResult {
    assertSimulationOnly();

    const verified = this.#tokens.verify(token, now);
    if (!verified.ok) {
      this.#events.append('agent.proposal.blocked_by_token', now, {
        proposalId: proposal.proposalId,
        code: verified.code,
      });
      return {
        outcome: 'BLOCKED',
        code: verified.code,
        reason:
          verified.code === 'TOKEN_REVOKED'
            ? 'capability token is revoked; all proposals are blocked'
            : verified.code === 'TOKEN_EXPIRED'
              ? 'capability token is expired; all proposals are blocked'
              : 'capability token signature is invalid',
      };
    }

    const claims = verified.claims;

    if (!claims.allowedProposalTypes.includes(proposal.actionType)) {
      this.#events.append('agent.proposal.blocked_by_token', now, {
        proposalId: proposal.proposalId,
        code: 'PROPOSAL_TYPE_NOT_ALLOWED',
      });
      return {
        outcome: 'BLOCKED',
        code: 'PROPOSAL_TYPE_NOT_ALLOWED',
        reason: `proposal type ${proposal.actionType} is not in the capability token allow-list`,
      };
    }

    if (claims.forbiddenActions.includes('CONSTRUCT_EXECUTION_AUTHORITY')) {
      // Structural: this gate never constructs an Authority either.
    }

    if (proposal.amount.cmp(claims.perTransactionLimit) > 0) {
      this.#events.append('agent.proposal.blocked_by_token', now, {
        proposalId: proposal.proposalId,
        code: 'PER_TRANSACTION_LIMIT',
      });
      return {
        outcome: 'BLOCKED',
        code: 'PER_TRANSACTION_LIMIT',
        reason: `amount ${proposal.amount.minorUnits.toString()} exceeds per-transaction limit ${claims.perTransactionLimit.minorUnits.toString()}`,
      };
    }

    const key = `${claims.tokenId}:${dayKey(now)}`;
    const already = this.spentByDay.get(key) ?? 0n;
    if (already + proposal.amount.minorUnits > claims.dailyLimit.minorUnits) {
      this.#events.append('agent.proposal.blocked_by_token', now, {
        proposalId: proposal.proposalId,
        code: 'DAILY_LIMIT',
      });
      return {
        outcome: 'BLOCKED',
        code: 'DAILY_LIMIT',
        reason: 'amount exceeds remaining daily capability-token limit',
      };
    }

    if (!claims.allowedAccountClasses.includes(proposal.targetAccountClass)) {
      this.#events.append('agent.proposal.blocked_by_token', now, {
        proposalId: proposal.proposalId,
        code: 'ACCOUNT_CLASS_NOT_ALLOWED',
      });
      return {
        outcome: 'BLOCKED',
        code: 'ACCOUNT_CLASS_NOT_ALLOWED',
        reason: `account class ${proposal.targetAccountClass} is not allowed by the capability token`,
      };
    }

    const intent: ActionIntent<AgentProposalPayload> = Object.freeze({
      actionType: ActionType.AGENT_PROPOSAL,
      payload: Object.freeze({
        proposal,
        tokenId: claims.tokenId,
      }),
      idempotencyKey: `prop_${proposal.proposalId}`,
      actorId: claims.agentId,
      origin: 'AGENT',
      requestedAt: now,
    });

    const decision = this.#kernel.submit(intent);
    if (decision.outcome === 'ALLOWED') {
      this.spentByDay.set(key, already + proposal.amount.minorUnits);
    }
    return decision;
  }
}

export function isGateRejection(result: GateResult): result is GateRejection {
  return result.outcome === 'BLOCKED';
}
