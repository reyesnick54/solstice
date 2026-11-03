/**
 * HELIOS OS03 — deterministic submit/cancel/replace latency.
 */

import type { UtcInstant } from '@solstice/domain';

import { LATENCY_MODEL_VERSION } from './taxonomy.ts';

export type LatencyModelConfig = {
  readonly submitLatencyMs: number;
  readonly cancelLatencyMs: number;
  readonly replaceLatencyMs: number;
};

export const DEFAULT_LATENCY_MODEL: LatencyModelConfig = Object.freeze({
  submitLatencyMs: 5,
  cancelLatencyMs: 3,
  replaceLatencyMs: 4,
});

export function latencyAssumptionLabel(config: LatencyModelConfig): string {
  return `${LATENCY_MODEL_VERSION}:submit=${config.submitLatencyMs}ms;cancel=${config.cancelLatencyMs}ms;replace=${config.replaceLatencyMs}ms`;
}

export function addLatency(instant: UtcInstant, latencyMs: number): UtcInstant {
  const ms = Date.parse(instant);
  if (Number.isNaN(ms)) {
    return instant;
  }
  return new Date(ms + latencyMs).toISOString() as UtcInstant;
}

export function effectiveSubmitAt(submittedAt: UtcInstant, config: LatencyModelConfig): UtcInstant {
  return addLatency(submittedAt, config.submitLatencyMs);
}

export function effectiveCancelAt(requestedAt: UtcInstant, config: LatencyModelConfig): UtcInstant {
  return addLatency(requestedAt, config.cancelLatencyMs);
}

export function effectiveReplaceAt(requestedAt: UtcInstant, config: LatencyModelConfig): UtcInstant {
  return addLatency(requestedAt, config.replaceLatencyMs);
}

export function isActiveBy(asOf: UtcInstant, activeAt: UtcInstant | null): boolean {
  if (!activeAt) {
    return false;
  }
  return Date.parse(asOf) >= Date.parse(activeAt);
}

export function cancelEffectiveBy(asOf: UtcInstant, cancelEffectiveAt: UtcInstant | null): boolean {
  if (!cancelEffectiveAt) {
    return false;
  }
  return Date.parse(asOf) >= Date.parse(cancelEffectiveAt);
}
