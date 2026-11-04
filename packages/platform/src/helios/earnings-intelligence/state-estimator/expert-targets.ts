/**
 * Default primary targets per earnings expert (one estimate semantics per expert).
 */

import type { EarningsEstimateTarget, EarningsExpertKind } from './taxonomy.ts';

export const DEFAULT_EXPERT_PRIMARY_TARGETS: Readonly<Record<EarningsExpertKind, readonly EarningsEstimateTarget[]>> =
  Object.freeze({
    StreetExpectationExpert: Object.freeze(['nextQuarterEps', 'nextQuarterRevenue']),
    FundamentalTrendExpert: Object.freeze(['nextQuarterEps', 'nextQuarterRevenue']),
    EarningsQualityExpert: Object.freeze(['earningsQualityRiskProbability']),
    TranscriptExpert: Object.freeze(['guidanceRaiseProbability', 'guidanceCutProbability']),
    OptionsExpert: Object.freeze(['beatProbability', 'revenueBeatProbability']),
    PeerReadThroughExpert: Object.freeze(['nextQuarterRevenue']),
    MacroExpert: Object.freeze(['marginExpansionProbability']),
    MarketReactionExpert: Object.freeze(['announcementReturn', 'postEventResidualReturn']),
  });
