/**
 * HELIOS EARN11 — earnings strategy genome and event research lab taxonomy.
 * Research templates only; does not assert exploitable edge or grant execution authority.
 */

export const HELIOS_EARN11 = 'HELIOS_EARN11' as const;
export const EARN11_STRATEGY_GENOME_SCHEMA = 'sunrey.helios.earn11.strategy-genome.v1' as const;

export const EARN11_RESEARCH_TEMPLATE_FAMILIES = Object.freeze([
  'PRE_EARNINGS_EXPECTATION_DISLOCATION',
  'ANNOUNCEMENT_REACTION',
  'POST_EARNINGS_CONDITIONAL_DRIFT',
  'ANALYST_REVISION_MOMENTUM',
  'GUIDANCE_REVISION',
  'TRANSCRIPT_EXPECTATION_GAP',
  'OPTIONS_EXPECTATION_DISLOCATION',
  'PEER_READ_THROUGH',
  'EARNINGS_QUALITY_REVERSAL',
] as const);

export type Earn11ResearchTemplateFamily = (typeof EARN11_RESEARCH_TEMPLATE_FAMILIES)[number];

/** Declarative input tensors/features allowed on EARN11 genome candidates. */
export const EARN11_INPUT_NODE_KINDS = Object.freeze([
  'earnings_surprise_tensor',
  'revision_breadth',
  'revision_velocity',
  'dispersion',
  'value_of_information',
  'transcript_tone',
  'tone_dispersion',
  'future_past_focus',
  'answer_quality',
  'earnings_quality',
  'options_implied_move',
  'options_directional_demand',
  'peer_read_through',
  'attention_state',
  'macro_regime',
] as const);

export type Earn11InputNodeKind = (typeof EARN11_INPUT_NODE_KINDS)[number];

export const EARN11_MANDATORY_RESEARCH_ARTIFACTS = Object.freeze([
  'PIT_DATASET',
  'COVERAGE_CERTIFICATION',
  'BIAS_CERTIFICATION',
  'HOLDOUT',
  'WALK_FORWARD',
  'SHADOW',
  'PAPER',
] as const);

export type Earn11MandatoryResearchArtifact = (typeof EARN11_MANDATORY_RESEARCH_ARTIFACTS)[number];

export const EARN11_AAF_V2_REQUIRED = true as const;

export const HELIOS_EARN11_STRATEGY_RESEARCH_QUALIFIED =
  'HELIOS_EARN11_STRATEGY_RESEARCH_QUALIFIED' as const;

export const HELIOS_EARN11_STRATEGY_RESEARCH_BLOCKED = 'HELIOS_EARN11_STRATEGY_RESEARCH_BLOCKED' as const;
