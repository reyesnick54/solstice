import type { EvidenceVault } from '@solstice/evidence';
import type { RankingRunResult } from './types.ts';

export function sealOpportunityRankingRun(
  vault: EvidenceVault | undefined,
  result: RankingRunResult,
): string | null {
  if (!vault) return null;
  vault.seal('HELIOS_M16_OPPORTUNITY_RANKING_RUN', {
    runId: result.runId,
    rankingVersion: result.rankingVersion,
    workOrderId: result.workOrderId,
    customerId: result.customerId,
    opportunityCount: result.opportunities.length,
    grantsExecutionAuthority: false,
    authorizesFinancialExecution: false,
    opportunities: result.opportunities.map((o) => ({
      opportunityId: o.opportunityId,
      rank: o.rank,
      outputState: o.outputState,
      compositeScore: o.scorecard.compositeScore,
      allocationReviewEligible: o.allocationReviewEligible,
      metaAllocatorHandoffEligible: o.metaAllocatorHandoffEligible,
      rankIsNotTradePermission: true,
    })),
  });
  return `ev_m16_rank_${result.runId}`;
}
