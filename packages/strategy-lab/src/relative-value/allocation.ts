/**
 * HELIOS M12 — capital allocation hooks.
 * Declares recommended leg weights only; Meta Allocator retains sizing authority.
 */

import type { M12StrategyLeg, M12StrategyProposal } from './types.ts';
import type { M12StrategyParameters } from './parameters.ts';

export type M12AllocationRecommendation = {
  readonly pairProposalId: string;
  readonly totalRecommendedExposureBps: number;
  readonly legs: readonly M12StrategyLeg[];
  readonly sizingAuthority: 'EXTERNAL_META_ALLOCATOR';
  readonly leveragePermitted: false;
};

export function recommendPairAllocation(input: {
  readonly proposal: M12StrategyProposal;
  readonly params: M12StrategyParameters;
}): M12AllocationRecommendation {
  const magnitude = input.proposal.spreadZScoreScaled
    ? Number(input.proposal.spreadZScoreScaled < 0n ? -input.proposal.spreadZScoreScaled : input.proposal.spreadZScoreScaled)
    : 0;
  const scaled = Math.min(input.params.maxRecommendedExposureBps, Math.floor(magnitude * 5));
  const total = Math.max(0, scaled);

  return Object.freeze({
    pairProposalId: input.proposal.proposalId,
    totalRecommendedExposureBps: total,
    legs: input.proposal.legs,
    sizingAuthority: 'EXTERNAL_META_ALLOCATOR',
    leveragePermitted: false,
  });
}
