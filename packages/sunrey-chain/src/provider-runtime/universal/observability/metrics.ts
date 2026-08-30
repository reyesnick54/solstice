/**
 * Provider metrics compatible with the existing ops MetricRegistry.
 */

import { MetricRegistry } from '../../../ops/observability.ts';
import { lowCardinalityLabels } from '../../../ops/privacy.ts';
import type { ProviderCategory } from '../types.ts';
import type { ProviderMetricName } from './types.ts';

export type ProviderMetricLabels = {
  readonly provider_id: string;
  readonly category: ProviderCategory;
  readonly capability?: string;
  readonly environment?: string;
  readonly result?: 'success' | 'failure' | 'timeout' | 'rate_limited';
  readonly error_class?: string;
};

export class ProviderMetricsCollector {
  readonly #registry: MetricRegistry;
  readonly #counters = new Map<string, bigint>();
  readonly #circuitOpen = new Map<string, boolean>();

  constructor(registry: MetricRegistry = new MetricRegistry()) {
    this.#registry = registry;
  }

  registry(): MetricRegistry {
    return this.#registry;
  }

  recordRequest(input: {
    readonly labels: ProviderMetricLabels;
    readonly durationMs: number;
    readonly result: 'success' | 'failure' | 'timeout' | 'rate_limited';
    readonly errorClass?: string;
  }): void {
    const labels = safeLabels(input.labels, input.result, input.errorClass);
    this.#increment('provider_requests_total', labels);
    this.#registry.observe(
      'provider_request_duration_seconds',
      BigInt(Math.max(0, Math.round(input.durationMs))),
      labels,
    );
    if (input.result === 'failure') {
      this.#increment('provider_errors_total', labels);
    }
    if (input.result === 'timeout') {
      this.#increment('provider_timeout_total', labels);
    }
    if (input.result === 'rate_limited') {
      this.#increment('provider_rate_limit_events_total', labels);
    }
  }

  recordRetry(labels: ProviderMetricLabels): void {
    this.#increment('provider_retries_total', safeLabels(labels));
  }

  recordCircuitOpen(providerId: string, category: ProviderCategory, open: boolean): void {
    const key = `${providerId}:${open}`;
    const previous = this.#circuitOpen.get(providerId) ?? false;
    if (open && !previous) {
      this.#increment('provider_circuit_open_total', safeLabels({ provider_id: providerId, category }));
    }
    this.#circuitOpen.set(providerId, open);
    this.#registry.observe(
      'provider_circuit_open',
      open ? 1n : 0n,
      safeLabels({ provider_id: providerId, category }),
    );
    void key;
  }

  recordCacheHit(labels: ProviderMetricLabels): void {
    this.#increment('provider_cache_hits_total', safeLabels(labels));
  }

  recordCacheMiss(labels: ProviderMetricLabels): void {
    this.#increment('provider_cache_misses_total', safeLabels(labels));
  }

  recordCacheStaleServed(labels: ProviderMetricLabels): void {
    this.#increment('provider_cache_stale_served_total', safeLabels(labels));
  }

  recordRefreshSuccess(labels: ProviderMetricLabels): void {
    this.#increment('provider_refresh_success_total', safeLabels(labels));
  }

  recordRefreshFailure(labels: ProviderMetricLabels): void {
    this.#increment('provider_refresh_failure_total', safeLabels(labels));
  }

  recordDataInvalid(labels: ProviderMetricLabels): void {
    this.#increment('provider_data_invalid_total', safeLabels(labels));
  }

  recordDataStale(labels: ProviderMetricLabels): void {
    this.#increment('provider_data_stale_total', safeLabels(labels));
  }

  counter(name: ProviderMetricName, labels: ProviderMetricLabels): bigint {
    return this.#counters.get(counterKey(name, safeLabels(labels))) ?? 0n;
  }

  prometheusText(): string {
    return this.#registry.prometheusText();
  }

  #increment(
    name: ProviderMetricName,
    labels: Record<string, string>,
    delta: bigint = 1n,
  ): void {
    const key = counterKey(name, labels);
    const next = (this.#counters.get(key) ?? 0n) + delta;
    this.#counters.set(key, next);
    this.#registry.observe(name, next, labels);
  }
}

function safeLabels(
  labels: ProviderMetricLabels,
  result?: ProviderMetricLabels['result'],
  errorClass?: string,
): Record<string, string> {
  const raw: Record<string, string> = {
    provider_id: labels.provider_id,
    category: labels.category,
  };
  if (labels.capability) {
    raw.capability = labels.capability;
  }
  if (labels.environment) {
    raw.environment = labels.environment;
  }
  if (result) {
    raw.result = result;
  }
  if (errorClass) {
    raw.error_class = errorClass;
  }
  return lowCardinalityLabels(raw);
}

function counterKey(name: string, labels: Record<string, string>): string {
  const parts = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`);
  return `${name}|${parts.join(',')}`;
}
