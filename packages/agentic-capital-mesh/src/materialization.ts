import { err, ok, type Result } from '../../domain/src/result.ts';
import type { ModelRegistry } from '../../model-registry/src/registry.ts';
import type { CapitalContext, CapitalProposal, StrategyDraft } from './types.ts';
import { isProposalStale } from './staleness.ts';

export type MaterializationFailure = {
  readonly code:
    | 'PROPOSAL_STALE'
    | 'RISK_STALE'
    | 'MANDATE_CHANGED'
    | 'MODEL_RETIRED'
    | 'MARKET_STALE'
    | 'STRATEGY_VALIDATION_REQUIRED'
    | 'NOT_A_PAPER_ORDER';
  readonly message: string;
};

/**
 * Controlled bridge: CapitalProposal → StrategyDraft candidate.
 * Does not create a paper order. Chunk 22R owns strategy validation.
 */
export function materializeStrategyDraft(input: {
  readonly proposal: CapitalProposal;
  readonly current: CapitalContext;
  readonly registry: ModelRegistry;
  readonly riskStale?: boolean;
}): Result<StrategyDraft, MaterializationFailure> {
  if (input.proposal.stale || isProposalStale({ proposal: input.proposal, current: input.current })) {
    return err({ code: 'PROPOSAL_STALE', message: 'stale proposal cannot materialize' });
  }
  if (input.riskStale === true) {
    return err({ code: 'RISK_STALE', message: 'stale Risk assessment cannot materialize' });
  }
  if (
    input.proposal.mandateId !== input.current.mandate.mandateId ||
    input.proposal.mandateVersion !== input.current.mandate.version
  ) {
    return err({ code: 'MANDATE_CHANGED', message: 'mandate changed; proposal cannot materialize' });
  }
  for (const ref of input.proposal.modelRefs) {
    const model = input.registry.get(ref.modelId, ref.version);
    if (!model || model.lifecycle === 'RETIRED') {
      return err({ code: 'MODEL_RETIRED', message: 'retired or missing model cannot materialize' });
    }
  }
  if (input.current.market.some((row) => row.stale)) {
    return err({ code: 'MARKET_STALE', message: 'stale market-data snapshot cannot materialize' });
  }
  if (input.proposal.confirmations.strategyValidationRequired || input.proposal.strategyValidation !== 'UNVALIDATED') {
    return err({
      code: 'STRATEGY_VALIDATION_REQUIRED',
      message: 'Strategy Lab validation is required; Mesh cannot create a paper order',
    });
  }
  return ok(
    Object.freeze({
      draftId: `sdraft_${input.proposal.proposalId}`,
      proposalId: input.proposal.proposalId,
      subjectId: input.proposal.subjectId,
      allocation: input.proposal.proposedAllocation,
      compiled: input.proposal.compiled,
      paperOrderCreated: false,
      requiresStrategyLab: true,
    }),
  );
}

export function refusePaperOrderFromMesh(): Result<never, MaterializationFailure> {
  return err({
    code: 'NOT_A_PAPER_ORDER',
    message: 'Agentic Capital Mesh cannot submit a paper order or broker instruction',
  });
}
