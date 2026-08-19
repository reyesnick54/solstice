/**
 * Revaluation and attribution-correction reviews.
 *
 * A new valuation does not remint. An attribution change does not
 * silently issue or burn customer assets.
 */

import type { SettledValueRecord, SettlementReviewRecord } from './types.ts';

export function revaluationReview(prior: SettledValueRecord, contributionId: string): SettlementReviewRecord {
  return Object.freeze({
    flag: 'REVALUATION_SETTLEMENT_REVIEW',
    contributionId,
    priorAuthorizationId: prior.authorizationId,
    remintForbidden: true,
    clawbackForbidden: true,
    customerBalanceUnmodified: true,
  });
}

export function attributionAdjustmentReview(
  prior: SettledValueRecord,
  contributionId: string,
): SettlementReviewRecord {
  return Object.freeze({
    flag: 'ATTRIBUTION_SETTLEMENT_ADJUSTMENT_REVIEW_REQUIRED',
    contributionId,
    priorAuthorizationId: prior.authorizationId,
    remintForbidden: true,
    clawbackForbidden: true,
    customerBalanceUnmodified: true,
  });
}
