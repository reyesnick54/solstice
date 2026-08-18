import { asIntentId, type ActionIntent } from '../../permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import { contentHash, executionRequestIdFor } from './ids.ts';
import { approvalSatisfied } from './policy.ts';
import type {
  AgentExecutionRequest,
  AgentTransactionProposal,
  KernelPortDecision,
  MandateRefusal,
  UserAgentMandate,
} from './types.ts';

export type KernelSubmitPort = {
  submit(intent: ActionIntent, facts: { readonly actor: { readonly id: string; readonly capabilities: readonly string[] } }): KernelPortDecision;
};

/**
 * ProposalGate converts a verified, mandate-bound agent proposal into a
 * canonical ActionIntent. An AgentProposal is never itself an ActionIntent.
 * The gate does not issue Execution Authority.
 */
export class ProposalGate {
  private readonly kernel: KernelSubmitPort | null;

  constructor(kernel: KernelSubmitPort | null) {
    this.kernel = kernel;
  }

  buildExecutionRequest(input: {
    readonly proposal: AgentTransactionProposal;
    readonly mandate: UserAgentMandate;
    readonly walletPolicyHash: string;
    readonly kernelStateHash: string;
    readonly marketRestrictionHash: string;
    readonly now: AgentExecutionRequest['createdAt'];
  }): AgentExecutionRequest {
    return Object.freeze({
      requestId: executionRequestIdFor(input.proposal.proposalHash, input.mandate.mandateHash),
      proposalHash: input.proposal.proposalHash,
      mandateHash: input.mandate.mandateHash,
      walletPolicyHash: input.walletPolicyHash,
      kernelStateHash: input.kernelStateHash,
      marketRestrictionHash: input.marketRestrictionHash,
      transactionContentHash: contentHash({
        intent: input.proposal.intent,
        assetId: input.proposal.assetId,
        quantity: input.proposal.quantity.toString(),
        destinationOrMarket: input.proposal.destinationOrMarket,
        fees: input.proposal.fees.toString(),
      }),
      createdAt: input.now,
    });
  }

  toActionIntent(input: {
    readonly proposal: AgentTransactionProposal;
    readonly mandate: UserAgentMandate;
    readonly humanApproved: boolean;
    readonly actorId: string;
  }): { readonly ok: true; readonly intent: ActionIntent } | MandateRefusal {
    const approval = approvalSatisfied({
      mandate: input.mandate,
      proposal: input.proposal,
      humanApproved: input.humanApproved,
    });
    if (!approval.ok) {
      return approval;
    }
    if (input.mandate.policy.mode === 'SIMULATION_ONLY') {
      return { ok: false, code: 'SIMULATION_CANNOT_SUBMIT', detail: 'SIMULATION_ONLY mandates can never submit real transactions' };
    }
    const actionType =
      input.proposal.intent === 'EXECUTE_BOUNDED_EXCHANGE_ORDER'
        ? ACTION_TYPES.PLACE_EXCHANGE_ORDER
        : input.proposal.intent === 'EXECUTE_PREAPPROVED_PAYMENT'
          ? ACTION_TYPES.INITIATE_PAYMENT
          : ACTION_TYPES.TRANSFER_SUNREY_COIN;
    const intent: ActionIntent = Object.freeze({
      id: asIntentId(`agi_${input.proposal.proposalHash.slice(0, 24)}`),
      actionType,
      payload: Object.freeze({
        accountId: input.mandate.owner.accountId,
        mandateId: input.mandate.mandateId,
        proposalHash: input.proposal.proposalHash,
        quantity: input.proposal.quantity.toString(),
        assetId: input.proposal.assetId,
      }),
      idempotencyKey: input.proposal.proposalHash,
      actorId: input.actorId,
      requestedAt: input.proposal.createdAt,
      purpose: 'CUSTOMER_DIGITAL_ASSET',
    });
    return { ok: true, intent };
  }

  submitToKernel(input: {
    readonly proposal: AgentTransactionProposal;
    readonly mandate: UserAgentMandate;
    readonly humanApproved: boolean;
    readonly actorId: string;
  }): { readonly ok: true; readonly decision: KernelPortDecision } | MandateRefusal {
    const built = this.toActionIntent(input);
    if (!built.ok) {
      return built;
    }
    if (!this.kernel) {
      return { ok: false, code: 'COMPLIANCE_REFUSED', detail: 'Compliance Kernel port is required; automation never bypasses the Kernel' };
    }
    const decision = this.kernel.submit(built.intent, {
      actor: { id: input.actorId, capabilities: ['agent-mandate-owner'] },
    });
    if (decision.status !== 'ALLOW') {
      return { ok: false, code: 'COMPLIANCE_REFUSED', detail: `kernel returned ${decision.status}` };
    }
    return { ok: true, decision };
  }
}
