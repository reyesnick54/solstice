/**
 * Simulated provider transport for tests — no public internet.
 */

import type {
  ReliabilityTransport,
  ReliabilityTransportRequest,
  ReliabilityTransportResponse,
} from './reliability-types.ts';

export type SimulatedResponse =
  | ReliabilityTransportResponse
  | { readonly status: number; readonly headers?: Readonly<Record<string, string>>; readonly body?: unknown }
  | { readonly error: 'timeout' | 'network' }
  | (() => ReliabilityTransportResponse | Promise<ReliabilityTransportResponse>);

export class SimulatedProviderTransport implements ReliabilityTransport {
  readonly providerId: string;
  readonly calls: ReliabilityTransportRequest[] = [];
  private readonly script: SimulatedResponse[];
  private index = 0;
  private readonly delayMs: number;

  constructor(providerId: string, script: readonly SimulatedResponse[] = [], delayMs = 0) {
    this.providerId = providerId;
    this.script = [...script];
    this.delayMs = delayMs;
  }

  async execute(
    request: ReliabilityTransportRequest,
    options?: { readonly signal?: AbortSignal; readonly deadlineMs?: number },
  ): Promise<ReliabilityTransportResponse> {
    this.calls.push(request);
    if (options?.signal?.aborted) {
      throw new Error('aborted');
    }
    if (this.delayMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, this.delayMs);
        options?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('aborted'));
        });
      });
    }
    const entry = this.script[this.index] ?? { status: 200, body: {} };
    this.index += 1;
    if (typeof entry === 'function') {
      return entry();
    }
    if ('error' in entry) {
      if (entry.error === 'timeout') {
        await new Promise<void>(() => {});
      }
      throw new Error(entry.error);
    }
    return Object.freeze({
      status: entry.status,
      headers: Object.freeze(entry.headers ?? {}),
      body: entry.body ?? {},
    });
  }
}

export function successResponse(body: unknown = {}): SimulatedResponse {
  return Object.freeze({ status: 200, headers: Object.freeze({}), body });
}

export function errorResponse(
  status: number,
  headers: Readonly<Record<string, string>> = {},
  body: unknown = {},
): SimulatedResponse {
  return Object.freeze({ status, headers: Object.freeze(headers), body });
}
