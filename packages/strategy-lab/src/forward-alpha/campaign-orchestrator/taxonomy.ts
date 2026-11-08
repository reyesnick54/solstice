/**
 * HELIOS Forward Alpha ALPHA17 — autonomous forward campaign orchestrator taxonomy.
 */

export const HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_SCHEMA =
  'sunrey.helios.forward-alpha.campaign-orchestrator.v1' as const;

export const CAMPAIGN_RUN_STATES = Object.freeze([
  'REGISTERED',
  'WAITING_FOR_START',
  'RUNNING',
  'PAUSED',
  'DEGRADED',
  'RECOVERING',
  'COMPLETED',
  'FAILED_SAFE',
  'TERMINATED',
] as const);

export type CampaignRunState = (typeof CAMPAIGN_RUN_STATES)[number];

export const CAMPAIGN_LOOP_PHASES = Object.freeze([
  'OBSERVE',
  'BUILD_POINT_IN_TIME_STATE',
  'EVALUATE_STRATEGIES',
  'SEAL_DECISIONS',
  'PAPER_SHADOW_EXECUTION',
  'SCHEDULE_OUTCOME_OBSERVATION',
  'SCORE_MATURED_OUTCOMES',
  'UPDATE_EVIDENCE',
  'CHECK_DECAY',
  'CHECK_PROMOTION_DEMOTION',
] as const);

export type CampaignLoopPhase = (typeof CAMPAIGN_LOOP_PHASES)[number];

export const CAMPAIGN_TRIGGER_KINDS = Object.freeze([
  'EVENT_DRIVEN',
  'MARKET_SESSION',
  'SCHEDULED_EVALUATION',
  'OUTCOME_MATURITY',
] as const);

export type CampaignTriggerKind = (typeof CAMPAIGN_TRIGGER_KINDS)[number];

export const CAMPAIGN_WORK_ITEM_KINDS = Object.freeze([
  'RUN_LOOP',
  'SCORE_OUTCOMES',
  'RECOVER',
] as const);

export type CampaignWorkItemKind = (typeof CAMPAIGN_WORK_ITEM_KINDS)[number];

export const HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_QUALIFIED =
  'HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_QUALIFIED' as const;

export const HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_BLOCKED =
  'HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_BLOCKED' as const;
