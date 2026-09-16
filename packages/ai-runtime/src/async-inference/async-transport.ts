import type { AiCancellationToken } from '../types.ts';
import type { HttpsInferenceTransport, HttpsTransportRequest, HttpsTransportResult } from '../transport.ts';

export type AsyncHttpsTransportRequest = HttpsTransportRequest & {
  readonly signal?: AbortSignal;
};

export type AsyncHttpsInferenceTransport = {
  readonly kind: 'ASYNC_HTTPS_INFERENCE_TRANSPORT';
  readonly liveConnectivity: boolean;
  exchangeAsync(request: AsyncHttpsTransportRequest): Promise<HttpsTransportResult>;
  abort?(correlationId: string): Promise<{ readonly aborted: boolean; readonly providerMayContinue: boolean }>;
};

export type AsyncTransportOptions = {
  readonly delayMs?: number;
  readonly abortable?: boolean;
};

/**
 * Wraps the canonical synchronous HTTPS transport in a non-blocking Promise
 * boundary. Production preview may still use curl underneath; callers await
 * without blocking the event loop beyond one worker turn.
 */
export class AsyncSyncHttpsTransportAdapter implements AsyncHttpsInferenceTransport {
  readonly kind = 'ASYNC_HTTPS_INFERENCE_TRANSPORT' as const;
  readonly liveConnectivity: boolean;
  private readonly inner: HttpsInferenceTransport;
  private readonly options: AsyncTransportOptions;
  private readonly inflight = new Map<string, { readonly cancel: AiCancellationToken; readonly started: number }>();

  constructor(inner: HttpsInferenceTransport, options: AsyncTransportOptions = {}) {
    this.inner = inner;
    this.liveConnectivity = inner.liveConnectivity;
    this.options = options;
  }

  exchangeAsync(request: AsyncHttpsTransportRequest): Promise<HttpsTransportResult> {
    const cancelToken: AiCancellationToken = request.cancel ?? { cancelled: false, cancel() { this.cancelled = true; } };
    if (request.signal?.aborted || cancelToken.cancelled) {
      return Promise.resolve({
        ok: false,
        code: 'MODEL_CANCELLED',
        detail: 'request was cancelled before dispatch',
        retryable: false,
        status: null,
      });
    }
    this.inflight.set(request.correlationId, { cancel: cancelToken, started: Date.now() });
    const delay = this.options.delayMs ?? 0;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (cancelToken.cancelled || request.signal?.aborted) {
          this.inflight.delete(request.correlationId);
          resolve({
            ok: false,
            code: 'MODEL_CANCELLED',
            detail: 'request was cancelled before dispatch',
            retryable: false,
            status: null,
          });
          return;
        }
        const result = this.inner.exchange({ ...request, cancel: cancelToken });
        this.inflight.delete(request.correlationId);
        resolve(result);
      }, delay);
      request.signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        cancelToken.cancel();
        this.inflight.delete(request.correlationId);
        resolve({
          ok: false,
          code: 'MODEL_CANCELLED',
          detail: 'request was cancelled in flight',
          retryable: false,
          status: null,
        });
      }, { once: true });
    });
  }

  async abort(correlationId: string): Promise<{ readonly aborted: boolean; readonly providerMayContinue: boolean }> {
    const inflight = this.inflight.get(correlationId);
    if (!inflight) {
      return { aborted: false, providerMayContinue: false };
    }
    inflight.cancel.cancel();
    if (this.options.abortable === false) {
      return { aborted: false, providerMayContinue: true };
    }
    this.inflight.delete(correlationId);
    return { aborted: true, providerMayContinue: this.inner.liveConnectivity };
  }
}

export class FixtureAsyncHttpsTransport implements AsyncHttpsInferenceTransport {
  readonly kind = 'ASYNC_HTTPS_INFERENCE_TRANSPORT' as const;
  readonly liveConnectivity = false as const;
  readonly observed: AsyncHttpsTransportRequest[] = [];
  private readonly adapter: AsyncSyncHttpsTransportAdapter;

  constructor(inner: HttpsInferenceTransport, options: AsyncTransportOptions = {}) {
    this.adapter = new AsyncSyncHttpsTransportAdapter(inner, options);
  }

  exchangeAsync(request: AsyncHttpsTransportRequest): Promise<HttpsTransportResult> {
    this.observed.push(request);
    return this.adapter.exchangeAsync(request);
  }

  abort(correlationId: string): Promise<{ readonly aborted: boolean; readonly providerMayContinue: boolean }> {
    return this.adapter.abort(correlationId);
  }
}
