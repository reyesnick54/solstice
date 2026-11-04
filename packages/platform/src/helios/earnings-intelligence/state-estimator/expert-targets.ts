/**
 * Default primary targets per earnings expert (one estimate semantics per expert).
 */

import type { EarningsEstimateTarget, EarningsExpertKind } from './taxonomy.ts';

function targets<T extends readonly EarningsEstimateTarget[]>(values: T): T {
  return Object.freeze(values);
}

export const DEFAULT_EXPERT_PRIMARY_TARGETS: Readonly<Record<EarningsExpertKind, readonly EarningsEstimateTarget[]>> =
  Object.freeze({
    StreetExpectationExpert: targets(['nextQuarterEps', 'nextQuarterRevenue']),
    FundamentalTrendExpert: targets(['nextQuarterEps', 'nextQuarterRevenue']),
    EarningsQualityExpert: targets(['earningsQualityRiskProbability']),
    TranscriptExpert: targets(['guidanceRaiseProbability', 'guidanceCutProbability']),
    OptionsExpert: targets(['beatProbability', 'revenueBeatProbability']),
    PeerReadThroughExpert: targets(['nextQuarterRevenue']),
    MacroExpert: targets(['marginExpansionProbability']),
    MarketReactionExpert: targets(['announcementReturn', 'postEventResidualReturn']),
  });
