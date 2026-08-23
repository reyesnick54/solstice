/**
 * Provider / data license tracking. Externally licensed raw data is not
 * exposed publicly unless terms allow. Frontend receives derived metrics.
 */

import type { EconomicObservation, LicenseClass } from './types.ts';

export function publicMetricAllowed(license: LicenseClass): boolean {
  return license === 'SANDBOX_FIXTURE' || license === 'PUBLIC_DERIVED_ALLOWED';
}

export function rawObservationPubliclyExposable(observation: EconomicObservation): boolean {
  if (observation.license === 'EXTERNAL_RESTRICTED' || observation.license === 'CONFIDENTIAL_PROVIDER') {
    return false;
  }
  return publicMetricAllowed(observation.license);
}

export function derivePublicMetric(observation: EconomicObservation): {
  readonly observationId: string;
  readonly category: EconomicObservation['category'];
  readonly metric: string;
  readonly value: string | null;
  readonly unit: string | null;
  readonly sourceClass: EconomicObservation['provenance']['sourceClass'];
  readonly timestampUtc: string;
  readonly freshness: EconomicObservation['freshness']['state'];
  readonly rawWithheld: boolean;
} {
  const allowRaw = rawObservationPubliclyExposable(observation);
  return Object.freeze({
    observationId: observation.observationId,
    category: observation.category,
    metric: observation.metric,
    value: allowRaw ? observation.canonicalValue.toString() : null,
    unit: allowRaw ? observation.canonicalUnit : null,
    sourceClass: observation.provenance.sourceClass,
    timestampUtc: observation.timestampUtc,
    freshness: observation.freshness.state,
    rawWithheld: !allowRaw,
  });
}
