/**
 * ACCESS Wave 5 — Funding source classification and restriction enforcement.
 */

import type { AccessFundingSourceType } from '../funding-solvency/taxonomy.ts';
import {
  fundingValueKindForSource,
  isCashFundedSource,
  isDiscountSource,
} from '../funding-solvency/taxonomy.ts';
import type { FundingRestriction } from '../funding-solvency/types.ts';
import type { AccessFundingSourceClassification } from './taxonomy.ts';
import type { AccessFundingRestrictionPolicy } from './types.ts';

export function classifyFundingSource(
  sourceType: AccessFundingSourceType,
): AccessFundingSourceClassification {
  if (sourceType === 'PROVIDER_DISCOUNT') {
    return 'DISCOUNT_CAPACITY';
  }
  if (sourceType === 'SPONSOR') {
    return 'SPONSOR_FUNDED';
  }
  if (sourceType === 'EMPLOYER') {
    return 'EMPLOYER_FUNDED';
  }
  if (sourceType === 'GOVERNMENT_PROGRAM') {
    return 'GOVERNMENT_FUNDED';
  }
  if (sourceType === 'PROMOTIONAL_BUDGET') {
    return 'PROMOTIONAL_BUDGET';
  }
  if (isDiscountSource(sourceType)) {
    return 'DISCOUNT_CAPACITY';
  }
  if (isCashFundedSource(sourceType)) {
    return 'CASH_FUNDED';
  }
  return 'CASH_FUNDED';
}

export function isRestrictedFundingClassification(
  classification: AccessFundingSourceClassification,
): boolean {
  return (
    classification === 'DISCOUNT_CAPACITY' ||
    classification === 'PROVIDER_CONTRIBUTED_CAPACITY' ||
    classification === 'SPONSOR_FUNDED' ||
    classification === 'EMPLOYER_FUNDED' ||
    classification === 'GOVERNMENT_FUNDED' ||
    classification === 'PROMOTIONAL_BUDGET'
  );
}

export function discountCapacityIsNotUnrestrictedCash(classification: AccessFundingSourceClassification): boolean {
  return classification === 'DISCOUNT_CAPACITY' || classification === 'PROVIDER_CONTRIBUTED_CAPACITY';
}

export function validateFundingRestriction(input: {
  readonly classification: AccessFundingSourceClassification;
  readonly restrictions: FundingRestriction;
  readonly category: string;
  readonly geography: string | null;
  readonly providerId: string | null;
  readonly policy?: AccessFundingRestrictionPolicy;
}): { readonly allowed: boolean; readonly reason: string } {
  const { classification, restrictions, category, geography, providerId, policy } = input;

  if (restrictions.category !== undefined && restrictions.category !== category) {
    return Object.freeze({
      allowed: false,
      reason: `funding restricted to category ${restrictions.category}`,
    });
  }

  if (restrictions.country !== undefined && geography !== null) {
    if (!geography.startsWith(restrictions.country)) {
      return Object.freeze({
        allowed: false,
        reason: `funding restricted to geography ${restrictions.country}`,
      });
    }
  }

  if (restrictions.providerId !== undefined && providerId !== restrictions.providerId) {
    return Object.freeze({
      allowed: false,
      reason: `funding restricted to provider ${restrictions.providerId}`,
    });
  }

  if (policy) {
    if (policy.allowedCategories !== null && !policy.allowedCategories.includes(category)) {
      return Object.freeze({
        allowed: false,
        reason: `program policy restricts funding to categories: ${policy.allowedCategories.join(', ')}`,
      });
    }
    if (
      policy.allowedGeographies !== null &&
      geography !== null &&
      !policy.allowedGeographies.some((geo) => geography.includes(geo))
    ) {
      return Object.freeze({
        allowed: false,
        reason: `program policy restricts funding to geographies: ${policy.allowedGeographies.join(', ')}`,
      });
    }
    if (
      policy.allowedProviders !== null &&
      providerId !== null &&
      !policy.allowedProviders.includes(providerId)
    ) {
      return Object.freeze({
        allowed: false,
        reason: `program policy restricts funding to providers: ${policy.allowedProviders.join(', ')}`,
      });
    }
  }

  if (discountCapacityIsNotUnrestrictedCash(classification)) {
    return Object.freeze({
      allowed: true,
      reason: 'discount capacity is settlement economics only; not unrestricted cash',
    });
  }

  return Object.freeze({ allowed: true, reason: 'funding restriction satisfied' });
}

export function fundingValueKindMatchesClassification(
  sourceType: AccessFundingSourceType,
  classification: AccessFundingSourceClassification,
): boolean {
  const kind = fundingValueKindForSource(sourceType);
  if (classification === 'DISCOUNT_CAPACITY' || classification === 'PROVIDER_CONTRIBUTED_CAPACITY') {
    return kind === 'DISCOUNT_CAPACITY' || kind === 'PROVIDER_CONTRIBUTED_CAPACITY';
  }
  return kind === 'CASH_FUNDED';
}

export const DEFAULT_FUNDING_RESTRICTION_POLICIES: readonly AccessFundingRestrictionPolicy[] = Object.freeze([
  Object.freeze({
    policyId: 'employer-travel-only',
    sourceClassification: 'EMPLOYER_FUNDED',
    allowedCategories: Object.freeze(['TRAVEL', 'MOBILITY', 'STAY']),
    allowedGeographies: null,
    allowedProviders: null,
    programId: 'employer-demo',
    survivesRefund: true,
    survivesSettlement: true,
  }),
  Object.freeze({
    policyId: 'sponsor-experiences-florida',
    sourceClassification: 'SPONSOR_FUNDED',
    allowedCategories: Object.freeze(['EXPERIENCES']),
    allowedGeographies: Object.freeze(['US-FL']),
    allowedProviders: null,
    programId: 'sponsor-demo',
    survivesRefund: true,
    survivesSettlement: true,
  }),
  Object.freeze({
    policyId: 'government-transportation-approved',
    sourceClassification: 'GOVERNMENT_FUNDED',
    allowedCategories: Object.freeze(['MOBILITY', 'TRANSPORTATION']),
    allowedGeographies: Object.freeze(['US']),
    allowedProviders: null,
    programId: 'gov-transit-demo',
    survivesRefund: true,
    survivesSettlement: true,
  }),
]);
