/**
 * HELIOS EXEC13 — live execution connectivity resilience (simulation / qualification only).
 * Does not enable live trading or flip LIVE_* flags.
 */

export const HELIOS_EXEC13_SCHEMA = 'sunrey.helios.execution-connectivity.exec13.v1' as const;
export const EXEC13_POLICY_VERSION = 'helios-exec13-execution-resilience-v1' as const;

/** Canonical execution connectivity control states (server-authoritative). */
export const EXEC13_RESILIENCE_STATES = Object.freeze([
  'NORMAL',
  'PAUSE_NEW',
  'CANCEL_ONLY',
  'EXIT_ONLY',
  'BROKER_DEGRADED',
  'RECONCILIATION_REQUIRED',
  'FAILED_SAFE',
] as const);

export type Exec13ResilienceState = (typeof EXEC13_RESILIENCE_STATES)[number];

export const EXEC13_KILL_SWITCH_SCOPES = Object.freeze([
  'global',
  'provider',
  'account',
  'strategy',
  'instrument',
  'market',
  'customer',
] as const);

export type Exec13KillSwitchScope = (typeof EXEC13_KILL_SWITCH_SCOPES)[number];

/** Kill-switch engagement depth → connectivity state. */
export const EXEC13_KILL_SWITCH_STATE_BY_MODE = Object.freeze({
  BLOCK_NEW: 'PAUSE_NEW',
  CANCEL_ONLY: 'CANCEL_ONLY',
  EXIT_ONLY: 'EXIT_ONLY',
  BROKER_HALT: 'BROKER_DEGRADED',
  RECONCILE: 'RECONCILIATION_REQUIRED',
  FAIL_SAFE: 'FAILED_SAFE',
} as const);

export type Exec13KillSwitchMode = keyof typeof EXEC13_KILL_SWITCH_STATE_BY_MODE;

export const EXEC13_ORDER_ACTIONS = Object.freeze([
  'SUBMIT_NEW',
  'SUBMIT_REPLACE',
  'SUBMIT_CANCEL',
  'SUBMIT_EXIT',
  'RECONCILE_QUERY',
] as const);

export type Exec13OrderAction = (typeof EXEC13_ORDER_ACTIONS)[number];

export const EXEC13_CHAOS_SCENARIOS = Object.freeze([
  'submission_timeout',
  'ack_lost',
  'duplicate_ack',
  'duplicate_fill',
  'partial_fill_during_cancel',
  'fill_during_replace',
  'cancel_rejected',
  'replace_rejected',
  'out_of_order_execution_reports',
  'trade_correction',
  'trade_bust',
  'rest_outage',
  'fix_session_disconnect',
  'websocket_disconnect',
  'session_reset',
  'sequence_reset',
  'broker_unavailable',
  'custodian_unavailable',
  'market_data_unavailable',
  'risk_unavailable',
  'kernel_unavailable',
  'database_restart',
  'process_crash_after_broker_submit',
  'clock_drift',
  'network_partition',
] as const);

export type Exec13ChaosScenarioId = (typeof EXEC13_CHAOS_SCENARIOS)[number];

export const EXEC13_DEPENDENCY_PLANES = Object.freeze([
  'broker',
  'custodian',
  'market_data',
  'risk',
  'kernel',
  'database',
] as const);

export type Exec13DependencyPlane = (typeof EXEC13_DEPENDENCY_PLANES)[number];
