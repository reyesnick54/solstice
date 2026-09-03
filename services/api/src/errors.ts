/**
 * Canonical SunRey Platform API error envelope.
 *
 * Stack traces and compliance reasoning stay server-side.
 * Clients receive only stable codes and display-safe metadata.
 */

export const API_ERROR_CATEGORIES = [
  'VALIDATION',
  'AUTHENTICATION',
  'AUTHORIZATION',
  'COMPLIANCE',
  'POLICY',
  'CONFLICT',
  'NOT_FOUND',
  'RATE_LIMIT',
  'PROVIDER',
  'TEMPORARY_UNAVAILABLE',
  'INTERNAL',
] as const;

export type ApiErrorCategory = (typeof API_ERROR_CATEGORIES)[number];

export const API_ERROR_CODES = [
  'VALIDATION_FAILED',
  'INVALID_JSON',
  'OVERSIZED_REQUEST',
  'UNSUPPORTED_MEDIA_TYPE',
  'AUTHENTICATION_REQUIRED',
  'AUTHENTICATION_INVALID',
  'AUTHORIZATION_DENIED',
  'COMPLIANCE_REFUSED',
  'POLICY_DENIED',
  'CONFLICT',
  'IDEMPOTENCY_CONFLICT',
  'NOT_FOUND',
  'UNKNOWN_API_VERSION',
  'RATE_LIMITED',
  'PROVIDER_ERROR',
  'TEMPORARY_UNAVAILABLE',
  'INTERNAL_ERROR',
  'CONFIGURATION_INVALID',
  'METHOD_NOT_ALLOWED',
  'REQUEST_TIMEOUT',
  'ORIGIN_FORBIDDEN',
  'POLICY_DENIED',
  'CONSENT_REQUIRED',
  'IDENTITY_ASSURANCE_INSUFFICIENT',
  'CLAIM_DUPLICATE',
  'CLAIM_DISPUTED',
  'TRANSACTION_REJECTED',
  'CHAIN_UNAVAILABLE',
  'CHAIN_SYNCING',
  'PROVIDER_UNAVAILABLE',
  'REGULATED_FEATURE_DISABLED',
  'SANDBOX_ONLY',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export type ApiFieldError = {
  readonly field: string;
  readonly code: string;
  readonly message: string;
};

export type ApiErrorBody = {
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly requestId: string;
  readonly category: ApiErrorCategory;
  readonly retryable: boolean;
  readonly fieldErrors: readonly ApiFieldError[];
  readonly metadata: Readonly<Record<string, string>>;
};

export type ApiErrorEnvelope = {
  readonly error: ApiErrorBody;
};

export class PlatformApiError extends Error {
  readonly code: ApiErrorCode;
  readonly category: ApiErrorCategory;
  readonly retryable: boolean;
  readonly httpStatus: number;
  readonly fieldErrors: readonly ApiFieldError[];
  readonly metadata: Readonly<Record<string, string>>;

  constructor(input: {
    readonly code: ApiErrorCode;
    readonly message: string;
    readonly category: ApiErrorCategory;
    readonly retryable: boolean;
    readonly httpStatus: number;
    readonly fieldErrors?: readonly ApiFieldError[];
    readonly metadata?: Readonly<Record<string, string>>;
  }) {
    super(input.message);
    this.name = 'PlatformApiError';
    this.code = input.code;
    this.category = input.category;
    this.retryable = input.retryable;
    this.httpStatus = input.httpStatus;
    this.fieldErrors = input.fieldErrors ?? [];
    this.metadata = sanitizeClientMetadata(input.metadata ?? {});
  }
}

const SENSITIVE_MARKERS = [
  'password',
  'passwd',
  'secret',
  'token',
  'refresh',
  'authorization',
  'privatekey',
  'private_key',
  'seed',
  'mnemonic',
  'ssn',
  'pan',
  'cardnumber',
  'card_number',
  'cvv',
  'cvc',
  'stack',
  'stacktrace',
  'hmac',
  'apikey',
  'api_key',
] as const;

function isSensitiveKeyOrValue(value: string): boolean {
  const lowered = value.toLowerCase();
  return SENSITIVE_MARKERS.some((marker) => lowered.includes(marker));
}

export function sanitizeClientMetadata(
  metadata: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKeyOrValue(key) || isSensitiveKeyOrValue(value)) {
      continue;
    }
    out[key] = value;
  }
  return Object.freeze(out);
}

