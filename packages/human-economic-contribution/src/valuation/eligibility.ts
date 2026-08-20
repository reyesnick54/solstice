import type { ContributionClass } from '../taxonomy.ts';
import { CONTRIBUTION_CLASSES } from '../taxonomy.ts';
import { isForbiddenValuationMethod, isPermittedValuationMethod, type PermittedValuationMethod } from './methods.ts';

/**
 * Explicit class → method allowlist.
 *
 * There is no universal "value of a human contribution" formula.
 * A class with an empty list has no valuation unless a later
 * constitution version adds a method. Taxonomy membership never
 * grants eligibility by itself.
 */
export const VALUATION_ELIGIBILITY_MATRIX: Readonly<Record<ContributionClass, readonly PermittedValuationMethod[]>> =
  Object.freeze({
    INFORMATION_RIGHT_CONTRIBUTION: Object.freeze([
      'INFORMATION_USAGE_RIGHT_SCHEDULE',
      'CONTRACTUAL_COMPENSATION',
      'MARKET_REFERENCE',
      'AUCTION_OR_CLEARING_REFERENCE',
    ]),
    VERIFIED_KNOWLEDGE_CONTRIBUTION: Object.freeze([
      'INFORMATION_USAGE_RIGHT_SCHEDULE',
      'CONTRACTUAL_COMPENSATION',
      'MARKET_REFERENCE',
    ]),
    CREATIVE_PRODUCTION: Object.freeze([
      'CONTRACTUAL_COMPENSATION',
      'CREATOR_ROYALTY_SCHEDULE',
      'MARKET_REFERENCE',
      'AUCTION_OR_CLEARING_REFERENCE',
    ]),
    RESEARCH_PARTICIPATION: Object.freeze(['RESEARCH_PARTICIPATION_SCHEDULE', 'CONTRACTUAL_COMPENSATION']),
    PROFESSIONAL_EXPERTISE: Object.freeze([
      'PROFESSIONAL_SERVICE_SCHEDULE',
      'CONTRACTUAL_COMPENSATION',
      'MARKET_REFERENCE',
    ]),
    ECONOMIC_PARTICIPATION: Object.freeze([
      'GOVERNED_FIXED_SCHEDULE',
      'CONTRACTUAL_COMPENSATION',
      'VERIFIED_OUTCOME_ATTRIBUTION',
    ]),
    COMMUNITY_CONTRIBUTION: Object.freeze(['COMMUNITY_CONTRIBUTION_SCHEDULE', 'GOVERNED_FIXED_SCHEDULE']),
    EDUCATION_SKILL_ATTESTATION: Object.freeze(['GOVERNED_FIXED_SCHEDULE', 'CONTRACTUAL_COMPENSATION']),
    MODEL_TRAINING_PARTICIPATION: Object.freeze(['INFORMATION_USAGE_RIGHT_SCHEDULE', 'CONTRACTUAL_COMPENSATION']),
    HUMAN_SERVICE_DELIVERY: Object.freeze([
      'CONTRACTUAL_COMPENSATION',
      'PROFESSIONAL_SERVICE_SCHEDULE',
      'MARKET_REFERENCE',
    ]),
    ENTREPRENEURIAL_ACTIVITY: Object.freeze([
      'VERIFIED_OUTCOME_ATTRIBUTION',
      'CONTRACTUAL_COMPENSATION',
      'MARKET_REFERENCE',
    ]),
    CREATOR_ROYALTY_EVENT: Object.freeze(['CREATOR_ROYALTY_SCHEDULE', 'CONTRACTUAL_COMPENSATION']),
    OTHER_GOVERNED_HUMAN_CONTRIBUTION: Object.freeze([]),
  } as Record<ContributionClass, readonly PermittedValuationMethod[]>);

export function permittedMethodsFor(contributionClass: ContributionClass): readonly PermittedValuationMethod[] {
  return VALUATION_ELIGIBILITY_MATRIX[contributionClass];
}

export function isMethodEligibleForClass(contributionClass: ContributionClass, method: string): boolean {
  if (isForbiddenValuationMethod(method) || !isPermittedValuationMethod(method)) {
    return false;
  }
  return VALUATION_ELIGIBILITY_MATRIX[contributionClass].includes(method);
}

export function everyContributionClassHasDeliberateMethodRules(): boolean {
  return CONTRIBUTION_CLASSES.every((contributionClass) => Object.hasOwn(VALUATION_ELIGIBILITY_MATRIX, contributionClass));
}
