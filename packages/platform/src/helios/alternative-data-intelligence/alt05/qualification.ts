/**
 * ALT05 qualification — HELIOS_ALT05_DIGITAL_DEMAND_QUALIFIED
 */

import {
  HELIOS_ALT05_DIGITAL_DEMAND_BLOCKED,
  HELIOS_ALT05_DIGITAL_DEMAND_QUALIFIED,
  DIGITAL_DEMAND_INPUT_FAMILIES,
} from '../taxonomy.ts';

export type Alt05QualificationChecks = {
  readonly observationTypesDefined: boolean;
  readonly inputFamiliesComplete: boolean;
  readonly aggregateOnlyEnforced: boolean;
  readonly estimatesNotExactCounts: boolean;
  readonly searchReliabilityImplemented: boolean;
  readonly latentDemandWithUncertainty: boolean;
  readonly anomalySeparatesSpikeFromTrend: boolean;
  readonly viralInterestNotAutoSales: boolean;
  readonly knowableAtEnforced: boolean;
  readonly noExecutionAuthorityOnState: boolean;
};

export type Alt05QualificationResult = {
  readonly marker: typeof HELIOS_ALT05_DIGITAL_DEMAND_QUALIFIED | typeof HELIOS_ALT05_DIGITAL_DEMAND_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateAlt05DigitalDemandQualification(
  checks: Alt05QualificationChecks,
): Alt05QualificationResult {
  const blockers: string[] = [];
  if (!checks.observationTypesDefined) blockers.push('observation_types');
  if (!checks.inputFamiliesComplete) blockers.push('input_families');
  if (!checks.aggregateOnlyEnforced) blockers.push('aggregate_only');
  if (!checks.estimatesNotExactCounts) blockers.push('estimate_semantics');
  if (!checks.searchReliabilityImplemented) blockers.push('search_series_reliability');
  if (!checks.latentDemandWithUncertainty) blockers.push('latent_demand_model');
  if (!checks.anomalySeparatesSpikeFromTrend) blockers.push('anomaly_detection');
  if (!checks.viralInterestNotAutoSales) blockers.push('attention_not_sales');
  if (!checks.knowableAtEnforced) blockers.push('knowable_at');
  if (!checks.noExecutionAuthorityOnState) blockers.push('execution_authority');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_ALT05_DIGITAL_DEMAND_QUALIFIED : HELIOS_ALT05_DIGITAL_DEMAND_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}

export function alt05InputFamiliesComplete(): boolean {
  return DIGITAL_DEMAND_INPUT_FAMILIES.length === 5;
}
