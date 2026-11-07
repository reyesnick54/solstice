/**
 * HELIOS ALT10 qualification gate.
 */

import {
  HELIOS_ALT10_PROCUREMENT_INTELLIGENCE_BLOCKED,
  HELIOS_ALT10_PROCUREMENT_INTELLIGENCE_QUALIFIED,
} from './taxonomy.ts';

export type Alt10QualificationChecks = {
  readonly futureAwardCannotLeak: boolean;
  readonly jointVentureNotAttributedToParent: boolean;
  readonly awardCeilingDistinctFromRevenueEstimate: boolean;
  readonly obligationDistinctFromRevenueEstimate: boolean;
  readonly revenueEstimateRequiresCalibration: boolean;
  readonly duplicateProviderReportsDedupe: boolean;
  readonly modificationAppendsWithoutErasingAward: boolean;
  readonly featuresExposeNormalizationDenominators: boolean;
};

export type Alt10QualificationResult = {
  readonly marker:
    | typeof HELIOS_ALT10_PROCUREMENT_INTELLIGENCE_QUALIFIED
    | typeof HELIOS_ALT10_PROCUREMENT_INTELLIGENCE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateAlt10Qualification(checks: Alt10QualificationChecks): Alt10QualificationResult {
  const blockers: string[] = [];
  if (!checks.futureAwardCannotLeak) blockers.push('future award leak');
  if (!checks.jointVentureNotAttributedToParent) blockers.push('JV attributed to parent');
  if (!checks.awardCeilingDistinctFromRevenueEstimate) blockers.push('award ceiling conflated with revenue');
  if (!checks.obligationDistinctFromRevenueEstimate) blockers.push('obligation conflated with revenue');
  if (!checks.revenueEstimateRequiresCalibration) blockers.push('revenue estimate without calibration');
  if (!checks.duplicateProviderReportsDedupe) blockers.push('duplicate provider reports not deduped');
  if (!checks.modificationAppendsWithoutErasingAward) blockers.push('modification erased award history');
  if (!checks.featuresExposeNormalizationDenominators) blockers.push('normalization denominators missing');

  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_ALT10_PROCUREMENT_INTELLIGENCE_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_ALT10_PROCUREMENT_INTELLIGENCE_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
