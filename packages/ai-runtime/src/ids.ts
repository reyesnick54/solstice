import { createHash } from 'node:crypto';

import { type Brand, brandAs } from '../../domain/src/brand.ts';

export type AiProviderId = Brand<string, 'AiProviderId'>;
export type AiRequestId = Brand<string, 'AiRequestId'>;
export type AiTraceId = Brand<string, 'AiTraceId'>;
export type AiToolIntentId = Brand<string, 'AiToolIntentId'>;

function digest(material: string): string {
  return createHash('sha256').update(material).digest('hex');
}

export function asAiProviderId(value: string): AiProviderId {
  if (value.length === 0) {
    throw new TypeError('AiProviderId must be non-empty');
  }
  return brandAs<string, 'AiProviderId'>(value);
}

export function asAiRequestId(value: string): AiRequestId {
  if (value.length === 0) {
    throw new TypeError('AiRequestId must be non-empty');
  }
  return brandAs<string, 'AiRequestId'>(value);
}

export function asAiTraceId(value: string): AiTraceId {
  if (value.length === 0) {
    throw new TypeError('AiTraceId must be non-empty');
  }
  return brandAs<string, 'AiTraceId'>(value);
}

export function asAiToolIntentId(value: string): AiToolIntentId {
  if (value.length === 0) {
    throw new TypeError('AiToolIntentId must be non-empty');
  }
  return brandAs<string, 'AiToolIntentId'>(value);
}

export function requestIdFor(seed: string): AiRequestId {
  return asAiRequestId(`air_${digest(`request:${seed}`).slice(0, 24)}`);
}

export function traceIdFor(requestId: string, startedAt: string): AiTraceId {
  return asAiTraceId(`ait_${digest(`trace:${requestId}:${startedAt}`).slice(0, 24)}`);
}

export function toolIntentIdFor(requestId: string, name: string, index: number): AiToolIntentId {
  return asAiToolIntentId(`ati_${digest(`tool:${requestId}:${name}:${String(index)}`).slice(0, 24)}`);
}

export function sha256Canonical(value: string): string {
  return digest(value);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const item = record[key];
      out[key] = typeof item === 'bigint' ? item.toString() : sortValue(item);
    }
    return out;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}
