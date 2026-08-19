/**
 * Human Contribution Valuation constitution.
 *
 * PEVE asks: "How is this person's economic system performing?"
 * Human Contribution Valuation asks: "What settlement value, if any,
 * should be assigned to THIS PARTICULAR verified economic contribution
 * under THIS VERSIONED policy?"
 *
 * This is not a person score, not PEVE, and not a mint.
 */

export const HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION_ID =
  'sunrey-human-contribution-valuation-constitution' as const;
export const HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION_VERSION = '1' as const;
export const HUMAN_CONTRIBUTION_VALUATION_SCHEMA_VERSION = 1 as const;

export const VALUATION_IS_EVENT_SPECIFIC = true as const;
export const VALUATION_IS_NOT_HUMAN_WORTH = true as const;
export const VALUATION_IS_NOT_PEVE = true as const;
export const VALUATION_IS_NOT_CREDIT_SCORE = true as const;
export const VALUATION_IS_NOT_SOCIAL_CREDIT = true as const;
export const VALUATION_DOES_NOT_MINT = true as const;
export const VALUATION_DOES_NOT_AUTHORIZE_EXECUTION = true as const;
export const PROTECTED_TRAIT_VALUATION_FORBIDDEN = true as const;
export const PERSON_LEVEL_DESIRABILITY_MULTIPLIER_FORBIDDEN = true as const;
export const AI_FINAL_VALUATION_AUTHORITY_FORBIDDEN = true as const;
export const PRODUCTION_VALUATION_POLICY_CONFIGURED = false as const;

export const HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION = Object.freeze({
  constitutionId: HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION_ID,
  constitutionVersion: HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION_VERSION,
  schemaVersion: HUMAN_CONTRIBUTION_VALUATION_SCHEMA_VERSION,
  VALUATION_IS_EVENT_SPECIFIC,
  VALUATION_IS_NOT_HUMAN_WORTH,
  VALUATION_IS_NOT_PEVE,
  VALUATION_IS_NOT_CREDIT_SCORE,
  VALUATION_IS_NOT_SOCIAL_CREDIT,
  VALUATION_DOES_NOT_MINT,
  VALUATION_DOES_NOT_AUTHORIZE_EXECUTION,
  PROTECTED_TRAIT_VALUATION_FORBIDDEN,
  PERSON_LEVEL_DESIRABILITY_MULTIPLIER_FORBIDDEN,
  AI_FINAL_VALUATION_AUTHORITY_FORBIDDEN,
  PRODUCTION_VALUATION_POLICY_CONFIGURED,
  peveIsNotContributionValuation: true,
  valuationIsNotSunReyQuantity: true,
  valuationEngineComputesSettlement: false,
  productionValuationActive: false,
});

export const VALUATION_NOT_PEVE =
  'PEVE describes a person\'s economic system. Human Contribution Valuation assigns a versioned reference value to one verified contribution event. PEVE scores are not contribution value.';

export const VALUATION_NOT_HUMAN_WORTH =
  'Human Contribution Valuation is event-specific. It is not a human-worth score, credit score, social-credit score, or ranking of people.';

export const VALUATION_NOT_SUNREY_QUANTITY =
  'A contribution reference value is not a SunRey Coin quantity and does not create mint authority.';

export const VALUATION_NOT_EXECUTION =
  'A valuation policy cannot authorize financial execution, issue Execution Authority, post a ledger journal, or mint SunRey Coin.';
