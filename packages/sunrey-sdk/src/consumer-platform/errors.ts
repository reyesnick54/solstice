/**
 * Consumer-platform error catalog and typed client errors.
 *
 * Browser-safe. Does not import chain protocol, gateway, ledger, or
 * Execution Authority internals.
 */

export const CONSUMER_API_VERSION = 'v1' as const;

export const CONSUMER_ERROR_CATEGORIES = [
  'AUTHENTICATION',
  'AUTHORIZATION',
  'VALIDATION',
  'POLICY',
  'COMPLIANCE',
  'APPROVAL',
  'RESOURCE',
  'CONFLICT',
  'RATE_LIMIT',
  'PROVIDER',
  'WORKFLOW',
  'INTERNAL',
] as const;
export type ConsumerErrorCategory = (typeof CONSUMER_ERROR_CATEGORIES)[number];

export const CONSUMER_ERROR_CODES = [
  'AUTH_REQUIRED',
  'INVALID_CREDENTIALS',
  'SESSION_EXPIRED',
  'SESSION_REVOKED',
  'MFA_REQUIRED',
  'PASSKEY_CHALLENGE_INVALID',
  'DEVICE_NOT_TRUSTED',
  'DEVICE_BLOCKED',
  'RECOVERY_REQUIRED',
  'CAPABILITY_DENIED',
  'FEATURE_UNAVAILABLE',
  'KERNEL_REFUSED',
  'VALIDATION_FAILED',
  'INVALID_PAGINATION_CURSOR',
  'PAGE_SIZE_EXCEEDED',
  'IDEMPOTENCY_CONFLICT',
  'POLICY_DENIED',
  'COMPLIANCE_HOLD',
  'APPROVAL_REQUIRED',
  'APPROVAL_PENDING',
  'APPROVAL_NOT_FOUND',
  'RESOURCE_NOT_FOUND',
  'RESOURCE_CONFLICT',
  'RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
  'WORKFLOW_FAILED',
  'SANDBOX_PERSONA_FORBIDDEN',
  'OVERSIZED_REQUEST',
  'INTERNAL_ERROR',
] as const;
export type ConsumerErrorCode = (typeof CONSUMER_ERROR_CODES)[number];

export type ConsumerErrorEnvelope = {
  readonly error_code: ConsumerErrorCode;
  readonly category: ConsumerErrorCategory;
  readonly message: string;
  readonly retryable: boolean;
  readonly user_action_required: boolean;
  readonly safe_to_display: boolean;
  readonly details_safe_for_client: Readonly<Record<string, string>>;
  readonly request_id: string;
  readonly api_version: typeof CONSUMER_API_VERSION;
};

const SENSITIVE_MARKERS = [
  'privateKey',
  'private_key',
  'seedPhrase',
  'seed_phrase',
  'mnemonic',
  'hsmSecret',
  'rawPdv',
  'raw_pdv',
  'rawPayload',
  'stack',
  'stackTrace',
  'executionAuthority',
  'signature',
  'hmac',
  'secret',
];

export function sanitizeConsumerDetails(
  details: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(details)) {
    const haystack = `${key}\n${value}`.toLowerCase();
    if (SENSITIVE_MARKERS.some((marker) => haystack.includes(marker.toLowerCase()))) {
      continue;
    }
    out[key] = value;
  }
  return Object.freeze(out);
}

export function consumerError(input: {
  readonly error_code: ConsumerErrorCode;
  readonly category: ConsumerErrorCategory;
  readonly message: string;
  readonly retryable: boolean;
  readonly user_action_required: boolean;
  readonly safe_to_display: boolean;
  readonly request_id: string;
  readonly details_safe_for_client?: Readonly<Record<string, string>>;
}): ConsumerErrorEnvelope {
  return Object.freeze({
    error_code: input.error_code,
    category: input.category,
    message: input.message,
    retryable: input.retryable,
    user_action_required: input.user_action_required,
    safe_to_display: input.safe_to_display,
    details_safe_for_client: sanitizeConsumerDetails(input.details_safe_for_client ?? {}),
    request_id: input.request_id,
    api_version: CONSUMER_API_VERSION,
  });
}

export function categoryForConsumerCode(code: ConsumerErrorCode): ConsumerErrorCategory {
  switch (code) {
    case 'AUTH_REQUIRED':
    case 'INVALID_CREDENTIALS':
    case 'SESSION_EXPIRED':
    case 'SESSION_REVOKED':
    case 'MFA_REQUIRED':
    case 'PASSKEY_CHALLENGE_INVALID':
    case 'DEVICE_NOT_TRUSTED':
    case 'DEVICE_BLOCKED':
    case 'RECOVERY_REQUIRED':
      return 'AUTHENTICATION';
    case 'CAPABILITY_DENIED':
    case 'FEATURE_UNAVAILABLE':
    case 'SANDBOX_PERSONA_FORBIDDEN':
      return 'AUTHORIZATION';
    case 'VALIDATION_FAILED':
    case 'INVALID_PAGINATION_CURSOR':
    case 'PAGE_SIZE_EXCEEDED':
    case 'OVERSIZED_REQUEST':
      return 'VALIDATION';
    case 'POLICY_DENIED':
    case 'KERNEL_REFUSED':
      return 'POLICY';
    case 'COMPLIANCE_HOLD':
      return 'COMPLIANCE';
    case 'APPROVAL_REQUIRED':
    case 'APPROVAL_PENDING':
    case 'APPROVAL_NOT_FOUND':
      return 'APPROVAL';
    case 'RESOURCE_NOT_FOUND':
      return 'RESOURCE';
    case 'RESOURCE_CONFLICT':
    case 'IDEMPOTENCY_CONFLICT':
      return 'CONFLICT';
    case 'RATE_LIMITED':
      return 'RATE_LIMIT';
    case 'PROVIDER_UNAVAILABLE':
      return 'PROVIDER';
    case 'WORKFLOW_FAILED':
      return 'WORKFLOW';
    default:
      return 'INTERNAL';
  }
}

export class SunReyConsumerError extends Error {
  readonly status: number;
  readonly envelope: ConsumerErrorEnvelope | null;

  constructor(status: number, message: string, envelope: ConsumerErrorEnvelope | null) {
    super(message);
    this.name = 'SunReyConsumerError';
    this.status = status;
    this.envelope = envelope;
  }
}

export function isConsumerErrorEnvelope(value: unknown): value is ConsumerErrorEnvelope {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.error_code === 'string' && typeof record.request_id === 'string';
}
