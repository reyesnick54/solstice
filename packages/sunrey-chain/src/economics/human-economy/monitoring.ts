/**
 * Wave 6 — Human economy monitoring metrics.
 *
 * No sensitive raw personal information in metrics.
 */

import type { HumanEconomyMonitoringSnapshot } from './types.ts';

type MutableHumanEconomyMonitoringMetrics = {
  -readonly [K in keyof HumanEconomyMonitoringSnapshot]: HumanEconomyMonitoringSnapshot[K];
};

export type HumanEconomyMonitoringStore = {
  metrics: MutableHumanEconomyMonitoringMetrics;
};

export function emptyHumanEconomyMonitoringStore(): HumanEconomyMonitoringStore {
  return {
    metrics: {
      contributionsSubmitted: 0,
      contributionsVerified: 0,
      contributionsRejected: 0,
      manualReview: 0,
      duplicateDetected: 0,
      identityConflicts: 0,
      sybilSignals: 0,
      consentDenials: 0,
      rightsDenials: 0,
      peveCalculations: 0,
      sunReyProposals: 0,
      sunReyProposalRejections: 0,
      challengedClaims: 0,
      attestationProviderHealthAlerts: 0,
      containsSensitivePersonalInformation: false,
    },
  };
}

export type MonitoringMetricKey = keyof Omit<
  HumanEconomyMonitoringSnapshot,
  'containsSensitivePersonalInformation'
>;

export function incrementMetric(store: HumanEconomyMonitoringStore, key: MonitoringMetricKey, by = 1): void {
  store.metrics[key] += by;
}

export function snapshotMetrics(store: HumanEconomyMonitoringStore): HumanEconomyMonitoringSnapshot {
  return Object.freeze({ ...store.metrics });
}

export function metricsExcludeSensitivePersonalData(snapshot: HumanEconomyMonitoringSnapshot): true {
  if (snapshot.containsSensitivePersonalInformation !== false) {
    throw new Error('metrics snapshot must not contain sensitive personal information');
  }
  return true;
}
