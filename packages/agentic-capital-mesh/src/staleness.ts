import type { CapitalContext, CapitalProposal } from './types.ts';

export type StalenessInput = {
  readonly proposal: CapitalProposal;
  readonly current: CapitalContext;
};

export function isProposalStale(input: StalenessInput): boolean {
  const { proposal, current } = input;
  if (proposal.subjectId !== current.subjectId) {
    return true;
  }
  if (proposal.mandateId !== current.mandate.mandateId || proposal.mandateVersion !== current.mandate.version) {
    return true;
  }
  if (proposal.growthPlanId !== current.growth.planId) {
    return true;
  }
  if (proposal.riskBudgetVersion !== current.riskBudget.version) {
    return true;
  }
  if (proposal.portfolioRef !== current.portfolio.portfolioId) {
    return true;
  }
  if (current.portfolio.accountRestricted) {
    return true;
  }
  if (current.market.some((row) => row.stale)) {
    return true;
  }
  if (proposal.rdt.state !== current.rdt.state || proposal.rdt.legalReviewStatus !== current.rdt.legalReviewStatus) {
    return true;
  }
  if (proposal.marketSnapshotAt !== current.generatedAt && current.market.some((row) => row.quotedAt !== proposal.marketSnapshotAt)) {
    const proposalInstruments = new Set(proposal.compiled.quantities.map((qty) => qty.instrumentId));
    for (const price of current.market) {
      if (!proposalInstruments.has(price.instrumentId)) {
        continue;
      }
      if (price.quotedAt !== proposal.marketSnapshotAt) {
        return true;
      }
    }
  }
  const currentModels = new Set(current.registeredModels.map((ref) => `${ref.modelId}@${ref.version}`));
  for (const ref of proposal.modelRefs) {
    if (!currentModels.has(`${ref.modelId}@${ref.version}`)) {
      return true;
    }
  }
  return proposal.stale;
}

export function markStale(proposal: CapitalProposal): CapitalProposal {
  return Object.freeze({ ...proposal, stale: true, executable: false });
}
