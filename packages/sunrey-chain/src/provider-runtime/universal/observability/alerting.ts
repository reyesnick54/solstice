/**
 * Alert condition hooks using existing monitoring semantics.
 * Single transient failures do not fire noisy alerts.
 */

import type { ProviderHealthRecord } from '../types.ts';
import type { ProviderAlertCondition } from './types.ts';
import type { RefreshSchedule } from './scheduler-tracker.ts';
import type { ProviderCacheFreshness } from './types.ts';

export type AlertEvaluationInput = {
  readonly providerId: string;
  readonly health: ProviderHealthRecord | null;
  readonly schedule: RefreshSchedule | null;
  readonly cacheFreshness: ProviderCacheFreshness;
  readonly unavailableSinceUtc: string | null;
  readonly nowUtc: string;
  readonly unavailableThresholdMs?: number;
  readonly errorRateThreshold?: number;
};

export function evaluateProviderAlerts(input: AlertEvaluationInput): readonly ProviderAlertCondition[] {
  const alerts: ProviderAlertCondition[] = [];
  const unavailableThreshold = input.unavailableThresholdMs ?? 300_000;
  const errorRateThreshold = input.errorRateThreshold ?? 0.5;

  if (input.health?.circuitState === 'OPEN') {
    const sustained =
      input.health.consecutiveFailures >= 3 ||
      minutesSince(input.health.lastFailureAt, input.nowUtc) >= 5;
    alerts.push(
      alert(
        'circuit_open',
        input.providerId,
        sustained ? 'critical' : 'warning',
        'circuit breaker is open',
        input.nowUtc,
        !sustained,
      ),
    );
  }

  if (input.unavailableSinceUtc) {
    const unavailableMs = Date.parse(input.nowUtc) - Date.parse(input.unavailableSinceUtc);
    if (Number.isFinite(unavailableMs) && unavailableMs >= unavailableThreshold) {
      alerts.push(
        alert(
          'provider_unavailable',
          input.providerId,
          'critical',
          `provider unavailable for ${Math.round(unavailableMs / 60_000)} minutes`,
          input.nowUtc,
          false,
        ),
      );
    }
  }

  if (input.health && input.health.errorRate >= errorRateThreshold && input.health.consecutiveFailures >= 2) {
    alerts.push(
      alert(
        'error_rate',
        input.providerId,
        'warning',
        `provider error rate ${input.health.errorRate.toFixed(2)} exceeds threshold`,
        input.nowUtc,
        input.health.consecutiveFailures < 3,
      ),
    );
  }

  if (input.schedule && input.schedule.consecutiveFailures >= 3) {
    alerts.push(
      alert(
        'refresh_failure',
        input.providerId,
        'critical',
        'scheduled refresh is failing repeatedly',
        input.nowUtc,
        false,
      ),
    );
  }

  if (input.cacheFreshness.isStale && input.cacheFreshness.lastRefreshedAt === null) {
    alerts.push(
      alert(
        'cache_expired',
        input.providerId,
        'warning',
        'cache data expired with no fallback',
        input.nowUtc,
        false,
      ),
    );
  }

  if (input.health?.state === 'RATE_LIMITED' && input.health.rateLimited) {
    alerts.push(
      alert(
        'rate_limit_exhausted',
        input.providerId,
        'warning',
        'provider rate-limit budget exhausted',
        input.nowUtc,
        true,
      ),
    );
  }

  if (input.health?.state === 'UNAVAILABLE' && input.health.consecutiveFailures >= 3) {
    const recentAuth = input.health.lastFailureAt && minutesSince(input.health.lastFailureAt, input.nowUtc) < 10;
    if (recentAuth) {
      alerts.push(
        alert(
          'auth_failure',
          input.providerId,
          'warning',
          'unexpected authentication failures detected',
          input.nowUtc,
          input.health.consecutiveFailures < 5,
        ),
      );
    }
  }

  return Object.freeze(alerts);
}

function alert(
  kind: ProviderAlertCondition['kind'],
  providerId: string,
  severity: ProviderAlertCondition['severity'],
  message: string,
  firedAtUtc: string,
  transient: boolean,
): ProviderAlertCondition {
  return Object.freeze({
    alertId: `${kind}:${providerId}:${firedAtUtc}`,
    providerId,
    kind,
    severity,
    message,
    firedAtUtc,
    transient,
  });
}

function minutesSince(iso: string | null, nowUtc: string): number {
  if (!iso) {
    return Number.POSITIVE_INFINITY;
  }
  const delta = Date.parse(nowUtc) - Date.parse(iso);
  return Number.isFinite(delta) ? delta / 60_000 : Number.POSITIVE_INFINITY;
}
