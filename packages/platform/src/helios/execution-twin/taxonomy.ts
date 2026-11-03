/**
 * HELIOS OS02 — deterministic execution twin environments and event taxonomy.
 * Research/live parity: same capsule and plan contracts; provider realization differs.
 */

export const HELIOS_OS02_EXECUTION_TWIN = 'HELIOS_OS02_EXECUTION_TWIN' as const;

/** Canonical twin environments. LIVE remains disabled at runtime gates. */
export const EXECUTION_TWIN_ENVIRONMENTS = [
  'HISTORICAL_REPLAY',
  'SHADOW',
  'PAPER',
  'SANDBOX_LIVE_DATA',
  'LIVE',
] as const;

export type ExecutionTwinEnvironmentKind = (typeof EXECUTION_TWIN_ENVIRONMENTS)[number];

/** Aliases used in economic evaluation and release docs. */
export const EXECUTION_TWIN_ENVIRONMENT_ALIASES = Object.freeze({
  FORWARD_SHADOW: 'SHADOW',
  LIVE_DATA_SIMULATED_EXECUTION: 'SANDBOX_LIVE_DATA',
  EVENTUAL_LIVE: 'LIVE',
} as const);

export const EXECUTION_TWIN_PROVIDER_KINDS = [
  'HistoricalProvider',
  'PaperProvider',
  'SandboxProvider',
  'ShadowProvider',
  'LiveProvider',
] as const;

export type ExecutionTwinProviderKind = (typeof EXECUTION_TWIN_PROVIDER_KINDS)[number];

export const EXECUTION_TWIN_RUN_STATES = [
  'PENDING',
  'RUNNING',
  'PAUSED',
  'COMPLETED',
  'FAILED',
  'ABORTED',
] as const;

export type ExecutionTwinRunState = (typeof EXECUTION_TWIN_RUN_STATES)[number];

export const EXECUTION_TWIN_EVENT_KINDS = [
  'RUN_STARTED',
  'CLOCK_TICK',
  'FEATURE_SNAPSHOT',
  'MANDATE_CHECK',
  'RISK_CHECK',
  'COMPLIANCE_CHECK',
  'EXECUTION_AUTHORITY_CHECK',
  'TACTIC_PLANNED',
  'ROUTE_SELECTED',
  'ORDER_SUBMITTED',
  'ORDER_STATE_TRANSITION',
  'SETTLEMENT_RECORDED',
  'RECONCILIATION_RECORDED',
  'CHECKPOINT',
  'RUN_COMPLETED',
  'RUN_FAILED',
] as const;

export type ExecutionTwinEventKind = (typeof EXECUTION_TWIN_EVENT_KINDS)[number];

export const EXECUTION_TWIN_ORDER_STATES = [
  'NONE',
  'PLANNED',
  'ROUTED',
  'SUBMITTED',
  'ACKNOWLEDGED',
  'PARTIAL',
  'FILLED',
  'REJECTED',
  'CANCELLED',
] as const;

export type ExecutionTwinOrderState = (typeof EXECUTION_TWIN_ORDER_STATES)[number];

export const EXECUTION_TWIN_ASSUMPTION_CATEGORIES = [
  'MARKET_DATA',
  'FILL_MODEL',
  'LATENCY',
  'FEES',
  'SETTLEMENT',
  'PROVIDER_POSTURE',
  'RANDOMNESS',
] as const;

export type ExecutionTwinAssumptionCategory = (typeof EXECUTION_TWIN_ASSUMPTION_CATEGORIES)[number];

export function resolveExecutionTwinEnvironment(
  value: string,
): ExecutionTwinEnvironmentKind | null {
  const normalized = value.trim().toUpperCase();
  const alias = (EXECUTION_TWIN_ENVIRONMENT_ALIASES as Record<string, ExecutionTwinEnvironmentKind>)[normalized];
  if (alias) {
    return alias;
  }
  if ((EXECUTION_TWIN_ENVIRONMENTS as readonly string[]).includes(normalized)) {
    return normalized as ExecutionTwinEnvironmentKind;
  }
  return null;
}

export function defaultProviderKindForEnvironment(
  environment: ExecutionTwinEnvironmentKind,
): ExecutionTwinProviderKind {
  switch (environment) {
    case 'HISTORICAL_REPLAY':
      return 'HistoricalProvider';
    case 'SHADOW':
      return 'ShadowProvider';
    case 'PAPER':
      return 'PaperProvider';
    case 'SANDBOX_LIVE_DATA':
      return 'SandboxProvider';
    case 'LIVE':
      return 'LiveProvider';
  }
}

export function environmentPermitsProviderSubmit(environment: ExecutionTwinEnvironmentKind): boolean {
  return environment !== 'SHADOW' && environment !== 'LIVE';
}
