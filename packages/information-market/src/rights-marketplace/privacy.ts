import type { DataProduct, RightsMarketplaceFailure } from './types.ts';
import { SENSITIVE_CATEGORIES } from './taxonomy.ts';

export type PrivacyControls = {
  readonly minimumCohortSize: number;
  readonly suppressionEnabled: true;
  readonly categoryRestrictions: readonly string[];
  readonly queryLimit: number;
  readonly reidentificationControls: true;
  readonly differentialPrivacyClaimed: false;
  readonly differentialPrivacyImplemented: false;
};

export function privacyControlsFor(product: DataProduct, queryLimit: number): PrivacyControls {
  return Object.freeze({
    minimumCohortSize: product.minimumAggregationThreshold,
    suppressionEnabled: true,
    categoryRestrictions: product.sensitiveCategory ? SENSITIVE_CATEGORIES : Object.freeze([]),
    queryLimit,
    reidentificationControls: true,
    differentialPrivacyClaimed: false,
    differentialPrivacyImplemented: false,
  });
}

export function enforceAggregation(input: {
  readonly product: DataProduct;
  readonly cohortSize: number;
  readonly priorQueries: number;
  readonly queryLimit: number;
}): RightsMarketplaceFailure | null {
  if (input.cohortSize < input.product.minimumAggregationThreshold) {
    return {
      code: 'AGGREGATION_RESTRICTED',
      message: `cohort ${input.cohortSize} is below threshold ${input.product.minimumAggregationThreshold}`,
    };
  }
  if (input.priorQueries >= input.queryLimit) {
    return { code: 'QUERY_LIMIT', message: 'license query limit reached' };
  }
  return null;
}

export function suppressIfBelowThreshold(value: number, cohortSize: number, threshold: number): number | null {
  return cohortSize < threshold ? null : value;
}
