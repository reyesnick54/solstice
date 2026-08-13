import type { Money } from '../../../contracts/src/money.ts';
import type { AgentProposal } from '../../../contracts/src/proposal.ts';
import type { CompiledMandate } from '../../../contracts/src/mandate-types.ts';

/**
 * ActionIntent is the Kernel envelope. AgentProposal is a different type
 * and is not assignable to this interface without an explicit conversion
 * that exists only in the ProposalGate after token validation.
 */
export type ActionOrigin = 'HUMAN' | 'SYSTEM' | 'AGENT';

export const ActionType = {
  POST_DEPOSIT: 'POST_DEPOSIT',
  SET_MANDATE: 'SET_MANDATE',
  AGENT_PROPOSAL: 'AGENT_PROPOSAL',
} as const;

export type ActionTypeName = (typeof ActionType)[keyof typeof ActionType];

export interface ActionIntent<TPayload = unknown> {
  readonly actionType: ActionTypeName | string;
  readonly payload: TPayload;
  readonly idempotencyKey: string;
  readonly actorId: string;
  readonly origin: ActionOrigin;
  readonly requestedAt: string;
}

export type SetMandatePayload = {
  readonly mandate: CompiledMandate;
};

export type AgentProposalPayload = {
  readonly proposal: AgentProposal;
  readonly tokenId: string;
};

export type PostDepositPayload = {
  readonly customerAccountId: string;
  readonly amount: Money;
};
