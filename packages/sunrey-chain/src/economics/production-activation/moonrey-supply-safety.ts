/**
 * Supply-safety validation for the MoonRey production-candidate package.
 *
 * Revaluation does not remint. Attribution correction after settlement
 * requires review. No automatic clawback. No customer balance rewrite.
 */

import {
  productionConversionOk,
  productionConversionRefuse,
  type ProductionConversionResult,
} from '../../productive/policy-governance/value-settlement/production-candidate/types.ts';
import type { MoonReyProductionIssuanceParameterPackage } from './moonrey-parameter-package.ts';

export const REVALUATION_DOES_NOT_REMINT = true as const;
export const ATTRIBUTION_CORRECTION_REQUIRES_REVIEW = true as const;
export const AUTOMATIC_CLAWBACK_FORBIDDEN = true as const;
export const CUSTOMER_BALANCE_REWRITE_FORBIDDEN = true as const;

export type SupplySafetyInput = {
  readonly pkg: MoonReyProductionIssuanceParameterPackage;
  readonly candidateIssuance?: bigint;
  readonly categoryEpochIssued?: bigint;
  readonly globalEpochIssued?: bigint;
  readonly canonicalSupply?: bigint;
  readonly category?: string;
};

export function validateMoonReySupplySafety(input: SupplySafetyInput): ProductionConversionResult<true> {
  const { pkg } = input;
  if (typeof pkg.MOONREY_GENESIS_SUPPLY === 'bigint' && typeof pkg.MOONREY_MAXIMUM_SUPPLY === 'bigint') {
    if (pkg.MOONREY_GENESIS_SUPPLY > pkg.MOONREY_MAXIMUM_SUPPLY) {
      return productionConversionRefuse('GENESIS_EXCEEDS_MAXIMUM_SUPPLY', 'genesis must be <= maximum supply');
    }
  }
  const candidate = input.candidateIssuance ?? 0n;
  if (typeof pkg.MOONREY_MAXIMUM_SUPPLY === 'bigint') {
    const circulating = input.canonicalSupply ?? 0n;
    if (circulating + candidate > pkg.MOONREY_MAXIMUM_SUPPLY) {
      return productionConversionRefuse('CONVERSION_CANNOT_BYPASS_MAXIMUM_SUPPLY', 'conversion cannot bypass maximum supply');
    }
  }
  const caps = pkg.MOONREY_PER_PERIOD_CAPS;
  if (typeof caps.perEvent === 'bigint' && typeof caps.perCategoryEpoch === 'bigint' && caps.perEvent > caps.perCategoryEpoch) {
    return productionConversionRefuse('EVENT_CAP_EXCEEDS_BROADER_CAP', 'event cap cannot exceed category epoch cap');
  }
  if (typeof caps.perController === 'bigint' && typeof caps.globalEpoch === 'bigint' && caps.perController > caps.globalEpoch) {
    return productionConversionRefuse('CONTROLLER_CAP_EXCEEDS_GLOBAL_CAP', 'controller cap cannot exceed global cap');
  }
  if (input.category && typeof caps.perCategoryEpoch === 'bigint') {
    const issued = input.categoryEpochIssued ?? 0n;
    if (issued + candidate > caps.perCategoryEpoch) {
      return productionConversionRefuse('PER_CATEGORY_EPOCH_CAP_EXCEEDED', 'category epoch issuance + candidate exceeds category cap');
    }
  }
  if (typeof caps.globalEpoch === 'bigint') {
    const issued = input.globalEpochIssued ?? 0n;
    if (issued + candidate > caps.globalEpoch) {
      return productionConversionRefuse('GLOBAL_EPOCH_CAP_EXCEEDED', 'global epoch issuance + candidate exceeds global cap');
    }
  }
  return productionConversionOk(true);
}

export function revaluationSafety() {
  return Object.freeze({
    remintForbidden: REVALUATION_DOES_NOT_REMINT,
    attributionCorrectionRequiresReview: ATTRIBUTION_CORRECTION_REQUIRES_REVIEW,
    automaticClawbackForbidden: AUTOMATIC_CLAWBACK_FORBIDDEN,
    customerBalanceRewriteForbidden: CUSTOMER_BALANCE_REWRITE_FORBIDDEN,
  });
}
