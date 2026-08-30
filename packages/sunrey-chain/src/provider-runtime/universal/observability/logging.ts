/**
 * Structured provider logging with secret sanitization.
 */

import { StructuredLogSink } from '../../../ops/observability.ts';
import type { CircuitState } from '../types.ts';
import type { ProviderCacheFreshness, ProviderStructuredLog } from './types.ts';

const FORBIDDEN_LOG_KEYS = new Set([
  'apiKey',
  'api_key',
  'authorization',
  'password',
  'token',
  'secret',
  'privateKey',
  'pan',
  'cvv',
  'access_token',
]);

const FORBIDDEN_PATTERNS = [
  /bearer\s+[a-z0-9._~+/=-]{8,}/i,
  /sk_live_[a-z0-9]+/i,
  /api[_-]?key[=:]\s*\S+/i,
];

export class ProviderLogEmitter {
  readonly #sink: StructuredLogSink;

  constructor(sink: StructuredLogSink = new StructuredLogSink()) {
    this.#sink = sink;
  }

  sink(): StructuredLogSink {
    return this.#sink;
  }

  emit(input: {
    readonly providerId: string;
    readonly capability: string;
    readonly requestId: string;
    readonly statusCode: number | null;
    readonly durationMs: number;
    readonly retryCount: number;
    readonly circuitState: CircuitState;
    readonly cacheState: ProviderCacheFreshness['cacheState'];
    readonly result: ProviderStructuredLog['result'];
    readonly traceId: string;
  }): ProviderStructuredLog {
    const record: ProviderStructuredLog = Object.freeze({
      providerId: input.providerId,
      capability: input.capability,
      requestId: input.requestId,
      statusCode: input.statusCode,
      durationMs: input.durationMs,
      retryCount: input.retryCount,
      circuitState: input.circuitState,
      cacheState: input.cacheState,
      result: input.result,
      secretMaterialPresent: false as const,
    });
    assertLogSafe(record);
    this.#sink.emit({
      service: 'sunrey-provider-runtime',
      requestId: input.requestId,
      traceId: input.traceId,
      severity: input.result === 'success' ? 'INFO' : 'WARNING',
      eventCode: 'PROVIDER_REQUEST',
      message: `provider ${input.providerId} ${input.result}`,
      attributes: Object.freeze({
        providerId: input.providerId,
        capability: input.capability,
        statusCode: input.statusCode === null ? 'null' : String(input.statusCode),
        durationMs: String(input.durationMs),
        retryCount: String(input.retryCount),
        circuitState: input.circuitState,
        cacheState: input.cacheState,
        result: input.result,
      }),
    });
    return record;
  }
}

export function assertLogSafe(value: unknown, path = 'root'): void {
  if (value === null || value === undefined) {
    return;
  }
  if (typeof value === 'string') {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(value)) {
        throw new Error(`provider log contains forbidden material at ${path}`);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertLogSafe(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_LOG_KEYS.has(key)) {
        throw new Error(`provider log key ${key} is forbidden`);
      }
      assertLogSafe(inner, `${path}.${key}`);
    }
  }
}

export function sanitizeTraceAttributes(
  attributes: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (FORBIDDEN_LOG_KEYS.has(key)) {
      continue;
    }
    if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(value))) {
      out[key] = '[REDACTED]';
      continue;
    }
    out[key] = value.length > 128 ? `${value.slice(0, 125)}...` : value;
  }
  return out;
}
