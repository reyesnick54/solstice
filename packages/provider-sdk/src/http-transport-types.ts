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

export type HttpProviderTransportResponse<T = unknown> = {
  readonly metadata: HttpProviderResponseMetadata;
  readonly body: ProviderParsedBody;
  readonly parsed: T | undefined;
};

export type HttpProviderTransportSuccess<T> = {
  readonly ok: true;
  readonly value: HttpProviderTransportResponse<T>;
};

export type HttpProviderTransportFailure = {
  readonly ok: false;
  readonly error: ProviderTransportError;
};

export type HttpProviderTransportResult<T = unknown> =
  | HttpProviderTransportSuccess<T>
  | HttpProviderTransportFailure;

/** Governed outbound HTTP transport used by external provider adapters. */
export type HttpProviderTransport = {
  readonly transportId: string;
  request<T = unknown>(context: HttpProviderRequestContext): Promise<HttpProviderTransportResult<T>>;
};

/** @deprecated Use HttpProviderRequestContext */
export type ProviderHttpRequestContext = HttpProviderRequestContext;
/** @deprecated Use HttpProviderResponseMetadata */
export type ProviderHttpResponseMetadata = HttpProviderResponseMetadata;
/** @deprecated Use HttpProviderTransportResponse */
export type ProviderHttpTransportResponse<T = unknown> = HttpProviderTransportResponse<T>;
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
