/**
 * Versioned valuation-method taxonomy.
 *
 * Methods apply to a specific contribution event under a versioned
 * policy. Adding a method never grants automatic valuation eligibility
 * and never connects to a live market.
 */

export const VALUATION_METHOD_TAXONOMY_ID = 'sunrey-human-contribution-valuation-methods' as const;
export const VALUATION_METHOD_TAXONOMY_VERSION = '1' as const;

export const PERMITTED_VALUATION_METHODS = [
  'CONTRACTUAL_COMPENSATION',
  'GOVERNED_FIXED_SCHEDULE',
  'INFORMATION_USAGE_RIGHT_SCHEDULE',
  'PROFESSIONAL_SERVICE_SCHEDULE',
  'CREATOR_ROYALTY_SCHEDULE',
  'RESEARCH_PARTICIPATION_SCHEDULE',
  'COMMUNITY_CONTRIBUTION_SCHEDULE',
  'MARKET_REFERENCE',
  'VERIFIED_OUTCOME_ATTRIBUTION',
  'AUCTION_OR_CLEARING_REFERENCE',
] as const;
export type PermittedValuationMethod = (typeof PERMITTED_VALUATION_METHODS)[number];

export const FORBIDDEN_VALUATION_METHODS = [
  'AI_SUBJECTIVE_HUMAN_SCORE',
  'PEVE_MULTIPLIER',
  'CREDIT_SCORE_MULTIPLIER',
  'SOCIAL_RANK_MULTIPLIER',
  'NET_WORTH_MULTIPLIER',
  'PROTECTED_TRAIT_MULTIPLIER',
  'OPAQUE_PERSON_REPUTATION_SCORE',
] as const;
export type ForbiddenValuationMethod = (typeof FORBIDDEN_VALUATION_METHODS)[number];

export type ValuationMethodRecord = {
  readonly method: PermittedValuationMethod;
  readonly taxonomyVersion: typeof VALUATION_METHOD_TAXONOMY_VERSION;
  readonly liveMarketConnectivity: false;
  readonly isPersonScore: false;
  readonly isPeveMultiplier: false;
  readonly grantsAutomaticEligibility: false;
};

function methodRecord(method: PermittedValuationMethod): ValuationMethodRecord {
  return Object.freeze({
    method,
    taxonomyVersion: VALUATION_METHOD_TAXONOMY_VERSION,
    liveMarketConnectivity: false,
    isPersonScore: false,
    isPeveMultiplier: false,
    grantsAutomaticEligibility: false,
  });
}

export const VALUATION_METHOD_RECORDS: Readonly<Record<PermittedValuationMethod, ValuationMethodRecord>> = Object.freeze(
  Object.fromEntries(PERMITTED_VALUATION_METHODS.map((method) => [method, methodRecord(method)])) as Record<
    PermittedValuationMethod,
    ValuationMethodRecord
  >,
);

export const VALUATION_METHOD_TAXONOMY = Object.freeze({
  taxonomyId: VALUATION_METHOD_TAXONOMY_ID,
  taxonomyVersion: VALUATION_METHOD_TAXONOMY_VERSION,
  permitted: PERMITTED_VALUATION_METHODS,
  forbidden: FORBIDDEN_VALUATION_METHODS,
  records: VALUATION_METHOD_RECORDS,
  addingAMethodDoesNotGrantEligibility: true,
  liveMarketConnectivity: false,
  productionActivated: false,
});

export function isPermittedValuationMethod(value: string): value is PermittedValuationMethod {
  return (PERMITTED_VALUATION_METHODS as readonly string[]).includes(value);
}

export function isForbiddenValuationMethod(value: string): value is ForbiddenValuationMethod {
  return (FORBIDDEN_VALUATION_METHODS as readonly string[]).includes(value);
}
