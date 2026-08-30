/**
 * Wave 1 Prompt 3 — universal provider HTTP transport contract.
 *
 * Vendor-neutral outbound transport for external provider adapters.
 * Not a second provider runtime, ledger, Kernel, or Execution Authority.
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

export type ProviderRequestContext = {
  readonly providerId: string;
  readonly requestId: string;
  readonly traceId?: string | undefined;
  readonly method: ProviderHttpMethod;
  /** Path relative to the configured provider base URL. Must start with /. */
  readonly path: string;
  readonly query?: Readonly<Record<string, string | number | boolean>> | undefined;
  readonly headers?: Readonly<Record<string, string>> | undefined;
  readonly body?: string | undefined;
  readonly timeoutMs?: number | undefined;
  readonly expectedContentType?: ProviderContentType | undefined;
  readonly maximumResponseBytes?: number | undefined;
};

export type ProviderResponseMetadata = {
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

export type ProviderTransportResponse<T = unknown> = {
  readonly metadata: ProviderResponseMetadata;
  readonly body: ProviderParsedBody;
  readonly parsed: T | undefined;
};

export type ProviderTransportSuccess<T> = {
  readonly ok: true;
  readonly value: ProviderTransportResponse<T>;
};

export type ProviderTransportFailure = {
  readonly ok: false;
  readonly error: ProviderTransportError;
};

export type ProviderTransportResult<T = unknown> = ProviderTransportSuccess<T> | ProviderTransportFailure;

/**
 * Shared outbound HTTP transport used by all SunRey provider adapters.
 */
export type ProviderTransport = {
  readonly transportId: string;
  request<T = unknown>(context: ProviderRequestContext): Promise<ProviderTransportResult<T>>;
};
