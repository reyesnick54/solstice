/**
 * Wave 6 — SunRey Human Economy ontology invariants.
 *
 * Human contributions may inform SunRey eligibility only after verification,
 * valuation, governance, and Chunk 71 proof-bound issuance. No stage grants
 * mint authority or encodes human worth.
 */

export const HUMAN_ONTOLOGY_ID = 'sunrey.human-economy-ontology' as const;
export const HUMAN_ONTOLOGY_VERSION = '1' as const;

export const RAW_HUMAN_DATA_CANNOT_MINT = true as const;
export const CONTRIBUTION_EVENT_CANNOT_DIRECTLY_MINT = true as const;
export const VERIFICATION_DOES_NOT_EQUAL_ISSUANCE = true as const;
export const ELIGIBILITY_DOES_NOT_EQUAL_ISSUANCE = true as const;
export const PEVE_DOES_NOT_AUTOMATICALLY_EQUAL_SUNREY_QUANTITY = true as const;
export const CONSENT_DOES_NOT_EQUAL_VALUATION = true as const;
export const VALUATION_DOES_NOT_EQUAL_HUMAN_WORTH = true as const;
export const AI_CANNOT_DEFINE_HUMAN_WORTH = true as const;
export const AI_CANNOT_APPROVE_ISSUANCE = true as const;
export const PERSONAL_DATA_STAYS_OFF_CHAIN = true as const;
export const HUMAN_GOVERNANCE_REQUIRED_FOR_MONETARY_POLICY = true as const;
export const ATTRIBUTE_IS_NOT_CONTRIBUTION = true as const;
export const PROFILE_IS_NOT_CONTRIBUTION = true as const;
export const EVIDENCE_IS_NOT_CONTRIBUTION = true as const;
export const CLAIM_IS_NOT_SUNREY = true as const;
export const MARKET_PRICE_IS_NOT_CONTRIBUTION_VALUE = true as const;

export const HUMAN_ONTOLOGY_INVARIANTS = Object.freeze({
  RAW_HUMAN_DATA_CANNOT_MINT,
  CONTRIBUTION_EVENT_CANNOT_DIRECTLY_MINT,
  VERIFICATION_DOES_NOT_EQUAL_ISSUANCE,
  ELIGIBILITY_DOES_NOT_EQUAL_ISSUANCE,
  PEVE_DOES_NOT_AUTOMATICALLY_EQUAL_SUNREY_QUANTITY,
  CONSENT_DOES_NOT_EQUAL_VALUATION,
  VALUATION_DOES_NOT_EQUAL_HUMAN_WORTH,
  AI_CANNOT_DEFINE_HUMAN_WORTH,
  AI_CANNOT_APPROVE_ISSUANCE,
  PERSONAL_DATA_STAYS_OFF_CHAIN,
  HUMAN_GOVERNANCE_REQUIRED_FOR_MONETARY_POLICY,
  ATTRIBUTE_IS_NOT_CONTRIBUTION,
  PROFILE_IS_NOT_CONTRIBUTION,
  EVIDENCE_IS_NOT_CONTRIBUTION,
  CLAIM_IS_NOT_SUNREY,
  MARKET_PRICE_IS_NOT_CONTRIBUTION_VALUE,
});
