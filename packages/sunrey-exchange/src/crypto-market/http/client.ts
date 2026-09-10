/**
 * Governed HTTP client for crypto market reference providers.
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
} from '../../../../provider-sdk/src/index.ts';
import type { CryptoMarketAdapterMode } from './mode.ts';
import { resolveCryptoMarketAdapterMode } from './mode.ts';
import type { CryptoMarketHttpEndpoint } from './endpoints.ts';

export type CryptoMarketHttpRequestResult<T> = {
  readonly ok: true;
  readonly data: T;
  readonly liveNetworkCallObserved: boolean;
} | {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
  readonly liveNetworkCallObserved: boolean;
};

export type CryptoMarketHttpClientOptions = {
  readonly mode?: CryptoMarketAdapterMode;
  readonly fetchFn?: FetchLike;
  readonly environment?: ProviderTransportEnvironment;
  readonly authResolver?: ProviderAuthResolver;
  readonly authStrategy?: ProviderAuthStrategy;
};

const DEFAULT_USER_AGENT = 'SunRey-Exchange/1.0 (+https://sunrey.com; crypto-market-reference)';

export function defaultCryptoMarketUserAgent(): string {
  return DEFAULT_USER_AGENT;
}

export class CryptoMarketHttpClient {
  readonly #mode: 'live' | 'simulation';
  readonly #fetchFn?: FetchLike;
  readonly #environment: ProviderTransportEnvironment;
  readonly #authResolver: ProviderAuthResolver;
  readonly #authStrategy: ProviderAuthStrategy;

  constructor(options: CryptoMarketHttpClientOptions = {}) {
    this.#mode = resolveCryptoMarketAdapterMode(options.mode);
    this.#fetchFn = options.fetchFn;
    this.#environment = options.environment ?? (options.fetchFn ? 'test' : this.#mode === 'live' ? 'preview' : 'test');
    this.#authResolver = options.authResolver ?? NO_AUTH_PROVIDER_RESOLVER;
    this.#authStrategy = options.authStrategy ?? { kind: 'none' };
  }

  get mode(): 'live' | 'simulation' {
    return this.#mode;
  }

  async getJson<T>(
    endpoint: CryptoMarketHttpEndpoint,
    pathSuffix: string,
    query?: Readonly<Record<string, string | number | boolean | undefined>>,
  ): Promise<CryptoMarketHttpRequestResult<T>> {
    if (this.#mode === 'simulation') {
      return {
        ok: false,
        code: 'SIMULATION_MODE',
        message: 'live HTTP disabled in simulation mode',
        liveNetworkCallObserved: false,
      };
    }

    const transport = createFetchProviderTransport({
      config: createProviderTransportConfig({
        serviceVersion: 'crypto-market-reference/1',
        environment: this.#environment,
        endpoint: {
          providerId: endpoint.providerId,
          baseUrl: endpoint.baseUrl,
          defaultTimeoutMs: endpoint.timeoutMs ?? 15_000,
        },
      }),
      authResolver: this.#authResolver,
      authStrategy: this.#authStrategy,
      fetchFn: this.#fetchFn,
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

  #mapTransportResult<T>(response: HttpProviderTransportResult<unknown>): CryptoMarketHttpRequestResult<T> {
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
