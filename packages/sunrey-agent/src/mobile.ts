import type { AgentApprovalClass } from './taxonomy.ts';
import type { AgentTransactionProposal, SigningIntentSummary, UserAgentMandate } from './types.ts';

/**
 * Chunk 97 mobile-approval adapter. The notification carries a
 * SigningIntent / AgentProposal summary. This is not a second wallet
 * authority.
 */
export function signingIntentSummary(
  mandate: UserAgentMandate,
  proposal: AgentTransactionProposal,
  approvalClass: AgentApprovalClass,
): SigningIntentSummary {
  return Object.freeze({
    title: 'Agent proposal requires human confirmation',
    agentId: mandate.agentId,
    mandateId: mandate.mandateId,
    action: proposal.intent,
    assetId: proposal.assetId,
    quantity: proposal.quantity.toString(),
    destinationOrMarket: proposal.destinationOrMarket,
    fees: proposal.fees.toString(),
    approvalClass,
    proposalHash: proposal.proposalHash,
  });
}

export function replayedApproval(nonce: string, used: ReadonlySet<string>): boolean {
  return used.has(nonce);
}