export function categoryForCode(code: ApiErrorCode): ApiErrorCategory {
  switch (code) {
    case 'VALIDATION_FAILED':
    case 'INVALID_JSON':
    case 'OVERSIZED_REQUEST':
    case 'UNSUPPORTED_MEDIA_TYPE':
    case 'METHOD_NOT_ALLOWED':
      return 'VALIDATION';
    case 'AUTHENTICATION_REQUIRED':
    case 'AUTHENTICATION_INVALID':
      return 'AUTHENTICATION';
    case 'AUTHORIZATION_DENIED':
    case 'ORIGIN_FORBIDDEN':
      return 'AUTHORIZATION';
    case 'COMPLIANCE_REFUSED':
      return 'COMPLIANCE';
    case 'POLICY_DENIED':
    case 'CONSENT_REQUIRED':
    case 'IDENTITY_ASSURANCE_INSUFFICIENT':
    case 'CLAIM_DUPLICATE':
    case 'CLAIM_DISPUTED':
    case 'TRANSACTION_REJECTED':
    case 'REGULATED_FEATURE_DISABLED':
    case 'SANDBOX_ONLY':
      return 'POLICY';
    case 'CONFLICT':
    case 'IDEMPOTENCY_CONFLICT':
      return 'CONFLICT';
    case 'NOT_FOUND':
    case 'UNKNOWN_API_VERSION':
      return 'NOT_FOUND';
    case 'RATE_LIMITED':
      return 'RATE_LIMIT';
    case 'PROVIDER_ERROR':
      return 'PROVIDER';
    case 'TEMPORARY_UNAVAILABLE':
    case 'REQUEST_TIMEOUT':
    case 'CONFIGURATION_INVALID':
      return 'TEMPORARY_UNAVAILABLE';
    case 'CHAIN_UNAVAILABLE':
    case 'CHAIN_SYNCING':
    case 'PROVIDER_UNAVAILABLE':
      return 'TEMPORARY_UNAVAILABLE';
    case 'INTERNAL_ERROR':
      return 'INTERNAL';
  }
}

export function httpStatusForCode(code: ApiErrorCode): number {
  switch (code) {
    case 'VALIDATION_FAILED':
    case 'INVALID_JSON':
    case 'UNSUPPORTED_MEDIA_TYPE':
      return 400;
    case 'AUTHENTICATION_REQUIRED':
    case 'AUTHENTICATION_INVALID':
      return 401;
    case 'AUTHORIZATION_DENIED':
    case 'ORIGIN_FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
    case 'UNKNOWN_API_VERSION':
      return 404;
    case 'METHOD_NOT_ALLOWED':
      return 405;
    case 'CONFLICT':
    case 'IDEMPOTENCY_CONFLICT':
      return 409;
    case 'OVERSIZED_REQUEST':
      return 413;
    case 'RATE_LIMITED':
      return 429;
    case 'COMPLIANCE_REFUSED':
    case 'POLICY_DENIED':
    case 'CONSENT_REQUIRED':
    case 'IDENTITY_ASSURANCE_INSUFFICIENT':
    case 'CLAIM_DUPLICATE':
    case 'CLAIM_DISPUTED':
    case 'TRANSACTION_REJECTED':
    case 'REGULATED_FEATURE_DISABLED':
    case 'SANDBOX_ONLY':
      return 403;
    case 'CHAIN_UNAVAILABLE':
    case 'CHAIN_SYNCING':
    case 'PROVIDER_UNAVAILABLE':
      return 503;
    case 'TEMPORARY_UNAVAILABLE':
    case 'PROVIDER_ERROR':
    case 'CONFIGURATION_INVALID':
      return 503;
    case 'REQUEST_TIMEOUT':
      return 504;
    case 'INTERNAL_ERROR':
      return 500;
  }
}

export function apiError(
  input: {
    readonly code: ApiErrorCode;
    readonly message: string;
    readonly requestId: string;
    readonly retryable?: boolean;
    readonly fieldErrors?: readonly ApiFieldError[];
    readonly metadata?: Readonly<Record<string, string>>;
    readonly category?: ApiErrorCategory;
  },
): ApiErrorEnvelope {
  const category = input.category ?? categoryForCode(input.code);
  return Object.freeze({
    error: Object.freeze({
      code: input.code,
      message: input.message,
      requestId: input.requestId,
      category,
      retryable:
        input.retryable ??
        (category === 'RATE_LIMIT' || category === 'TEMPORARY_UNAVAILABLE' || category === 'PROVIDER'),
      fieldErrors: input.fieldErrors ?? [],
      metadata: sanitizeClientMetadata(input.metadata ?? {}),
    }),
  });
}

export function envelopeFromError(error: PlatformApiError, requestId: string): ApiErrorEnvelope {
  return apiError({
    code: error.code,
    message: error.message,
    requestId,
    retryable: error.retryable,
    fieldErrors: error.fieldErrors,
    metadata: error.metadata,
    category: error.category,
  });
}

export function failClosedInternal(requestId: string): ApiErrorEnvelope {
  return apiError({
    code: 'INTERNAL_ERROR',
    message: 'an unexpected error occurred',
    requestId,
    retryable: false,
    category: 'INTERNAL',
  });
}
