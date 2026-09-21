/**
 * HELIOS Multi-Asset M16 — opportunity ranking taxonomy.
 */

export const HELIOS_M16_OPPORTUNITY_RANKING_VERSION = 'HELIOS_M16_OPPORTUNITY_RANKING_V1' as const;
export const HELIOS_M16_OPPORTUNITY_RANKING_VERSION_V2 = 'HELIOS_M16_OPPORTUNITY_RANKING_V2' as const;

export type OpportunityRankingVersion =
  | typeof HELIOS_M16_OPPORTUNITY_RANKING_VERSION
  | typeof HELIOS_M16_OPPORTUNITY_RANKING_VERSION_V2;

export const OPPORTUNITY_OUTPUT_STATES = [
  'HIGH_PRIORITY_RESEARCH',
  'QUALIFIED_FOR_ALLOCATION_REVIEW',
  'WATCH',
  'WAIT',
  'REJECT',
  'INSUFFICIENT_EVIDENCE',
  'EXPIRED',
] as const;

export type OpportunityOutputState = (typeof OPPORTUNITY_OUTPUT_STATES)[number];

export const SCORECARD_FACTOR_IDS = [
  'strategyConfidence',
  'historicalQualification',
  'regimeCompatibility',
  'expectedReward',
  'expectedDownside',
  'realizedVolatility',
  'liquidity',
  'spread',
  'estimatedFees',
  'estimatedSlippage',
  'dataQuality',
  'evidenceQuality',
  'signalFreshness',
  'correlationExposure',
  'capitalRequirement',
  'providerAvailability',
  'executionReadiness',
  'timeToExpiry',
] as const;

export type ScorecardFactorId = (typeof SCORECARD_FACTOR_IDS)[number];

export type RankingWeights = Readonly<Record<ScorecardFactorId, number>>;

export const DEFAULT_M16_RANKING_WEIGHTS: RankingWeights = Object.freeze({
  strategyConfidence: 10,
  historicalQualification: 8,
  regimeCompatibility: 10,
  expectedReward: 12,
  expectedDownside: 8,
  realizedVolatility: 5,
  liquidity: 8,
  spread: 6,
  estimatedFees: 4,
  estimatedSlippage: 4,
  dataQuality: 8,
  evidenceQuality: 8,
  signalFreshness: 6,
  correlationExposure: 6,
  capitalRequirement: 4,
  providerAvailability: 5,
  executionReadiness: 5,
  timeToExpiry: 5,
});

/** V2 increases regime and evidence weights for reproducible version-change tests. */
export const M16_RANKING_WEIGHTS_V2: RankingWeights = Object.freeze({
  ...DEFAULT_M16_RANKING_WEIGHTS,
  regimeCompatibility: 14,
  evidenceQuality: 12,
  expectedReward: 8,
});

export function weightsForVersion(version: OpportunityRankingVersion): RankingWeights {
  if (version === HELIOS_M16_OPPORTUNITY_RANKING_VERSION_V2) {
    return M16_RANKING_WEIGHTS_V2;
  }
  return DEFAULT_M16_RANKING_WEIGHTS;
}
