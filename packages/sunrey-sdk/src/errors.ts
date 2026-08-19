/**
 * Versioned public API error envelope.
 *
 * Reuses protocol rejection codes where they apply. Never includes
 * private keys, secrets, stack traces, or raw personal data.
 */

import { PROTOCOL_REJECTION_CODES } from '../../sunrey-chain/src/protocol/rejection.ts';

export const API_ERROR_CATEGORIES = [
  'VALIDATION',
  'AUTHENTICATION',
  'AUTHORIZATION',
  'POLICY',
  'CONSENSUS',
  'RESOURCE',
  'RATE_LIMIT',
  'NOT_FOUND',
  'TEMPORARY_UNAVAILABLE',
  'INTERNAL',
] as const;
export type ApiErrorCategory = (typeof API_ERROR_CATEGORIES)[number];

export const API_ERROR_CODES = [
  ...PROTOCOL_REJECTION_CODES,
  'UNKNOWN_API_VERSION',
  'OPERATOR_NAMESPACE_FORBIDDEN',
  'PRIVATE_KEY_REJECTED',
  'OVERSIZED_REQUEST',
  'INVALID_PAGINATION_CURSOR',
  'PAGE_SIZE_EXCEEDED',
  'BATCH_SIZE_EXCEEDED',
  'RATE_LIMITED',
  'WRONG_NETWORK',
  'IDEMPOTENCY_CONFLICT',
  'CRYPTO_SUITE_DOWNGRADE',
  'SENSITIVE_FIELD_REJECTED',
  'UNSIGNED_ENVELOPE_REQUIRED',
  'SUBMISSION_UNKNOWN',
  'REQUEST_TIMEOUT',
  'NOT_FOUND',
  'TEMPORARY_UNAVAILABLE',
  'AUTH_REQUIRED',
  'SANDBOX_CANNOT_TRADE_PRODUCTION',
  'SESSION_WITHOUT_FINANCIAL_AUTHORITY',
  'PRICE_ALERT_CANNOT_TRADE',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export type ApiErrorEnvelope = {
  readonly error_code: ApiErrorCode;
  readonly category: ApiErrorCategory;
  readonly message: string;
  readonly retryable: boolean;
  readonly details_safe_for_client: Readonly<Record<string, string>>;
  readonly request_id: string;
  readonly api_version: 'v1';
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
];

export function sanitizeClientDetails(
  details: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SENSITIVE_MARKERS.some((marker) => key.toLowerCase().includes(marker.toLowerCase()))) {
      continue;
    }
    if (SENSITIVE_MARKERS.some((marker) => value.toLowerCase().includes(marker.toLowerCase()))) {
      continue;
    }
    out[key] = value;
  }
  return Object.freeze(out);
}

export function apiError(input: {
  readonly error_code: ApiErrorCode;
  readonly category: ApiErrorCategory;
  readonly message: string;
  readonly retryable: boolean;
  readonly request_id: string;
  readonly details_safe_for_client?: Readonly<Record<string, string>>;
}): ApiErrorEnvelope {
  return Object.freeze({
    error_code: input.error_code,
    category: input.category,
    message: input.message,
    retryable: input.retryable,
    details_safe_for_client: sanitizeClientDetails(input.details_safe_for_client ?? {}),
    request_id: input.request_id,
    api_version: 'v1',
  });
}

export function categoryForCode(code: ApiErrorCode): ApiErrorCategory {
  switch (code) {
    case 'RATE_LIMITED':
      return 'RATE_LIMIT';
    case 'NOT_FOUND':
    case 'UNKNOWN_API_VERSION':
      return 'NOT_FOUND';
    case 'OPERATOR_NAMESPACE_FORBIDDEN':
    case 'PRIVATE_KEY_REJECTED':
    case 'SENSITIVE_FIELD_REJECTED':
    case 'AUTH_REQUIRED':
    case 'SANDBOX_CANNOT_TRADE_PRODUCTION':
    case 'SESSION_WITHOUT_FINANCIAL_AUTHORITY':
      return 'AUTHORIZATION';
    case 'WRONG_NETWORK':
    case 'WRONG_CHAIN':
    case 'INVALID_VERSION':
    case 'MALFORMED':
    case 'OVERSIZED':
    case 'OVERSIZED_REQUEST':
    case 'INVALID_PAGINATION_CURSOR':
    case 'PAGE_SIZE_EXCEEDED':
    case 'BATCH_SIZE_EXCEEDED':
    case 'IDEMPOTENCY_CONFLICT':
    case 'UNSIGNED_ENVELOPE_REQUIRED':
    case 'PRICE_ALERT_CANNOT_TRADE':
      return 'VALIDATION';
    case 'INVALID_SIGNATURE':
    case 'CRYPTO_SUITE_DOWNGRADE':
      return 'AUTHENTICATION';
    case 'PURPOSE_NOT_AUTHORIZED':
    case 'CAPABILITY_INVALID':
    case 'RIGHT_NOT_HELD':
      return 'POLICY';
    case 'TEMPORARY_UNAVAILABLE':
    case 'SUBMISSION_UNKNOWN':
    case 'REQUEST_TIMEOUT':
      return 'TEMPORARY_UNAVAILABLE';
    default:
      return 'VALIDATION';
  }
}
