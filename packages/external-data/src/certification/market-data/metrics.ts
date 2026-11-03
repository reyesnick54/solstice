/**
 * Operational metrics for external market-data certification runtime.
 */

import { InMemoryProviderMetrics, type ProviderMetricsRecorder } from '../../../../provider-sdk/src/metrics.ts';

export const MARKET_DATA_CERT_METRIC_NAMES = Object.freeze([
  'market_data_certification_runs_total',
  'market_data_certification_proofs_failed_total',
  'market_data_certification_fetch_failures_total',
  'market_data_certification_degraded_total',
] as const);

export type MarketDataCertMetricName = (typeof MARKET_DATA_CERT_METRIC_NAMES)[number];

export type MarketDataCertificationMetrics = {
  readonly recorder: ProviderMetricsRecorder;
  readonly recordRun: (providerId: string, outcome: 'pass' | 'fail' | 'degraded') => void;
  readonly recordProofFailure: (providerId: string, proofId: string) => void;
  readonly recordFetchFailure: (providerId: string, code: string) => void;
};

export function createMarketDataCertificationMetrics(
  recorder: ProviderMetricsRecorder = new InMemoryProviderMetrics(),
): MarketDataCertificationMetrics {
  return Object.freeze({
    recorder,
    recordRun(providerId, outcome) {
      recorder.increment('provider_requests_total', {
        provider_id: providerId,
        status: outcome,
        classification: 'market_data_certification',
      });
    },
    recordProofFailure(providerId, proofId) {
      recorder.increment('provider_errors_total', {
        provider_id: providerId,
        classification: `proof:${proofId}`,
      });
    },
    recordFetchFailure(providerId, code) {
      recorder.increment('provider_errors_total', {
        provider_id: providerId,
        classification: `fetch:${code}`,
      });
    },
  });
}
