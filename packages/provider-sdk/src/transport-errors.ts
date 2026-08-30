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
