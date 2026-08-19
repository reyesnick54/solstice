/**
 * Bounded retries for transient connector failures only.
 *
 * Timeouts, 429, and selected 5xx may retry. Authentication, schema,
 * license/policy, and semantic 4xx failures do not retry.
 */

import type { ConnectorClock, ConnectorRandom } from './runtime-types.ts';
import type { ProductionOracleRejection, ProductionOracleRejectionCode } from './types.ts';

export const TRANSIENT_RETRY_CODES = ['REQUEST_TIMEOUT', 'RATE_LIMITED'] as const;
export const TRANSIENT_HTTP_STATUSES = new Set([429, 500, 502, 503, 504]);

export type RetryPolicy = {
  readonly maxAttempts: number;
  readonly backoffMs: readonly number[];
  readonly jitterPolicy: 'NONE' | 'DETERMINISTIC';
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = Object.freeze({
  maxAttempts: 3,
  backoffMs: Object.freeze([20, 40, 80]),
  jitterPolicy: 'DETERMINISTIC',
});

const NON_RETRYABLE: ReadonlySet<ProductionOracleRejectionCode> = new Set([
  'AUTH_FAILED',
  'CREDENTIAL_NOT_ASSIGNED',
  'CREDENTIAL_ISOLATION_VIOLATION',
  'OAUTH_TOKEN_FAILED',
  'SIGNATURE_PROFILE_INVALID',
  'SCHEMA_INCOMPATIBLE',
  'SCHEMA_DRIFT',
  'SOURCE_RECORD_INVALID',
  'SOURCE_TIMESTAMP_MISSING',
  'SOURCE_TIMESTAMP_STALE',
  'WRONG_NUMERIC_REPRESENTATION',
  'WRONG_UNIT',
  'FLOAT_FORBIDDEN',
  'CONTENT_TYPE_INVALID',
  'ENDPOINT_NOT_APPROVED',
  'SSRF_DESTINATION_FORBIDDEN',
  'TLS_POLICY_VIOLATION',
  'CONNECTIVITY_DISABLED',
  'CIRCUIT_OPEN',
  'AGREEMENT_EVIDENCE_MISSING',
  'PROVIDER_NOT_ELIGIBLE',
  'PROVIDER_SUSPENDED',
  'PROVIDER_REVOKED',
]);

export function isRetryableRejection(error: ProductionOracleRejection, status?: number): boolean {
  if (NON_RETRYABLE.has(error.code)) {
    return false;
  }
  if (error.code === 'REQUEST_TIMEOUT' || error.code === 'RATE_LIMITED') {
    return true;
  }
  if (status !== undefined && TRANSIENT_HTTP_STATUSES.has(status)) {
    return true;
  }
  if (error.code === 'HTTP_STATUS_REJECTED' && status !== undefined && TRANSIENT_HTTP_STATUSES.has(status)) {
    return true;
  }
  return false;
}

export function retryDelayMs(
  policy: RetryPolicy,
  attemptIndex: number,
  random: ConnectorRandom,
): number {
  const base = policy.backoffMs[Math.min(attemptIndex, policy.backoffMs.length - 1)] ?? 0;
  if (policy.jitterPolicy === 'NONE') {
    return base;
  }
  const jitter = Math.floor(random.nextUnitInterval() * Math.max(1, Math.floor(base / 5)));
  return base + jitter;
}

export async function sleepMs(clock: ConnectorClock, ms: number, sleeper?: (ms: number) => Promise<void>): Promise<void> {
  if (ms <= 0) {
    return;
  }
  if (sleeper) {
    await sleeper(ms);
    return;
  }
  void clock;
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}
