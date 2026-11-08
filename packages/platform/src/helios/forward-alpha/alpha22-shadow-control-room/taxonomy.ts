/**
 * HELIOS Forward Alpha ALPHA22 — Shadow Lab control room, observability, and engineering SLOs.
 */

export const HELIOS_ALPHA22_SCHEMA = 'sunrey.helios.forward-alpha.alpha22-shadow-control-room.v1' as const;

export const HELIOS_ALPHA22_SHADOW_CONTROL_ROOM_QUALIFIED =
  'HELIOS_ALPHA22_SHADOW_CONTROL_ROOM_QUALIFIED' as const;
export const HELIOS_ALPHA22_SHADOW_CONTROL_ROOM_BLOCKED =
  'HELIOS_ALPHA22_SHADOW_CONTROL_ROOM_BLOCKED' as const;

export const SHADOW_LAB_RUNTIME_MODES = Object.freeze(['CONTINUOUS_RESEARCH', 'PAUSED', 'TERMINATED'] as const);
export type ShadowLabRuntimeMode = (typeof SHADOW_LAB_RUNTIME_MODES)[number];

export const SHADOW_CAMPAIGN_OPERATOR_STATUSES = Object.freeze([
  'ACTIVE',
  'PAUSED',
  'STOPPED',
  'TERMINATED',
  'LEASE_LOST',
] as const);
export type ShadowCampaignOperatorStatus = (typeof SHADOW_CAMPAIGN_OPERATOR_STATUSES)[number];

export const SHADOW_MARKET_DATA_STATES = Object.freeze(['TRUSTED', 'DEGRADED', 'UNTRUSTED', 'UNKNOWN'] as const);
export type ShadowMarketDataState = (typeof SHADOW_MARKET_DATA_STATES)[number];

export const SHADOW_HEALTH_BANDS = Object.freeze(['HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN'] as const);
export type ShadowHealthBand = (typeof SHADOW_HEALTH_BANDS)[number];

/** Engineering SLO dimensions — not investment performance SLOs. */
export const ALPHA22_ENGINEERING_SLO_IDS = Object.freeze([
  'CAMPAIGN_RUNTIME_AVAILABILITY',
  'DECISION_PROCESSING_FRESHNESS',
  'OUTCOME_ATTACHMENT_LATENCY',
  'EVIDENCE_PERSISTENCE',
  'MARKET_DATA_FRESHNESS',
  'RECOVERY_TIME',
] as const);
export type Alpha22EngineeringSloId = (typeof ALPHA22_ENGINEERING_SLO_IDS)[number];

export const ALPHA22_SHADOW_LAB_ALERT_KINDS = Object.freeze([
  'CAMPAIGN_STOPPED',
  'LEASE_LOST',
  'MARKET_DATA_UNTRUSTED',
  'OUTCOME_BACKLOG',
  'PERSISTENCE_FAILURE',
  'EVIDENCE_HASH_MISMATCH',
  'STRATEGY_DECAY',
  'DRAWDOWN_BREACH',
  'UNEXPECTED_DECISION_RATE_SPIKE',
  'PROVIDER_FAILURE',
] as const);
export type Alpha22ShadowLabAlertKind = (typeof ALPHA22_SHADOW_LAB_ALERT_KINDS)[number];

export const ALPHA22_OPERATOR_ACTIONS = Object.freeze([
  'PAUSE_CAMPAIGN',
  'RESUME_CAMPAIGN',
  'TERMINATE_CAMPAIGN',
  'PAUSE_STRATEGY',
  'FORCE_RECONCILIATION',
  'ACKNOWLEDGE_INCIDENT',
] as const);
export type Alpha22OperatorAction = (typeof ALPHA22_OPERATOR_ACTIONS)[number];

export const ALPHA22_FORBIDDEN_OPERATOR_EFFECTS = Object.freeze([
  'LIVE_FINANCIAL_EXECUTION',
  'EXECUTION_AUTHORITY_ISSUANCE',
  'LEDGER_JOURNAL_POST',
  'CUSTOMER_CAPITAL_MOVEMENT',
] as const);
