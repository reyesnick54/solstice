/**
 * Metrics hooks for Prompt 7 observability integration.
 */

import type { CircuitState } from './types.ts';

export const PROVIDER_METRIC_NAMES = Object.freeze([
  'provider_requests_total',
  'provider_request_duration',
  'provider_errors_total',
  'provider_retries_total',
  'provider_rate_limited_total',
  'provider_circuit_state',
  'provider_circuit_open_total',
] as const);

export type ProviderMetricName = (typeof PROVIDER_METRIC_NAMES)[number];

export type ProviderMetricLabels = {
  readonly provider_id: string;
  readonly method?: string;
  readonly status?: string;
  readonly classification?: string;
};

export type ProviderMetricsRecorder = {
  readonly increment: (name: ProviderMetricName, labels?: ProviderMetricLabels, value?: number) => void;
  readonly observe: (name: ProviderMetricName, value: number, labels?: ProviderMetricLabels) => void;
  readonly setGauge: (name: ProviderMetricName, value: number, labels?: ProviderMetricLabels) => void;
};

type MetricEvent =
  | { readonly kind: 'increment'; readonly name: ProviderMetricName; readonly labels: ProviderMetricLabels; readonly value: number }
  | { readonly kind: 'observe'; readonly name: ProviderMetricName; readonly labels: ProviderMetricLabels; readonly value: number }
  | { readonly kind: 'gauge'; readonly name: ProviderMetricName; readonly labels: ProviderMetricLabels; readonly value: number };

export class InMemoryProviderMetrics implements ProviderMetricsRecorder {
  readonly events: MetricEvent[] = [];

  increment(name: ProviderMetricName, labels: ProviderMetricLabels = { provider_id: 'unknown' }, value = 1): void {
    this.events.push(Object.freeze({ kind: 'increment', name, labels, value }));
  }

  observe(name: ProviderMetricName, value: number, labels: ProviderMetricLabels = { provider_id: 'unknown' }): void {
    this.events.push(Object.freeze({ kind: 'observe', name, labels, value }));
  }

  setGauge(name: ProviderMetricName, value: number, labels: ProviderMetricLabels = { provider_id: 'unknown' }): void {
    this.events.push(Object.freeze({ kind: 'gauge', name, labels, value }));
  }

  count(name: ProviderMetricName): number {
    return this.events
      .filter((event) => event.kind === 'increment' && event.name === name)
      .reduce((sum, event) => sum + event.value, 0);
  }
}

export const noopProviderMetrics: ProviderMetricsRecorder = Object.freeze({
  increment() {},
  observe() {},
  setGauge() {},
});

export function circuitStateGaugeValue(state: CircuitState): number {
  switch (state) {
    case 'CLOSED':
      return 0;
    case 'HALF_OPEN':
      return 1;
    case 'OPEN':
      return 2;
  }
}

export function recordRequestStart(recorder: ProviderMetricsRecorder, providerId: string, method: string): void {
  recorder.increment('provider_requests_total', { provider_id: providerId, method });
}

export function recordRequestDuration(
  recorder: ProviderMetricsRecorder,
  providerId: string,
  method: string,
  durationMs: number,
): void {
  recorder.observe('provider_request_duration', durationMs, { provider_id: providerId, method });
}

export function recordProviderError(
  recorder: ProviderMetricsRecorder,
  providerId: string,
  classification: string,
): void {
  recorder.increment('provider_errors_total', { provider_id: providerId, classification });
}

export function recordRetry(recorder: ProviderMetricsRecorder, providerId: string): void {
  recorder.increment('provider_retries_total', { provider_id: providerId });
}

export function recordRateLimited(recorder: ProviderMetricsRecorder, providerId: string): void {
  recorder.increment('provider_rate_limited_total', { provider_id: providerId });
}

export function recordCircuitState(
  recorder: ProviderMetricsRecorder,
  providerId: string,
  state: CircuitState,
): void {
  recorder.setGauge('provider_circuit_state', circuitStateGaugeValue(state), { provider_id: providerId });
  if (state === 'OPEN') {
    recorder.increment('provider_circuit_open_total', { provider_id: providerId });
  }
}
