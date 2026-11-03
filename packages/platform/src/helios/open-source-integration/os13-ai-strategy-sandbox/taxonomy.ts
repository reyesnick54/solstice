export const HELIOS_OS13 = 'HELIOS_OPEN_SOURCE_INTEGRATION_OS13' as const;

export const PROPOSED_STRATEGY_GENOME_SCHEMA = 'sunrey.helios.os13.proposed-strategy-genome.v1' as const;

export const STRATEGY_PROPOSAL_SCHEMA = 'sunrey.helios.os13.strategy-proposal.v1' as const;

export const STRATEGY_PROPOSAL_EVIDENCE_KIND = 'HELIOS_OS13_STRATEGY_PROPOSAL' as const;

export const HELIOS_OS13_AI_STRATEGY_SANDBOX_QUALIFIED =
  'HELIOS_OS13_AI_STRATEGY_SANDBOX_QUALIFIED' as const;

export const HELIOS_OS13_AI_STRATEGY_SANDBOX_BLOCKED = 'HELIOS_OS13_AI_STRATEGY_SANDBOX_BLOCKED' as const;

/** Genome node kinds that must never appear in AI-authored strategy material. */
export const PROHIBITED_GENOME_NODE_OPS = Object.freeze([
  'SHELL_COMMAND',
  'NETWORK_ACCESS',
  'JAVASCRIPT_EVAL',
  'DIRECT_PROVIDER_CALL',
  'DIRECT_BROKER_CALL',
  'WALLET_ACCESS',
  'RISK_LIMIT_CHANGE',
  'LEVERAGE_OVERRIDE',
  'UNBOUNDED_LOOP',
  'ARBITRARY_CODE',
] as const);

export type ProhibitedGenomeNodeOp = (typeof PROHIBITED_GENOME_NODE_OPS)[number];

export const SANDBOX_PIPELINE_STAGES = Object.freeze([
  'PROPOSED',
  'SYNTAX_VALIDATED',
  'PROHIBITED_NODE_CHECKED',
  'INFORMATION_TIME_VALIDATED',
  'FEATURES_AVAILABLE',
  'CAPSULE_CANDIDATE',
  'HISTORICAL_EVALUATION',
  'HOLDOUT_EVALUATION',
  'FORWARD_SHADOW_RECOMMENDED',
  'PAPER_RECOMMENDED',
  'HUMAN_PROMOTION_REQUIRED',
] as const);

export type SandboxPipelineStage = (typeof SANDBOX_PIPELINE_STAGES)[number];
