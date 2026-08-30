/**
 * Wave 1 Prompt 7 — canonical provider observability types.
 * Extends universal provider runtime. Not a second observability stack.
 */

import type { CircuitState, ProviderCategory, ProviderEnvironment, ProviderHealthState } from '../types.ts';

export const CANONICAL_PROVIDER_HEALTH_STATES = [
  'healthy',
  'degraded',
  'unhealthy',
  'disabled',
  'blocked',
  'unknown',
] as const;
export type CanonicalProviderHealth = (typeof CANONICAL_PROVIDER_HEALTH_STATES)[number];

export const HEALTH_CHECK_KINDS = [
  'configuration',
  'runtime',
  'connectivity',
  'data_freshness',
] as const;
export type HealthCheckKind = (typeof HEALTH_CHECK_KINDS)[number];

export const HEALTH_CHECK_RESULTS = ['pass', 'warn', 'fail'] as const;
export type HealthCheckResult = (typeof HEALTH_CHECK_RESULTS)[number];

export const DOMAIN_DEGRADATION_LEVELS = [
  'NORMAL',
  'DEGRADED',
  'STALE_DATA',
  'UNAVAILABLE',
] as const;
export type DomainDegradationLevel = (typeof DOMAIN_DEGRADATION_LEVELS)[number];

export const DEPLOYMENT_TIERS = ['test', 'development', 'preview', 'production'] as const;
export type DeploymentTier = (typeof DEPLOYMENT_TIERS)[number];

export const LAUNCH_TIERS = ['DISABLED', 'SANDBOX', 'PREVIEW', 'PRODUCTION_BLOCKED', 'PRODUCTION'] as const;
export type LaunchTier = (typeof LAUNCH_TIERS)[number];

export const PROVIDER_METRIC_NAMES = [
  'provider_requests_total',
  'provider_request_duration_seconds',
  'provider_errors_total',
  'provider_retries_total',
  'provider_rate_limit_events_total',
  'provider_timeout_total',
  'provider_circuit_open',
  'provider_circuit_open_total',
  'provider_cache_hits_total',
  'provider_cache_misses_total',
  'provider_cache_stale_served_total',
  'provider_refresh_success_total',
  'provider_refresh_failure_total',
  'provider_data_invalid_total',
  'provider_data_stale_total',
] as const;
export type ProviderMetricName = (typeof PROVIDER_METRIC_NAMES)[number];

export const PROVIDER_METRIC_LABEL_KEYS = [
  'provider_id',
  'category',
  'capability',
  'environment',
  'result',
  'error_class',
] as const;
export type ProviderMetricLabelKey = (typeof PROVIDER_METRIC_LABEL_KEYS)[number];

export type ProviderHealthCheck = {
  readonly kind: HealthCheckKind;
  readonly result: HealthCheckResult;
  readonly message: string;
  readonly checkedAtUtc: string;
};

export type ProviderLatencySummary = {
  readonly p50Ms: number | null;
  readonly p95Ms: number | null;
  readonly lastMs: number | null;
  readonly sampleCount: number;
};

export type ProviderCacheFreshness = {
  readonly lastRefreshedAt: string | null;
  readonly staleAfterMs: number;
  readonly isStale: boolean;
  readonly cacheState: 'hit' | 'miss' | 'stale_served' | 'none';
};

export type ProviderCredentialReadiness = {
  readonly credentialRequired: boolean;
  readonly credentialConfigured: boolean;
  readonly verificationStatus: 'verified' | 'unverified' | 'not_required';
};

export type ProviderStatusRecord = {
  readonly providerId: string;
  readonly displayName: string;
  readonly category: ProviderCategory;
  readonly enabled: boolean;
  readonly health: CanonicalProviderHealth;
  readonly circuitState: CircuitState;
  readonly lastSuccessAt: string | null;
  readonly lastErrorAt: string | null;
  readonly lastErrorCode: string | null;
  readonly latency: ProviderLatencySummary;
  readonly cacheFreshness: ProviderCacheFreshness;
  readonly credential: ProviderCredentialReadiness;
  readonly launchTier: LaunchTier;
  readonly environment: ProviderEnvironment;
  readonly checks: readonly ProviderHealthCheck[];
  readonly secretValuesPresent: false;
};

export type ExternalProvidersAggregate = {
  readonly total: number;
  readonly enabled: number;
  readonly healthy: number;
  readonly degraded: number;
  readonly unhealthy: number;
  readonly blocked: number;
  readonly disabled: number;
  readonly unknown: number;
};

export type DomainDependencyStatus = {
  readonly domain: string;
  readonly label: string;
  readonly healthy: number;
  readonly total: number;
  readonly degradation: DomainDegradationLevel;
};

export type ProviderAlertCondition = {
  readonly alertId: string;
  readonly providerId: string;
  readonly kind:
    | 'provider_unavailable'
    | 'circuit_open'
    | 'error_rate'
    | 'refresh_failure'
    | 'cache_expired'
    | 'auth_failure'
    | 'rate_limit_exhausted';
  readonly severity: 'warning' | 'critical';
  readonly message: string;
  readonly firedAtUtc: string;
  readonly transient: boolean;
};

export type ProviderStructuredLog = {
  readonly providerId: string;
  readonly capability: string;
  readonly requestId: string;
  readonly statusCode: number | null;
  readonly durationMs: number;
  readonly retryCount: number;
  readonly circuitState: CircuitState;
  readonly cacheState: ProviderCacheFreshness['cacheState'];
  readonly result: 'success' | 'failure' | 'timeout' | 'rate_limited';
  readonly secretMaterialPresent: false;
};

export function mapRuntimeHealthToCanonical(input: {
  readonly lifecycleDisabled: boolean;
  readonly killSwitchBlocked: boolean;
  readonly runtimeState: ProviderHealthState;
}): CanonicalProviderHealth {
  if (input.killSwitchBlocked) {
    return 'blocked';
  }
  if (input.lifecycleDisabled) {
    return 'disabled';
  }
  switch (input.runtimeState) {
    case 'HEALTHY':
      return 'healthy';
    case 'DEGRADED':
    case 'RATE_LIMITED':
      return 'degraded';
    case 'UNAVAILABLE':
    case 'MAINTENANCE':
      return 'unhealthy';
    default:
      return 'unknown';
  }
}
