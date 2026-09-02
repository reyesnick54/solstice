/**
 * Wave 5 — Productive operations observability metrics.
 *
 * Metrics contain aggregate counts and rates only. No sensitive raw data.
 */

import type { ProductiveCategory } from '../types.ts';

export type ProductiveOperationsMetrics = {
  readonly observations_by_domain: Readonly<Record<string, number>>;
  readonly independent_sources_per_claim_avg: number;
  readonly verification_pass_count: number;
  readonly verification_fail_count: number;
  readonly conflict_rate_bps: number;
  readonly duplicate_rate_bps: number;
  readonly event_resolution_count: number;
  readonly gpuv_calculations: number;
  readonly productive_claims_created: number;
  readonly productive_claims_challenged: number;
  readonly moonrey_proposals: number;
  readonly moonrey_proposals_rejected: number;
  readonly provider_outages: number;
  readonly source_dependence_warnings: number;
};

export function emptyProductiveOperationsMetrics(): ProductiveOperationsMetrics {
  return Object.freeze({
    observations_by_domain: {},
    independent_sources_per_claim_avg: 0,
    verification_pass_count: 0,
    verification_fail_count: 0,
    conflict_rate_bps: 0,
    duplicate_rate_bps: 0,
    event_resolution_count: 0,
    gpuv_calculations: 0,
    productive_claims_created: 0,
    productive_claims_challenged: 0,
    moonrey_proposals: 0,
    moonrey_proposals_rejected: 0,
    provider_outages: 0,
    source_dependence_warnings: 0,
  });
}

export class ProductiveOperationsMetricsCollector {
  private metrics = emptyProductiveOperationsMetrics();
  private independentSourceSamples: number[] = [];

  recordObservation(domain: ProductiveCategory): void {
    const key = domain;
    const current = this.metrics.observations_by_domain[key] ?? 0;
    this.metrics = Object.freeze({
      ...this.metrics,
      observations_by_domain: Object.freeze({ ...this.metrics.observations_by_domain, [key]: current + 1 }),
    });
  }

  recordVerificationPass(): void {
    this.metrics = Object.freeze({ ...this.metrics, verification_pass_count: this.metrics.verification_pass_count + 1 });
  }

  recordVerificationFail(): void {
    this.metrics = Object.freeze({ ...this.metrics, verification_fail_count: this.metrics.verification_fail_count + 1 });
  }

  recordIndependentSources(count: number): void {
    this.independentSourceSamples.push(count);
    const avg =
      this.independentSourceSamples.reduce((sum, value) => sum + value, 0) /
      this.independentSourceSamples.length;
    this.metrics = Object.freeze({ ...this.metrics, independent_sources_per_claim_avg: avg });
  }

  recordConflict(): void {
    const total = this.metrics.verification_pass_count + this.metrics.verification_fail_count;
    const conflicts = Math.round((this.metrics.conflict_rate_bps / 10_000) * Math.max(total, 1)) + 1;
    this.metrics = Object.freeze({
      ...this.metrics,
      conflict_rate_bps: total === 0 ? 0 : Math.round((conflicts / (total + 1)) * 10_000),
    });
  }

  recordDuplicate(): void {
    const total = this.metrics.productive_claims_created;
    const duplicates = Math.round((this.metrics.duplicate_rate_bps / 10_000) * Math.max(total, 1)) + 1;
    this.metrics = Object.freeze({
      ...this.metrics,
      duplicate_rate_bps: total === 0 ? 0 : Math.round((duplicates / (total + 1)) * 10_000),
    });
  }

  recordEventResolution(): void {
    this.metrics = Object.freeze({
      ...this.metrics,
      event_resolution_count: this.metrics.event_resolution_count + 1,
    });
  }

  recordGpuvCalculation(): void {
    this.metrics = Object.freeze({ ...this.metrics, gpuv_calculations: this.metrics.gpuv_calculations + 1 });
  }

  recordClaimCreated(): void {
    this.metrics = Object.freeze({
      ...this.metrics,
      productive_claims_created: this.metrics.productive_claims_created + 1,
    });
  }

  recordClaimChallenged(): void {
    this.metrics = Object.freeze({
      ...this.metrics,
      productive_claims_challenged: this.metrics.productive_claims_challenged + 1,
    });
  }

  recordMoonReyProposal(rejected = false): void {
    this.metrics = Object.freeze({
      ...this.metrics,
      moonrey_proposals: this.metrics.moonrey_proposals + 1,
      moonrey_proposals_rejected: this.metrics.moonrey_proposals_rejected + (rejected ? 1 : 0),
    });
  }

  recordProviderOutage(): void {
    this.metrics = Object.freeze({ ...this.metrics, provider_outages: this.metrics.provider_outages + 1 });
  }

  recordSourceDependenceWarning(): void {
    this.metrics = Object.freeze({
      ...this.metrics,
      source_dependence_warnings: this.metrics.source_dependence_warnings + 1,
    });
  }

  snapshot(): ProductiveOperationsMetrics {
    return this.metrics;
  }
}
