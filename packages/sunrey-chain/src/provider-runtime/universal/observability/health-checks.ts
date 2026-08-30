/**
 * Health check evaluators for configuration, runtime, connectivity, and freshness.
 */

import type { ProviderRegistration } from '../types.ts';
import type { ProviderHealthRecord } from '../types.ts';
import type { HealthCheckKind, HealthCheckResult, ProviderHealthCheck } from './types.ts';

export type HealthCheckContext = {
  readonly registration: ProviderRegistration;
  readonly health: ProviderHealthRecord | null;
  readonly credentialRequired: boolean;
  readonly killSwitchActive: boolean;
  readonly dataLastUpdatedAt: string | null;
  readonly staleAfterMs: number;
  readonly nowUtc: string;
};

export function runHealthChecks(context: HealthCheckContext): readonly ProviderHealthCheck[] {
  return Object.freeze([
    evaluateConfigurationHealth(context),
    evaluateRuntimeHealth(context),
    evaluateConnectivityHealth(context),
    evaluateDataFreshnessHealth(context),
  ]);
}

export function evaluateConfigurationHealth(context: HealthCheckContext): ProviderHealthCheck {
  const { registration } = context;
  if (context.killSwitchActive) {
    return check('configuration', 'fail', 'provider is blocked by kill switch', context.nowUtc);
  }
  if (registration.lifecycleState === 'DISABLED' || registration.lifecycleState === 'SUSPENDED') {
    return check('configuration', 'fail', 'provider lifecycle is disabled', context.nowUtc);
  }
  if (context.credentialRequired && !registration.credentialReference) {
    return check('configuration', 'fail', 'required credential is not configured', context.nowUtc);
  }
  if (!registration.capabilities.length) {
    return check('configuration', 'fail', 'no capabilities declared', context.nowUtc);
  }
  return check('configuration', 'pass', 'adapter configuration is valid', context.nowUtc);
}

export function evaluateRuntimeHealth(context: HealthCheckContext): ProviderHealthCheck {
  const health = context.health;
  if (!health) {
    return check('runtime', 'warn', 'no runtime health observations yet', context.nowUtc);
  }
  if (health.circuitState === 'OPEN') {
    return check('runtime', 'fail', 'circuit breaker is open', context.nowUtc);
  }
  if (health.state === 'UNAVAILABLE' || health.state === 'MAINTENANCE') {
    return check('runtime', 'fail', `runtime health is ${health.state}`, context.nowUtc);
  }
  if (health.state === 'DEGRADED' || health.state === 'RATE_LIMITED') {
    return check('runtime', 'warn', `runtime health is ${health.state}`, context.nowUtc);
  }
  if (health.errorRate > 0.5) {
    return check('runtime', 'fail', 'error rate exceeds threshold', context.nowUtc);
  }
  return check('runtime', 'pass', 'runtime health is acceptable', context.nowUtc);
}

export function evaluateConnectivityHealth(context: HealthCheckContext): ProviderHealthCheck {
  const health = context.health;
  if (!health) {
    return check('connectivity', 'warn', 'connectivity not yet probed', context.nowUtc);
  }
  if (health.consecutiveFailures >= 3) {
    return check('connectivity', 'fail', 'provider connectivity failing repeatedly', context.nowUtc);
  }
  if (health.lastSuccessAt === null && health.lastFailureAt !== null) {
    return check('connectivity', 'fail', 'no successful request recorded', context.nowUtc);
  }
  if (health.rateLimited) {
    return check('connectivity', 'warn', 'provider is rate limited', context.nowUtc);
  }
  return check('connectivity', 'pass', 'provider connectivity is acceptable', context.nowUtc);
}

export function evaluateDataFreshnessHealth(context: HealthCheckContext): ProviderHealthCheck {
  if (!context.dataLastUpdatedAt) {
    return check('data_freshness', 'warn', 'no cached data timestamp available', context.nowUtc);
  }
  const ageMs = Date.parse(context.nowUtc) - Date.parse(context.dataLastUpdatedAt);
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return check('data_freshness', 'warn', 'data timestamp is invalid', context.nowUtc);
  }
  if (ageMs > context.staleAfterMs * 2) {
    return check('data_freshness', 'fail', 'cached data is expired', context.nowUtc);
  }
  if (ageMs > context.staleAfterMs) {
    return check('data_freshness', 'warn', 'cached data is stale', context.nowUtc);
  }
  return check('data_freshness', 'pass', 'data freshness is acceptable', context.nowUtc);
}

export function worstCheckResult(checks: readonly ProviderHealthCheck[]): HealthCheckResult {
  if (checks.some((row) => row.result === 'fail')) {
    return 'fail';
  }
  if (checks.some((row) => row.result === 'warn')) {
    return 'warn';
  }
  return 'pass';
}

export function credentialRequiredForCategory(category: string): boolean {
  return category === 'KYC' || category === 'KYB' || category === 'BANKING' || category === 'CUSTODY';
}

function check(
  kind: HealthCheckKind,
  result: HealthCheckResult,
  message: string,
  checkedAtUtc: string,
): ProviderHealthCheck {
  return Object.freeze({ kind, result, message, checkedAtUtc });
}
