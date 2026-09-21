/**
 * HELIOS Multi-Asset M25 — continuous autonomous runtime taxonomy.
 * Governed automation only; no unrestricted financial authority.
 */

export const HELIOS_RUNTIME_STATES = [
  'ACTIVE',
  'IDLE',
  'WAITING_FOR_DATA',
  'WAITING_FOR_MARKET',
  'WAITING_FOR_AUTHORIZATION',
  'PAUSED',
  'RISK_BLOCKED',
  'COMPLIANCE_BLOCKED',
  'PROVIDER_BLOCKED',
  'RECONCILIATION_REQUIRED',
  'DEGRADED',
  'FAILED_SAFE',
] as const;

export type HeliosRuntimeState = (typeof HELIOS_RUNTIME_STATES)[number];

export const HELIOS_CYCLE_STAGES = [
  'OBSERVE',
  'DETECT',
  'RESEARCH',
  'CHALLENGE',
  'QUALIFY',
  'RANK',
  'ALLOCATE',
  'RISK',
  'COMPLIANCE',
  'AUTHORIZE',
  'PAPER_EXECUTE',
  'MONITOR',
  'EXIT',
  'SETTLE',
  'RECONCILE',
  'ATTRIBUTE',
  'LEARN',
] as const;

export type HeliosCycleStage = (typeof HELIOS_CYCLE_STAGES)[number];

export const HELIOS_RUNTIME_QUEUE_KINDS = [
  'MARKET_OBSERVATION',
  'STRATEGY_EVALUATION',
  'RECONCILIATION',
  'RISK_EVALUATION',
  'CYCLE_TICK',
] as const;

export type HeliosRuntimeQueueKind = (typeof HELIOS_RUNTIME_QUEUE_KINDS)[number];

export const HELIOS_RUNTIME_CADENCE_PROFILES = [
  'CONTINUOUS_CRYPTO',
  'EQUITY_SESSION',
  'FUTURES_SESSION',
  'RECONCILIATION_PERIODIC',
  'RISK_PERIODIC',
] as const;

export type HeliosRuntimeCadenceProfile = (typeof HELIOS_RUNTIME_CADENCE_PROFILES)[number];

export const HELIOS_SUPERVISION_SCOPES = [
  'GLOBAL',
  'CUSTOMER',
  'STRATEGY',
  'INSTRUMENT',
  'ASSET_CLASS',
  'PROVIDER',
] as const;

export type HeliosSupervisionScope = (typeof HELIOS_SUPERVISION_SCOPES)[number];

export const HELIOS_SUPERVISION_MODES = [
  'NORMAL',
  'PAUSED',
  'EXIT_ONLY',
  'DRAINING',
  'SHUTDOWN',
] as const;

export type HeliosSupervisionMode = (typeof HELIOS_SUPERVISION_MODES)[number];

export const HELIOS_SCHEDULED_WORK_STATES = [
  'PENDING',
  'CLAIMED',
  'COMPLETED',
  'CANCELLED',
  'DUPLICATE_SKIPPED',
] as const;

export type HeliosScheduledWorkState = (typeof HELIOS_SCHEDULED_WORK_STATES)[number];

export const HELIOS_CYCLE_OUTCOMES = [
  'NO_ACTION',
  'PAPER_TRADE',
  'EXIT_ONLY',
  'BLOCKED',
  'DEFERRED',
] as const;

export type HeliosCycleOutcome = (typeof HELIOS_CYCLE_OUTCOMES)[number];
