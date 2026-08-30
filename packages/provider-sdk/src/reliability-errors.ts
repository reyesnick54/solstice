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
