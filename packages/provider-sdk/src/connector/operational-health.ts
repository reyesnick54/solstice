/**
 * Wave 4 — operational provider health (distinct from trust/reputation).
 *
 * Health reflects connector transport and schema operability only.
 * Provider trust is evaluated separately by the External Data Trust Engine.
 */

export const OPERATIONAL_HEALTH_STATES = [
  'AVAILABLE',
  'DEGRADED',
  'RATE_LIMITED',
  'AUTH_FAILURE',
  'SCHEMA_CHANGED',
  'UNAVAILABLE',
  'DISABLED',
] as const;
export type OperationalHealthState = (typeof OPERATIONAL_HEALTH_STATES)[number];

export type ProviderOperationalHealth = {
  readonly providerId: string;
  readonly state: OperationalHealthState;
  readonly checkedAt: string;
  readonly message: string;
  readonly latencyMs: number | null;
  readonly consecutiveFailures: number;
  readonly lastSuccessAt: string | null;
  readonly lastErrorCode: string | null;
  /** Operational metadata — not a trust score. */
  readonly trustScore: null;
};

export function createOperationalHealth(input: {
  readonly providerId: string;
  readonly state: OperationalHealthState;
  readonly checkedAt: string;
  readonly message: string;
  readonly latencyMs?: number | null;
  readonly consecutiveFailures?: number;
  readonly lastSuccessAt?: string | null;
  readonly lastErrorCode?: string | null;
}): ProviderOperationalHealth {
  return Object.freeze({
    providerId: input.providerId,
    state: input.state,
    checkedAt: input.checkedAt,
    message: input.message,
    latencyMs: input.latencyMs ?? null,
    consecutiveFailures: input.consecutiveFailures ?? 0,
    lastSuccessAt: input.lastSuccessAt ?? null,
    lastErrorCode: input.lastErrorCode ?? null,
    trustScore: null,
  });
}

export function mapTransportErrorToHealth(errorCode: string): OperationalHealthState {
  if (errorCode === 'RATE_LIMITED' || errorCode === 'HTTP_429') {
    return 'RATE_LIMITED';
  }
  if (
    errorCode === 'AUTHENTICATION_FAILED' ||
    errorCode === 'AUTH_FAILURE' ||
    errorCode === 'MISSING_CREDENTIAL'
  ) {
    return 'AUTH_FAILURE';
  }
  if (
    errorCode === 'SCHEMA_INCOMPATIBLE' ||
    errorCode === 'SCHEMA_DRIFT' ||
    errorCode === 'INVALID_PAYLOAD' ||
    errorCode === 'SCHEMA_CHANGED'
  ) {
    return 'SCHEMA_CHANGED';
  }
  if (errorCode === 'PROVIDER_DISABLED' || errorCode === 'CONNECTIVITY_DISABLED') {
    return 'DISABLED';
  }
  if (errorCode === 'CIRCUIT_OPEN' || errorCode === 'PROVIDER_UNAVAILABLE' || errorCode === 'TIMEOUT') {
    return 'UNAVAILABLE';
  }
  return 'DEGRADED';
}
