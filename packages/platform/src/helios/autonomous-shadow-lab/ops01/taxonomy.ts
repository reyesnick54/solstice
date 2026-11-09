/**
 * HELIOS OPS01 — durable autonomous shadow lab runtime.
 */

export const HELIOS_DURABLE_SHADOW_LAB_RUNTIME_SCHEMA = 'helios.durable-shadow-lab-runtime.v1' as const;

export const HELIOS_DURABLE_SHADOW_LAB_RUNTIME_V1_QUALIFIED =
  'HELIOS_DURABLE_SHADOW_LAB_RUNTIME_V1_QUALIFIED' as const;

export const HELIOS_DURABLE_SHADOW_LAB_RUNTIME_V1_BLOCKED =
  'HELIOS_DURABLE_SHADOW_LAB_RUNTIME_V1_BLOCKED' as const;

export const SHADOW_LAB_RUNTIME_EVENT_DECISION_SEALED =
  'helios.shadow_lab.decision_sealed.v1' as const;

export const SHADOW_LAB_RUNTIME_EVENT_OUTCOME_MATURED =
  'helios.shadow_lab.outcome_matured.v1' as const;

export const DEFAULT_CAMPAIGN_LEASE_MS = 30_000;

export const SHADOW_LAB_RESTART_CRASH_POINTS = Object.freeze([
  'AFTER_DECISION_GENERATED',
  'AFTER_DECISION_PERSISTED',
  'AFTER_PAPER_EXECUTION',
  'AFTER_OUTCOME_MATURATION',
] as const);

export type ShadowLabRestartCrashPoint = (typeof SHADOW_LAB_RESTART_CRASH_POINTS)[number];
