import type { AgentExplanation, AgentTransactionProposal, UserAgentMandate } from './types.ts';

export function explainProposal(mandate: UserAgentMandate, proposal: AgentTransactionProposal): AgentExplanation {
  return Object.freeze({
    proposalId: proposal.proposalId,
    what: `${proposal.intent} of ${proposal.quantity.toString()} ${proposal.assetId} toward ${proposal.destinationOrMarket}`,
    why: `${proposal.reasonCode}${proposal.strategyRef ? ` under strategy ${proposal.strategyRef}` : ''}. ${proposal.operationalRationale}`,
    amountAtRisk: proposal.quantity.toString(),
    fees: proposal.fees.toString(),
    applicableLimits: Object.freeze([
      `perTransaction=${mandate.budget.perTransaction.toString()}`,
      `perPeriod=${mandate.budget.perPeriod.toString()}`,
      `frequencyMax=${String(mandate.policy.frequencyMaxPerPeriod)}`,
      `expiry=${mandate.policy.expiry}`,
    ]),
    requiredApproval: mandate.policy.approval.class,
    certainty: 'NONE_FABRICATED',
  });
}
