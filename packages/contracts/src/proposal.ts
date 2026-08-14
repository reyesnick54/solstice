import type { Money } from './money.ts';
import type { ProductAccountClass } from './account-class.ts';
import type { AgentId, CustomerId, MandateClauseId, ProposalId } from './ids.ts';
import type { ReasonCode, ProposalActionType } from './proposal-types.ts';
import type { RecordedFactor } from './recorded-factor.ts';
import type { UtcInstant } from './time.ts';

/**
 * Typed proposal emitted by the Personal Economy Agent.
 *
 * This type is deliberately disjoint from ActionIntent:
 * - no actor execution fields
 * - no ExecutionAuthority
 * - no ledger journal fields
 * - no toIntent / toAuthority method
 *
 * A proposal cannot become an ActionIntent except by passing capability
 * token validation in the control-plane ProposalGate.
 */
export type AgentProposal = {
  readonly proposalId: ProposalId;
  readonly agentId: AgentId;
  readonly customerId: CustomerId;
  readonly actionType: ProposalActionType;
  readonly amount: Money;
  readonly targetAccountClass: ProductAccountClass;
  readonly reasonCode: ReasonCode;
  readonly mandateClauseId: MandateClauseId;
  readonly recordedFactors: readonly RecordedFactor[];
  readonly sourceAccountId: string | null;
  readonly targetAccountId: string | null;
  readonly requiresDepositInvestmentAgreement: boolean;
  readonly emittedAt: UtcInstant;
};

export type AgentProposalHasNoAuthority =
  Extract<
    keyof AgentProposal,
    'executionAuthority' | 'authority' | 'toIntent' | 'toAuthority' | 'ledger'
  > extends never
    ? true
    : false;
