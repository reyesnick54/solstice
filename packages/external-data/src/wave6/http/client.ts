/**
 * Governed HTTP client for Wave 6 opportunity providers.
 */

import { randomUUID } from 'node:crypto';

import { DATA_MODE } from '../../../../config/src/data-mode.ts';
import {
  createFetchProviderTransport,
  createProviderTransportConfig,
  NO_AUTH_PROVIDER_RESOLVER,
  type FetchLike,
  type HttpProviderTransportResult,
  type ProviderTransportEnvironment,
} from '../../../../provider-sdk/src/index.ts';
import type { ProviderExecutionProvenance } from '../../certification/types.ts';
import { deriveExecutionProvenance } from '../../certification/types.ts';

export type OpportunityAdapterMode = 'auto' | 'live' | 'simulation';

export type OpportunityHttpEndpoint = {
  readonly providerId: string;
  readonly baseUrl: string;
  readonly path: string;
  readonly userAgent: string;
  readonly timeoutMs?: number;
};

export type OpportunityHttpRequestResult<T> = {
  readonly ok: true;
  readonly data: T;
  readonly provenance: ProviderExecutionProvenance;
} | {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
  readonly provenance: ProviderExecutionProvenance;
};

export type OpportunityHttpClientOptions = {
  readonly mode?: OpportunityAdapterMode;
  readonly fetchFn?: FetchLike;
  readonly environment?: ProviderTransportEnvironment;
};

const DEFAULT_USER_AGENT = 'SunRey-ExternalData/1.0 (+https://sunrey.com; provider-certification)';

export function resolveOpportunityAdapterMode(
  explicit?: OpportunityAdapterMode,
  dataMode: typeof DATA_MODE = DATA_MODE,
): 'live' | 'simulation' {
  if (explicit === 'live') {
    return 'live';
  }
  if (explicit === 'simulation') {
    return 'simulation';
  }
  return dataMode === 'live' ? 'live' : 'simulation';
}

export class OpportunityHttpClient {
  readonly #mode: 'live' | 'simulation';
  readonly #fetchFn: FetchLike;
  readonly #environment: ProviderTransportEnvironment;

  constructor(options: OpportunityHttpClientOptions = {}) {
    this.#mode = resolveOpportunityAdapterMode(options.mode);
    this.#fetchFn = options.fetchFn ?? fetch.bind(globalThis);
    this.#environment = options.environment ?? (options.fetchFn ? 'test' : this.#mode === 'live' ? 'preview' : 'test');
  }

  get mode(): 'live' | 'simulation' {
    return this.#mode;
  }

  async getJson<T>(
    endpoint: OpportunityHttpEndpoint,
    query?: Readonly<Record<string, string | number | boolean | undefined>>,
  ): Promise<OpportunityHttpRequestResult<T>> {
    if (this.#mode === 'simulation') {
      return {
        ok: false,
        code: 'SIMULATION_MODE',
        message: 'live HTTP disabled in simulation mode',
        provenance: deriveExecutionProvenance({
          simulated: true,
          liveNetworkCallObserved: false,
          productionEndpointUsed: false,
        }),
      };
    }

    const started = Date.now();
    const transport = createFetchProviderTransport({
      config: createProviderTransportConfig({
        serviceVersion: 'wave6-opportunity/1',
        environment: this.#environment,
        endpoint: {
          providerId: endpoint.providerId,
          baseUrl: endpoint.baseUrl,
          defaultTimeoutMs: endpoint.timeoutMs ?? 15_000,
        },
      }),
      authResolver: NO_AUTH_PROVIDER_RESOLVER,
      authStrategy: { kind: 'none' },
      fetchFn: this.#fetchFn ?? fetch.bind(globalThis),
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
      path: endpoint.path,
      query: queryParams,
      headers: {
        Accept: 'application/json',
        'User-Agent': endpoint.userAgent,
      },
    });

    const latencyMs = Date.now() - started;
    return this.#mapTransportResult(response, latencyMs);
  }

  #mapTransportResult<T>(
    response: HttpProviderTransportResult<unknown>,
    latencyMs: number,
  ): OpportunityHttpRequestResult<T> {
    if (!response.ok) {
      const code = mapTransportErrorCode(response.error);
      const provenance = deriveExecutionProvenance({
        simulated: false,
        liveNetworkCallObserved: true,
        productionEndpointUsed: true,
        httpStatus: response.error.httpStatus ?? null,
        latencyMs,
      });
      return { ok: false, code, message: response.error.message, provenance };
    }

    const provenance = deriveExecutionProvenance({
      simulated: false,
      liveNetworkCallObserved: true,
      productionEndpointUsed: true,
      httpStatus: response.value.metadata.httpStatus,
      latencyMs,
    });

    if (response.value.metadata.httpStatus === 429) {
      return { ok: false, code: 'RATE_LIMITED', message: '429 Too Many Requests', provenance };
    }
    if (response.value.metadata.httpStatus >= 400) {
      return {
        ok: false,
        code: 'HTTP_ERROR',
        message: `HTTP ${response.value.metadata.httpStatus}`,
        provenance,
      };
    }

    const payload = response.value.parsed ?? response.value.body.value;
    return { ok: true, data: payload as T, provenance };
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

export function defaultOpportunityUserAgent(): string {
  return DEFAULT_USER_AGENT;
}
