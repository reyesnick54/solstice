/**
 * Governed HTTP client for Access Live Provider Fabric.
 * Supports timeouts, bounded retry, 429/Retry-After, and injectable fetch for tests.
 */

import { circuitAllows, circuitRecordFailure, circuitRecordSuccess } from './circuit-breaker.ts';

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type LiveHttpRequest = {
  readonly providerId: string;
  readonly method: 'GET' | 'POST';
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
};

export type LiveHttpResponse<T> =
  | { readonly ok: true; readonly status: number; readonly data: T; readonly latencyMs: number }
  | { readonly ok: false; readonly status: number | null; readonly code: string; readonly message: string; readonly latencyMs: number };

export type LiveHttpClientOptions = {
  readonly fetchFn?: FetchLike;
  readonly defaultTimeoutMs?: number;
  readonly defaultMaxRetries?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt: number, retryAfterHeader: string | null): number {
  if (retryAfterHeader) {
    const seconds = Number.parseInt(retryAfterHeader, 10);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, 30_000);
    }
  }
  return Math.min(250 * 2 ** attempt, 4_000);
}

export class LiveProviderHttpClient {
  readonly #fetchFn: FetchLike;
  readonly #defaultTimeoutMs: number;
  readonly #defaultMaxRetries: number;

  constructor(options: LiveHttpClientOptions = {}) {
    this.#fetchFn = options.fetchFn ?? fetch;
    this.#defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#defaultMaxRetries = options.defaultMaxRetries ?? DEFAULT_MAX_RETRIES;
  }

  async requestJson<T>(request: LiveHttpRequest): Promise<LiveHttpResponse<T>> {
    if (!circuitAllows(request.providerId)) {
      return {
        ok: false,
        status: null,
        code: 'CIRCUIT_OPEN',
        message: `${request.providerId} circuit breaker is open`,
        latencyMs: 0,
      };
    }

    const timeoutMs = request.timeoutMs ?? this.#defaultTimeoutMs;
    const maxRetries = request.maxRetries ?? this.#defaultMaxRetries;
    let attempt = 0;
    const started = Date.now();

    while (attempt <= maxRetries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await this.#fetchFn(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (response.status === 429 && attempt < maxRetries) {
          const retryAfter = response.headers.get('retry-after');
          await sleep(retryDelayMs(attempt, retryAfter));
          attempt += 1;
          continue;
        }

        if (response.status >= 500 && attempt < maxRetries) {
          await sleep(retryDelayMs(attempt, null));
          attempt += 1;
          continue;
        }

        const latencyMs = Date.now() - started;
        if (!response.ok) {
          circuitRecordFailure(request.providerId);
          const text = await response.text().catch(() => '');
          return {
            ok: false,
            status: response.status,
            code: response.status === 429 ? 'RATE_LIMITED' : 'HTTP_ERROR',
            message: text.slice(0, 200) || `HTTP ${response.status}`,
            latencyMs,
          };
        }

        const data = (await response.json()) as T;
        circuitRecordSuccess(request.providerId);
        return { ok: true, status: response.status, data, latencyMs };
      } catch (error) {
        clearTimeout(timer);
        const latencyMs = Date.now() - started;
        const aborted = error instanceof Error && error.name === 'AbortError';
        if (attempt < maxRetries) {
          await sleep(retryDelayMs(attempt, null));
          attempt += 1;
          continue;
        }
        circuitRecordFailure(request.providerId);
        return {
          ok: false,
          status: null,
          code: aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
          message: aborted ? 'request timed out' : error instanceof Error ? error.message : 'network error',
          latencyMs,
        };
      }
    }

    circuitRecordFailure(request.providerId);
    return {
      ok: false,
      status: null,
      code: 'EXHAUSTED',
      message: 'retries exhausted',
      latencyMs: Date.now() - started,
    };
  }
}
