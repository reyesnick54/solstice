/**
 * Wave 1 Prompt 3 — universal provider HTTP transport contract.
 */

import type { ProviderTransportError } from './errors.ts';

export const PROVIDER_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type ProviderHttpMethod = (typeof PROVIDER_HTTP_METHODS)[number];

export const PROVIDER_CONTENT_TYPES = [
  'application/json',
  'text/json',
  'text/plain',
  'text/csv',
  'application/xml',
  'text/xml',
  'application/x-www-form-urlencoded',
] as const;
export type ProviderContentType = (typeof PROVIDER_CONTENT_TYPES)[number] | '*';

export type ProviderHttpRequestContext = {
export type HttpProviderRequestContext = {
  readonly providerId: string;
  readonly requestId: string;
  readonly traceId?: string | undefined;
  readonly method: ProviderHttpMethod;
  readonly path: string;
  readonly query?: Readonly<Record<string, string | number | boolean>> | undefined;
  readonly headers?: Readonly<Record<string, string>> | undefined;
  readonly body?: string | undefined;
  readonly timeoutMs?: number | undefined;
  readonly expectedContentType?: ProviderContentType | undefined;
  readonly maximumResponseBytes?: number | undefined;
};

export type ProviderHttpResponseMetadata = {
export type HttpProviderResponseMetadata = {
  readonly providerId: string;
  readonly requestId: string;
  readonly traceId: string;
  readonly httpStatus: number;
  readonly durationMs: number;
  readonly contentType: string | null;
  readonly providerRequestId: string | null;
  readonly startedAtUtc: string;
  readonly finalUrl: string;
};

export type ProviderParsedBody =
  | { readonly format: 'json'; readonly value: unknown }
  | { readonly format: 'text'; readonly value: string }
  | { readonly format: 'raw'; readonly value: string };

export type ProviderHttpTransportResponse<T = unknown> = {
  readonly metadata: ProviderHttpResponseMetadata;
export type HttpProviderTransportResponse<T = unknown> = {
  readonly metadata: HttpProviderResponseMetadata;
  readonly body: ProviderParsedBody;
  readonly parsed: T | undefined;
};

export type ProviderHttpTransportSuccess<T> = {
  readonly ok: true;
  readonly value: ProviderHttpTransportResponse<T>;
};

export type ProviderHttpTransportFailure = {
export type HttpProviderTransportSuccess<T> = {
  readonly ok: true;
  readonly value: HttpProviderTransportResponse<T>;
};

export type HttpProviderTransportFailure = {
  readonly ok: false;
  readonly error: ProviderTransportError;
};

export type ProviderHttpTransportResult<T = unknown> =
  | ProviderHttpTransportSuccess<T>
  | ProviderHttpTransportFailure;

export type ProviderHttpTransport = {
  readonly transportId: string;
  request<T = unknown>(context: ProviderHttpRequestContext): Promise<ProviderHttpTransportResult<T>>;
};

/** @deprecated Use ProviderHttpRequestContext */
export type HttpProviderRequestContext = ProviderHttpRequestContext;
/** @deprecated Use ProviderHttpResponseMetadata */
export type HttpProviderResponseMetadata = ProviderHttpResponseMetadata;
/** @deprecated Use ProviderHttpTransportResponse */
export type HttpProviderTransportResponse<T = unknown> = ProviderHttpTransportResponse<T>;
/** @deprecated Use ProviderHttpTransportSuccess */
export type HttpProviderTransportSuccess<T> = ProviderHttpTransportSuccess<T>;
/** @deprecated Use ProviderHttpTransportFailure */
export type HttpProviderTransportFailure = ProviderHttpTransportFailure;
/** @deprecated Use ProviderHttpTransportResult */
export type HttpProviderTransportResult<T = unknown> = ProviderHttpTransportResult<T>;
/** @deprecated Use ProviderHttpTransport */
export type HttpProviderTransport = ProviderHttpTransport;
/** @deprecated Use ProviderHttpRequestContext */
export type ProviderRequestContext = ProviderHttpRequestContext;
/** @deprecated Use ProviderHttpResponseMetadata */
export type ProviderResponseMetadata = ProviderHttpResponseMetadata;
/** @deprecated Use ProviderHttpTransportResponse */
export type ProviderTransportResponse<T = unknown> = ProviderHttpTransportResponse<T>;
/** @deprecated Use ProviderHttpTransportResult */
export type ProviderTransportResult<T = unknown> = ProviderHttpTransportResult<T>;
/** @deprecated Use ProviderHttpTransportSuccess */
export type ProviderTransportSuccess<T> = ProviderHttpTransportSuccess<T>;
/** @deprecated Use ProviderHttpTransportFailure */
export type ProviderTransportFailure = ProviderHttpTransportFailure;
/** @deprecated Use ProviderHttpTransport */
export type ProviderTransport = ProviderHttpTransport;
export type HttpProviderTransportResult<T = unknown> =
  | HttpProviderTransportSuccess<T>
  | HttpProviderTransportFailure;

/** Governed outbound HTTP transport used by external provider adapters. */
export type HttpProviderTransport = {
  readonly transportId: string;
  request<T = unknown>(context: HttpProviderRequestContext): Promise<HttpProviderTransportResult<T>>;
};

export type ProviderHttpRequestContext = HttpProviderRequestContext;
export type ProviderHttpResponseMetadata = HttpProviderResponseMetadata;
export type ProviderHttpTransportResponse<T = unknown> = HttpProviderTransportResponse<T>;
export type ProviderHttpTransportSuccess<T> = HttpProviderTransportSuccess<T>;
export type ProviderHttpTransportFailure = HttpProviderTransportFailure;
export type ProviderHttpTransportResult<T = unknown> = HttpProviderTransportResult<T>;
/** @deprecated Use HttpProviderRequestContext */
export type ProviderHttpRequestContext = HttpProviderRequestContext;
/** @deprecated Use HttpProviderResponseMetadata */
export type ProviderHttpResponseMetadata = HttpProviderResponseMetadata;
/** @deprecated Use HttpProviderTransportResponse */
export type ProviderHttpTransportResponse<T = unknown> = HttpProviderTransportResponse<T>;
/** @deprecated Use HttpProviderTransportResult */
export type ProviderHttpTransportResult<T = unknown> = HttpProviderTransportResult<T>;
/** @deprecated Use HttpProviderTransportSuccess */
export type ProviderHttpTransportSuccess<T> = HttpProviderTransportSuccess<T>;
/** @deprecated Use HttpProviderTransportFailure */
export type ProviderHttpTransportFailure = HttpProviderTransportFailure;
/** @deprecated Use HttpProviderTransportResult */
export type ProviderHttpTransportResult<T = unknown> = HttpProviderTransportResult<T>;
/** @deprecated Use HttpProviderTransport */
export type ProviderHttpTransport = HttpProviderTransport;

/** @deprecated Use HttpProviderRequestContext */
export type ProviderRequestContext = HttpProviderRequestContext;
/** @deprecated Use HttpProviderResponseMetadata */
export type ProviderResponseMetadata = HttpProviderResponseMetadata;
/** @deprecated Use HttpProviderTransportResponse */
export type ProviderTransportResponse<T = unknown> = HttpProviderTransportResponse<T>;
/** @deprecated Use HttpProviderTransportResult */
export type ProviderTransportResult<T = unknown> = HttpProviderTransportResult<T>;
/** @deprecated Use HttpProviderTransportSuccess */
export type ProviderTransportSuccess<T> = HttpProviderTransportSuccess<T>;
/** @deprecated Use HttpProviderTransportFailure */
export type ProviderTransportFailure = HttpProviderTransportFailure;
/** @deprecated Use HttpProviderTransport */
export type ProviderTransport = HttpProviderTransport;
