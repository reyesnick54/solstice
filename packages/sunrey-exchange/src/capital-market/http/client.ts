/**
 * Governed HTTP client for capital market reference providers.
 *
 * No fixture fallback. External failures surface as unavailable/degraded.
 */

import { randomUUID } from 'node:crypto';

import {
  createFetchProviderTransport,
  createProviderTransportConfig,
  NO_AUTH_PROVIDER_RESOLVER,
  type FetchLike,
  type HttpProviderTransportResult,
  type ProviderAuthResolver,
  type ProviderAuthStrategy,
  type ProviderTransportEnvironment,
} from '@solstice/provider-sdk';
import type { CapitalMarketHttpEndpoint } from './endpoints.ts';

export type CapitalMarketHttpRequestResult<T> =
  | { readonly ok: true; readonly data: T; readonly liveNetworkCallObserved: boolean }
  | { readonly ok: false; readonly code: string; readonly message: string; readonly liveNetworkCallObserved: boolean };

export type CapitalMarketHttpClientOptions = {
  readonly fetchFn?: FetchLike;
  readonly environment?: ProviderTransportEnvironment;
  readonly authResolver?: ProviderAuthResolver;
  readonly authStrategy?: ProviderAuthStrategy;
  readonly disabled?: boolean;
};

export class CapitalMarketHttpClient {
  readonly #fetchFn: FetchLike | undefined;
  readonly #environment: ProviderTransportEnvironment;
  readonly #authResolver: ProviderAuthResolver;
  readonly #authStrategy: ProviderAuthStrategy;
  readonly #disabled: boolean;

  constructor(options: CapitalMarketHttpClientOptions = {}) {
    this.#fetchFn = options.fetchFn;
    this.#environment = options.environment ?? (options.fetchFn ? 'test' : 'preview');
    this.#authResolver = options.authResolver ?? NO_AUTH_PROVIDER_RESOLVER;
    this.#authStrategy = options.authStrategy ?? { kind: 'none' };
    this.#disabled = options.disabled ?? false;
  }

  async getJson<T>(
    endpoint: CapitalMarketHttpEndpoint,
    pathSuffix: string,
    query?: Readonly<Record<string, string | number | boolean | undefined>>,
  ): Promise<CapitalMarketHttpRequestResult<T>> {
    if (this.#disabled) {
      return {
        ok: false,
        code: 'PROVIDER_DISABLED',
        message: 'capital market HTTP client disabled',
        liveNetworkCallObserved: false,
      };
    }

    const transport = createFetchProviderTransport({
      config: createProviderTransportConfig({
        serviceVersion: 'capital-market-reference/1',
        environment: this.#environment,
        endpoint: {
          providerId: endpoint.providerId,
          baseUrl: endpoint.baseUrl,
          defaultTimeoutMs: endpoint.timeoutMs,
        },
      }),
      authResolver: this.#authResolver,
      authStrategy: this.#authStrategy,
      ...(this.#fetchFn ? { fetchFn: this.#fetchFn } : {}),
    });

    const queryParams: Record<string, string> = {};
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          queryParams[key] = String(value);
        }
      }
    }

    const response = await transport.request<unknown>({
      providerId: endpoint.providerId,
      requestId: randomUUID(),
      method: 'GET',
      path: `${endpoint.path}${pathSuffix}`,
      query: queryParams,
      headers: {
        Accept: 'application/json',
        'User-Agent': endpoint.userAgent,
      },
    });

    return this.#mapTransportResult(response);
  }

  #mapTransportResult<T>(response: HttpProviderTransportResult<unknown>): CapitalMarketHttpRequestResult<T> {
    if (!response.ok) {
      return {
        ok: false,
        code: mapTransportErrorCode(response.error),
        message: response.error.message,
        liveNetworkCallObserved: true,
      };
    }

    if (response.value.metadata.httpStatus === 429) {
      return {
        ok: false,
        code: 'RATE_LIMITED',
        message: '429 Too Many Requests',
        liveNetworkCallObserved: true,
      };
    }
    if (response.value.metadata.httpStatus === 401 || response.value.metadata.httpStatus === 403) {
      return {
        ok: false,
        code: 'AUTHENTICATION_FAILED',
        message: `HTTP ${response.value.metadata.httpStatus}`,
        liveNetworkCallObserved: true,
      };
    }
    if (response.value.metadata.httpStatus >= 400) {
      return {
        ok: false,
        code: 'HTTP_ERROR',
        message: `HTTP ${response.value.metadata.httpStatus}`,
        liveNetworkCallObserved: true,
      };
    }

    const payload = response.value.parsed ?? response.value.body.value;
    return { ok: true, data: payload as T, liveNetworkCallObserved: true };
  }
}

function mapTransportErrorCode(error: { readonly kind: string }): string {
  switch (error.kind) {
    case 'ProviderRateLimitError':
      return 'RATE_LIMITED';
    case 'ProviderTimeoutError':
      return 'TIMEOUT';
    case 'ProviderServerError':
      return 'HTTP_ERROR';
    case 'ProviderInvalidResponseError':
      return 'INVALID_PAYLOAD';
    case 'ProviderAuthenticationError':
      return 'AUTHENTICATION_FAILED';
    case 'ProviderNetworkError':
      return 'NETWORK_ERROR';
    default:
      return 'HTTP_ERROR';
  }
}
