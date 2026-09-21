/**
 * HELIOS Multi-Asset M27 — Grow Intelligence, Morning Brief, Evening Recap.
 * Structured facts precede natural-language generation. No Execution Authority.
 */

export const HELIOS_GROW_INTELLIGENCE_SCHEMA = 'sunrey.helios.grow-intelligence.v1' as const;

export const HELIOS_GROW_INTELLIGENCE_AUTHORITY = 'REFERENCE_ONLY' as const;

export const GROW_REPORT_TYPES = ['MORNING_BRIEF', 'EVENING_RECAP'] as const;

export type GrowReportType = (typeof GROW_REPORT_TYPES)[number];

export const GROW_NOTIFICATION_EVENT_TYPES = [
  'GROW_MORNING_BRIEF_AVAILABLE',
  'GROW_EVENING_RECAP_AVAILABLE',
  'GROW_MATERIAL_POSITION_OPENED',
  'GROW_MATERIAL_POSITION_CLOSED',
  'GROW_RISK_STATE_CHANGED',
  'GROW_PAUSED',
  'GROW_PROVIDER_DEGRADED',
  'GROW_RECONCILIATION_PROBLEM',
  'GROW_CUSTOMER_ACTION_REQUIRED',
] as const;

export type GrowNotificationEventType = (typeof GROW_NOTIFICATION_EVENT_TYPES)[number];

export const GROW_NOTIFICATION_CHANNELS = ['PUSH', 'EMAIL', 'SMS', 'IN_APP'] as const;

export type GrowNotificationChannel = (typeof GROW_NOTIFICATION_CHANNELS)[number];

export const GROW_NOTIFICATION_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export type GrowNotificationPriority = (typeof GROW_NOTIFICATION_PRIORITIES)[number];

export const GROW_SUMMARIZER_MODES = ['DETERMINISTIC', 'AI_ASSISTED'] as const;

export type GrowSummarizerMode = (typeof GROW_SUMMARIZER_MODES)[number];

export const GROW_EXECUTION_MODES = ['PAPER', 'SIMULATION_SANDBOX'] as const;

export type GrowExecutionMode = (typeof GROW_EXECUTION_MODES)[number];

export const GROW_REPORT_DISCLOSURE_FLAGS = [
  'PAPER_SIMULATION',
  'DEPOSITS_NOT_PERFORMANCE',
  'UNREALIZED_NOT_WITHDRAWABLE',
  'NO_GUARANTEED_OUTCOMES',
  'REJECTED_OPPORTUNITY_NOT_COUNTERFACTUAL',
  'PROVIDER_NEUTRAL_NOTIFICATIONS',
] as const;

export type GrowReportDisclosureFlag = (typeof GROW_REPORT_DISCLOSURE_FLAGS)[number];

export const HELIOS_MULTI_ASSET_M27 = 'HELIOS_MULTI_ASSET_M27' as const;

export const GROW_NOTIFICATION_PRIORITY_BY_TYPE: Readonly<
  Record<GrowNotificationEventType, GrowNotificationPriority>
> = Object.freeze({
  GROW_MORNING_BRIEF_AVAILABLE: 'NORMAL',
  GROW_EVENING_RECAP_AVAILABLE: 'NORMAL',
  GROW_MATERIAL_POSITION_OPENED: 'HIGH',
  GROW_MATERIAL_POSITION_CLOSED: 'HIGH',
  GROW_RISK_STATE_CHANGED: 'HIGH',
  GROW_PAUSED: 'URGENT',
  GROW_PROVIDER_DEGRADED: 'HIGH',
  GROW_RECONCILIATION_PROBLEM: 'URGENT',
  GROW_CUSTOMER_ACTION_REQUIRED: 'URGENT',
});
