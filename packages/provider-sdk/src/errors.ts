/**
 * Normalize provider failures into canonical classifications.
 */

import type {
  FailureClassification,
  HttpMethod,
  ProviderError,
  ReliabilityTransportResponse,
} from './reliability-types.ts';

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404, 405, 409, 422]);

export function classifyHttpStatus(status: number): FailureClassification {
  if (status === 401 || status === 403) {
    return 'authentication_failure';
  }
  if (status === 429) {
    return 'rate_limited';
  }
  if (status >= 400 && status < 500) {
    return status === 400 || status === 404 || status === 422 ? 'invalid_payload' : 'non_retryable';
  }
  if (status >= 500) {
    return status === 503 || status === 502 || status === 504 ? 'provider_unavailable' : 'retryable';
  }
  return 'non_retryable';
}

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}

export function isNonRetryableStatus(status: number): boolean {
  return NON_RETRYABLE_STATUSES.has(status);
}

export function parseRetryAfterMs(headers: Readonly<Record<string, string>>, nowMs: number): number | undefined {
  const raw = headers['retry-after'] ?? headers['Retry-After'];
  if (!raw) {
    return undefined;
  }
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.trunc(seconds * 1_000);
  }
  const dateMs = Date.parse(raw);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - nowMs);
  }
  return undefined;
}

export function normalizeTransportError(input: {
  readonly providerId: string;
  readonly response?: ReliabilityTransportResponse;
  readonly networkError?: boolean;
  readonly timeout?: boolean;
  readonly nowMs?: number;
}): ProviderError {
  if (input.timeout) {
    return Object.freeze({
      classification: 'retryable',
      code: 'PROVIDER_TIMEOUT',
      message: 'provider request exceeded timeout',
      providerId: input.providerId,
    });
  }
  if (input.networkError) {
    return Object.freeze({
      classification: 'retryable',
      code: 'NETWORK_ERROR',
      message: 'network interruption or temporary DNS failure',
      providerId: input.providerId,
    });
  }
  const response = input.response;
  if (!response) {
    return Object.freeze({
      classification: 'provider_unavailable',
      code: 'PROVIDER_UNAVAILABLE',
      message: 'no response from provider',
      providerId: input.providerId,
    });
  }
  const classification = classifyHttpStatus(response.status);
  const retryAfterMs =
    classification === 'rate_limited'
      ? parseRetryAfterMs(response.headers, input.nowMs ?? Date.now())
      : undefined;
  return Object.freeze({
    classification,
    code: `HTTP_${response.status}`,
    message: `provider returned HTTP ${response.status}`,
    status: response.status,
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    providerId: input.providerId,
  });
}

export function shouldRetryOperation(input: {
  readonly method: HttpMethod;
  readonly idempotent?: boolean;
  readonly error: ProviderError;
}): boolean {
  if (input.error.classification === 'authentication_failure') {
    return false;
  }
  if (input.error.classification === 'invalid_payload') {
    return false;
  }
  if (input.error.classification === 'security_failure') {
    return false;
  }
  if (input.error.classification === 'non_retryable') {
    return false;
  }
  if (input.error.classification === 'rate_limited') {
    return true;
  }
  if (input.error.classification === 'retryable' || input.error.classification === 'provider_unavailable') {
    if (input.method === 'GET' || input.method === 'HEAD') {
      return true;
    }
    return input.idempotent === true;
  }
  return false;
}

/**
 * Normalized provider transport errors.
 *
 * Messages are safe for logs and adapter surfaces. Secrets are never included.
 */

export const PROVIDER_TRANSPORT_ERROR_KINDS = [
  'ProviderNetworkError',
  'ProviderTimeoutError',
  'ProviderAuthenticationError',
  'ProviderRateLimitError',
  'ProviderClientError',
  'ProviderServerError',
  'ProviderInvalidResponseError',
  'ProviderSecurityError',
] as const;

export type ProviderTransportErrorKind = (typeof PROVIDER_TRANSPORT_ERROR_KINDS)[number];

export type ProviderTransportErrorFields = {
  readonly kind: ProviderTransportErrorKind;
  readonly providerId: string;
  readonly requestId: string;
  readonly httpStatus: number | null;
  readonly retryable: boolean;
  readonly message: string;
};

export class ProviderTransportError extends Error {
  readonly kind: ProviderTransportErrorKind;
  readonly providerId: string;
  readonly requestId: string;
  readonly httpStatus: number | null;
  readonly retryable: boolean;

  constructor(fields: ProviderTransportErrorFields) {
    super(fields.message);
    this.name = fields.kind;
    this.kind = fields.kind;
    this.providerId = fields.providerId;
    this.requestId = fields.requestId;
    this.httpStatus = fields.httpStatus;
    this.retryable = fields.retryable;
    Object.freeze(this);
  }

