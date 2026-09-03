/**
 * Canonical provider failure taxonomy.
 *
 * Provider-specific errors normalize into these codes while retaining safe
 * diagnostic context. Secret values never appear in messages or codes.
 */

export const PROVIDER_FAILURE_CODES = [
  'NOT_CONFIGURED',
  'MISSING_CREDENTIALS',
  'DNS_FAILURE',
  'CONNECTION_FAILURE',
  'TIMEOUT',
  'TLS_FAILURE',
  'AUTHENTICATION_FAILURE',
  'AUTHORIZATION_FAILURE',
  'RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
  'INVALID_RESPONSE',
  'SCHEMA_MISMATCH',
  'MODEL_UNAVAILABLE',
  'BILLING_DISABLED',
  'QUOTA_EXHAUSTED',
  'COMPLIANCE_BLOCKED',
  'FEATURE_DISABLED',
  'PROVIDER_DISABLED',
  'PROVIDER_NOT_IN_CATALOG',
  'SSRF_BLOCKED',
  'SILENT_SIMULATION_REJECTED',
  'UNKNOWN',
] as const;

export type ProviderFailureCode = (typeof PROVIDER_FAILURE_CODES)[number];

export type NormalizedProviderFailure = {
  readonly code: ProviderFailureCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly providerId: string | null;
  readonly httpStatus: number | null;
};

const RETRYABLE_CODES = new Set<ProviderFailureCode>([
  'DNS_FAILURE',
  'CONNECTION_FAILURE',
  'TIMEOUT',
  'RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
]);

export function isRetryableFailureCode(code: ProviderFailureCode): boolean {
  return RETRYABLE_CODES.has(code);
}

export function normalizeProviderFailure(input: {
  readonly providerId?: string | null;
  readonly code?: string | null;
  readonly message?: string | null;
  readonly httpStatus?: number | null;
  readonly kind?: string | null;
}): NormalizedProviderFailure {
  const providerId = input.providerId ?? null;
  const httpStatus = input.httpStatus ?? null;
  const rawMessage = input.message ?? 'provider operation failed';
  const code = classifyFailureCode({
    ...(input.code !== undefined ? { code: input.code } : {}),
    httpStatus,
    ...(input.kind !== undefined ? { kind: input.kind } : {}),
    message: rawMessage,
  });
  return Object.freeze({
    code,
    message: sanitizeFailureMessage(rawMessage),
    retryable: isRetryableFailureCode(code),
    providerId,
    httpStatus,
  });
}

function classifyFailureCode(input: {
  readonly code?: string | null;
  readonly httpStatus?: number | null;
  readonly kind?: string | null;
  readonly message?: string | null;
}): ProviderFailureCode {
  const upper = (input.code ?? input.kind ?? '').toUpperCase();
  if (upper.includes('NOT_CONFIGURED') || upper.includes('CONFIGURATION')) {
    return 'NOT_CONFIGURED';
  }
  if (upper.includes('MISSING_CREDENTIAL') || upper.includes('CREDENTIAL')) {
    return 'MISSING_CREDENTIALS';
  }
  if (upper.includes('DNS')) {
    return 'DNS_FAILURE';
  }
  if (upper.includes('TIMEOUT') || upper.includes('ETIMEDOUT')) {
    return 'TIMEOUT';
  }
  if (upper.includes('TLS') || upper.includes('CERT')) {
    return 'TLS_FAILURE';
  }
  if (upper.includes('SSRF') || upper.includes('SECURITY')) {
    return 'SSRF_BLOCKED';
  }
  if (upper.includes('SILENT_SIMULATION')) {
    return 'SILENT_SIMULATION_REJECTED';
  }
  if (upper.includes('SCHEMA') || upper.includes('VALIDATION')) {
    return 'SCHEMA_MISMATCH';
  }
  if (upper.includes('INVALID_RESPONSE')) {
    return 'INVALID_RESPONSE';
  }
  if (upper.includes('DISABLED')) {
    return 'PROVIDER_DISABLED';
  }
  if (upper.includes('NOT_IN_CATALOG') || upper.includes('NOT_FOUND')) {
    return 'PROVIDER_NOT_IN_CATALOG';
  }
  if (upper.includes('COMPLIANCE')) {
    return 'COMPLIANCE_BLOCKED';
  }
  if (upper.includes('QUOTA')) {
    return 'QUOTA_EXHAUSTED';
  }
  if (upper.includes('BILLING')) {
    return 'BILLING_DISABLED';
  }
  if (upper.includes('MODEL')) {
    return 'MODEL_UNAVAILABLE';
  }
  if (upper.includes('FEATURE_DISABLED')) {
    return 'FEATURE_DISABLED';
  }
  if (input.httpStatus === 401) {
    return 'AUTHENTICATION_FAILURE';
  }
  if (input.httpStatus === 403) {
    return 'AUTHORIZATION_FAILURE';
  }
  if (input.httpStatus === 429) {
    return 'RATE_LIMITED';
  }
  if (input.httpStatus !== null && input.httpStatus !== undefined && input.httpStatus >= 500) {
    return 'PROVIDER_UNAVAILABLE';
  }
  if (upper.includes('NETWORK') || upper.includes('ECONNREFUSED') || upper.includes('EHOSTUNREACH')) {
    return 'CONNECTION_FAILURE';
  }
  if (upper.includes('RATE_LIMIT')) {
    return 'RATE_LIMITED';
  }
  if (upper.includes('UNAVAILABLE')) {
    return 'PROVIDER_UNAVAILABLE';
  }
  return 'UNKNOWN';
}

const SECRET_PATTERNS = [
  /Bearer\s+\S+/gi,
  /api[_-]?key[=:]\s*\S+/gi,
  /token[=:]\s*\S+/gi,
  /password[=:]\s*\S+/gi,
  /secret[=:]\s*\S+/gi,
  /sk-[a-zA-Z0-9]{10,}/g,
];

export function sanitizeFailureMessage(message: string): string {
  let sanitized = message;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

export function mapTransportKindToFailureCode(kind: string): ProviderFailureCode {
  switch (kind) {
    case 'ProviderNetworkError':
      return 'CONNECTION_FAILURE';
    case 'ProviderTimeoutError':
      return 'TIMEOUT';
    case 'ProviderAuthenticationError':
      return 'AUTHENTICATION_FAILURE';
    case 'ProviderRateLimitError':
      return 'RATE_LIMITED';
    case 'ProviderServerError':
      return 'PROVIDER_UNAVAILABLE';
    case 'ProviderInvalidResponseError':
      return 'INVALID_RESPONSE';
    case 'ProviderSecurityError':
      return 'SSRF_BLOCKED';
    case 'ProviderClientError':
      return 'INVALID_RESPONSE';
    default:
      return 'UNKNOWN';
  }
}
