/**
 * Research inspiration (reference only — no upstream code import):
 * "What Analysts Miss: Predicting Consensus Forecast Errors from Earnings Calls"
 */

export const EARN05_RESEARCH_INSPIRATION = Object.freeze({
  paperTitle: 'What Analysts Miss: Predicting Consensus Forecast Errors from Earnings Calls',
  usage: 'Probabilistic consensus-error feature weighting only; not a causal production model.',
} as const);

export const EARN05_PLATFORM_OWNER = Object.freeze({
  modulePath: 'packages/platform/src/helios/earnings-intelligence/transcript/',
  qualificationMarker: 'HELIOS_EARN05_TRANSCRIPT_INTELLIGENCE_QUALIFIED',
} as const);