  toJSON(): ProviderTransportErrorFields {
    return Object.freeze({
      kind: this.kind,
      providerId: this.providerId,
      requestId: this.requestId,
      httpStatus: this.httpStatus,
      retryable: this.retryable,
      message: this.message,
    });
  }
}

export function networkError(
  providerId: string,
  requestId: string,
  message: string,
  retryable = true,
): ProviderTransportError {
  return new ProviderTransportError({
    kind: 'ProviderNetworkError',
    providerId,
    requestId,
    httpStatus: null,
    retryable,
    message,
  });
}

export function timeoutError(providerId: string, requestId: string): ProviderTransportError {
  return new ProviderTransportError({
    kind: 'ProviderTimeoutError',
    providerId,
    requestId,
    httpStatus: null,
    retryable: true,
    message: 'provider request exceeded timeout',
  });
}

export function authenticationError(
  providerId: string,
  requestId: string,
  httpStatus: number,
): ProviderTransportError {
  return new ProviderTransportError({
    kind: 'ProviderAuthenticationError',
    providerId,
    requestId,
    httpStatus,
    retryable: false,
    message: 'provider rejected authentication',
  });
}

export function rateLimitError(
  providerId: string,
  requestId: string,
  httpStatus: number,
): ProviderTransportError {
  return new ProviderTransportError({
    kind: 'ProviderRateLimitError',
    providerId,
    requestId,
    httpStatus,
    retryable: true,
    message: 'provider rate limit exceeded',
  });
}

export function clientError(
  providerId: string,
  requestId: string,
  httpStatus: number,
  message: string,
): ProviderTransportError {
  return new ProviderTransportError({
    kind: 'ProviderClientError',
    providerId,
    requestId,
    httpStatus,
    retryable: false,
    message,
  });
}

export function serverError(
  providerId: string,
  requestId: string,
  httpStatus: number,
): ProviderTransportError {
  return new ProviderTransportError({
    kind: 'ProviderServerError',
    providerId,
    requestId,
    httpStatus,
    retryable: true,
    message: 'provider server error',
  });
}

export function invalidResponseError(
  providerId: string,
  requestId: string,
  message: string,
  httpStatus: number | null = null,
): ProviderTransportError {
  return new ProviderTransportError({
    kind: 'ProviderInvalidResponseError',
    providerId,
    requestId,
    httpStatus,
    retryable: false,
    message,
  });
}

export function securityError(
  providerId: string,
  requestId: string,
  message: string,
): ProviderTransportError {
  return new ProviderTransportError({
    kind: 'ProviderSecurityError',
    providerId,
    requestId,
    httpStatus: null,
    retryable: false,
    message,
  });
}

export function mapHttpStatusToError(
  providerId: string,
  requestId: string,
  status: number,
): ProviderTransportError {
  if (status === 401 || status === 403) {
    return authenticationError(providerId, requestId, status);
  }
  if (status === 429) {
    return rateLimitError(providerId, requestId, status);
  }
  if (status >= 500) {
    return serverError(providerId, requestId, status);
  }
  return clientError(providerId, requestId, status, `provider returned HTTP ${status}`);
}

export const PROVIDER_SDK_ERROR_CODES = [
  'PROVIDER_NOT_FOUND',
  'PROVIDER_ALREADY_REGISTERED',
  'PROVIDER_NOT_IN_CATALOG',
  'PROVIDER_BLOCKED',
  'PROVIDER_METADATA_INVALID',
  'PROVIDER_ACTIVATION_DENIED',
  'PROVIDER_LIFECYCLE_ERROR',
  'PROVIDER_SECRET_EXPOSURE_FORBIDDEN',
] as const;

export type ProviderSdkErrorCode = (typeof PROVIDER_SDK_ERROR_CODES)[number];

export type ProviderSdkError = {
  readonly code: ProviderSdkErrorCode;
  readonly message: string;
  readonly providerId?: string;
};

export function providerSdkError(
  code: ProviderSdkErrorCode,
  message: string,
  providerId?: string,
): ProviderSdkError {
  return Object.freeze({
    code,
    message,
    ...(providerId ? { providerId } : {}),
  });
}

export class ProviderSdkException extends Error {
  readonly code: ProviderSdkErrorCode;
  readonly providerId?: string;

  constructor(error: ProviderSdkError) {
    super(error.message);
    this.name = 'ProviderSdkException';
    this.code = error.code;
    if (error.providerId) {
      this.providerId = error.providerId;
    }
  }
}

export function throwProviderSdk(error: ProviderSdkError): never {
  throw new ProviderSdkException(error);
}
