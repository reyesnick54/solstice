/**
 * HELIOS Earnings Intelligence EARN09 — probabilistic state estimator taxonomy.
 * Research and expectation modeling only; not execution authority.
 */

export const HELIOS_EARNINGS_STATE_ESTIMATOR_SCHEMA =
  'sunrey.helios.earnings-intelligence.state-estimator.v1' as const;
export const HELIOS_EARNINGS_STATE_ESTIMATOR_AUTHORITY = 'RESEARCH_AND_EXPECTATION_MODELING' as const;

export const EARNINGS_EXPERT_KINDS = [
  'StreetExpectationExpert',
  'FundamentalTrendExpert',
  'EarningsQualityExpert',
  'TranscriptExpert',
  'OptionsExpert',
  'PeerReadThroughExpert',
  'MacroExpert',
  'MarketReactionExpert',
] as const;
export type EarningsExpertKind = (typeof EARNINGS_EXPERT_KINDS)[number];

export const EARNINGS_GATING_VARIABLES = [
  'sector',
  'marketCap',
  'liquidity',
  'earningsRegime',
  'macroRegime',
  'dataCoverage',
  'forecastDispersion',
  'optionsAvailability',
] as const;
export type EarningsGatingVariable = (typeof EARNINGS_GATING_VARIABLES)[number];

export const EARNINGS_ESTIMATE_TARGETS = [
  'nextQuarterEps',
  'nextQuarterRevenue',
  'beatProbability',
  'missProbability',
  'revenueBeatProbability',
  'guidanceRaiseProbability',
  'guidanceCutProbability',
  'marginExpansionProbability',
  'earningsQualityRiskProbability',
  'announcementReturn',
  'postEventResidualReturn',
] as const;
export type EarningsEstimateTarget = (typeof EARNINGS_ESTIMATE_TARGETS)[number];

export const EARNINGS_KNOWLEDGE_LAYERS = [
  'source_fact',
  'structured_observation',
  'model_inference',
  'agent_hypothesis',
] as const;
export type EarningsKnowledgeLayer = (typeof EARNINGS_KNOWLEDGE_LAYERS)[number];

export const HELIOS_EARN09_PROBABILISTIC_STATE_ESTIMATOR_QUALIFIED =
  'HELIOS_EARN09_PROBABILISTIC_STATE_ESTIMATOR_QUALIFIED' as const;
export const HELIOS_EARN09_PROBABILISTIC_STATE_ESTIMATOR_BLOCKED =
  'HELIOS_EARN09_PROBABILISTIC_STATE_ESTIMATOR_BLOCKED' as const;
