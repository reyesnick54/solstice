export const REQUESTER_KINDS = [
  'RESEARCH_INSTITUTION',
  'ENTERPRISE',
  'PRODUCT_RESEARCH_SPONSOR',
  'APPROVED_AI_DEVELOPER',
  'INTERNAL_SUNREY_RESEARCH',
] as const;
export type RequesterKind = (typeof REQUESTER_KINDS)[number];

export const REQUESTER_VERIFICATION_STATES = [
  'UNVERIFIED_FIXTURE',
  'SIMULATION_VERIFIED',
  'SUSPENDED',
] as const;
export type RequesterVerificationState = (typeof REQUESTER_VERIFICATION_STATES)[number];

export const INFORMATION_PRODUCTS = [
  'RESEARCH_PARTICIPATION',
  'VERIFIED_COHORT',
  'ATTESTATION',
  'PROVENANCE_CERTIFICATE',
  'SYNTHETIC_DERIVED_DATASET',
  'AGGREGATE_QUERY',
  'SECURE_COHORT_ANALYTICS',
  'ELIGIBILITY_PROOF',
  'PERMISSIONED_INFERENCE',
  'VERIFIED_MARKET_INSIGHT',
  'AI_TRAINING_PERMISSION',
] as const;
export type InformationProductType = (typeof INFORMATION_PRODUCTS)[number];

export const PRODUCT_AVAILABILITY: Readonly<Record<InformationProductType, 'ACTIVE_SIMULATION' | 'PLANNED_DISABLED'>> =
  Object.freeze({
    RESEARCH_PARTICIPATION: 'ACTIVE_SIMULATION',
    VERIFIED_COHORT: 'ACTIVE_SIMULATION',
    ATTESTATION: 'ACTIVE_SIMULATION',
    PROVENANCE_CERTIFICATE: 'ACTIVE_SIMULATION',
    SYNTHETIC_DERIVED_DATASET: 'ACTIVE_SIMULATION',
    AGGREGATE_QUERY: 'ACTIVE_SIMULATION',
    SECURE_COHORT_ANALYTICS: 'ACTIVE_SIMULATION',
    ELIGIBILITY_PROOF: 'ACTIVE_SIMULATION',
    PERMISSIONED_INFERENCE: 'ACTIVE_SIMULATION',
    VERIFIED_MARKET_INSIGHT: 'ACTIVE_SIMULATION',
    AI_TRAINING_PERMISSION: 'PLANNED_DISABLED',
  });

export const REQUEST_STATUSES = [
  'DRAFT',
  'UNDER_REVIEW',
  'PUBLISHED_SIMULATION',
  'SUSPENDED',
  'CLOSED',
  'REJECTED',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const OPPORTUNITY_DECISIONS = ['ACCEPT', 'DECLINE', 'EXPIRE'] as const;
export type OpportunityDecision = (typeof OPPORTUNITY_DECISIONS)[number];

export const CONTRIBUTION_STATES = [
  'MATCHED',
  'OFFERED',
  'ACCEPTED',
  'AUTHORIZED',
  'COMPUTE_PENDING',
  'COMPLETED',
  'COMPENSATION_PENDING',
  'SETTLED',
  'DECLINED',
  'EXPIRED',
  'REVOKED_PRE_COMPUTE',
  'FAILED',
] as const;
export type ContributionState = (typeof CONTRIBUTION_STATES)[number];

export const CONTRIBUTION_TRANSITIONS: Readonly<Record<ContributionState, readonly ContributionState[]>> =
  Object.freeze({
    MATCHED: ['OFFERED', 'EXPIRED'],
    OFFERED: ['ACCEPTED', 'DECLINED', 'EXPIRED'],
    ACCEPTED: ['AUTHORIZED', 'REVOKED_PRE_COMPUTE', 'FAILED'],
    AUTHORIZED: ['COMPUTE_PENDING', 'REVOKED_PRE_COMPUTE', 'FAILED'],
    COMPUTE_PENDING: ['COMPLETED', 'FAILED'],
    COMPLETED: ['COMPENSATION_PENDING', 'FAILED'],
    COMPENSATION_PENDING: ['SETTLED', 'FAILED'],
    SETTLED: [],
    DECLINED: [],
    EXPIRED: [],
    REVOKED_PRE_COMPUTE: [],
    FAILED: [],
  });

export const COMPENSATION_REALIZATION = ['PENDING', 'OFFERED', 'REALIZED'] as const;
export type CompensationRealization = (typeof COMPENSATION_REALIZATION)[number];

export const COMPENSATION_ASSETS = ['FIAT_MONEY', 'SUNREY_COIN'] as const;
export type CompensationAsset = (typeof COMPENSATION_ASSETS)[number];

export const ORACLE_CLAIM_TYPES = [
  'AGE_BAND',
  'RESEARCH_INCLUSION',
  'INCOME_THRESHOLD',
  'SAVINGS_BEHAVIOR_MAINTAINED',
  'VERIFIED_CREDENTIAL',
  'COHORT_MEMBERSHIP',
] as const;
export type OracleClaimType = (typeof ORACLE_CLAIM_TYPES)[number];

export const PROHIBITED_USE_CATEGORIES = [
  'CREDIT_ELIGIBILITY_FROM_HEALTH',
  'EMPLOYMENT_SCREENING_FROM_WELLNESS',
  'INSURANCE_DISCRIMINATION',
  'POLITICAL_PERSUASION_TARGETING',
  'UNRESTRICTED_SENSITIVE_ADVERTISING',
  'SALE_OF_RAW_GENETIC_DATA',
] as const;
export type ProhibitedUseCategory = (typeof PROHIBITED_USE_CATEGORIES)[number];

export const ALLOWED_OUTPUT_TYPES = [
  'AGGREGATE',
  'ATTESTATION',
  'PROOF',
  'DERIVED_RESULT',
  'SYNTHETIC_RESULT',
] as const;
export type AllowedOutputType = (typeof ALLOWED_OUTPUT_TYPES)[number];

export const EVIDENCE_KIND_INFORMATION_MARKET = 'INFORMATION_MARKET';
export const ORACLE_ISSUER = 'packages/information-market/personal-oracle';
export const RDT_CANDIDATE_CAPABILITIES = Object.freeze({
  INFORMATION_MARKET_REQUEST: { enabled: false, legalReviewStatus: 'RESEARCH_REQUIRED' as const },
  RESEARCH_PARTICIPATION: { enabled: false, legalReviewStatus: 'RESEARCH_REQUIRED' as const },
  COMPUTE_TO_DATA: { enabled: false, legalReviewStatus: 'RESEARCH_REQUIRED' as const },
  ATTESTATION_PRODUCT: { enabled: false, legalReviewStatus: 'RESEARCH_REQUIRED' as const },
  INFORMATION_COMPENSATION: { enabled: false, legalReviewStatus: 'RESEARCH_REQUIRED' as const },
});
export const MARKET_LEGAL_STATUS = Object.freeze({
  status: 'RESEARCH_REQUIRED' as const,
  counselConfirmed: false,
  liveBuyer: false,
  liveResearcher: false,
  liveDataMonetization: false,
  liveAiTraining: false,
  liveSunReyCoin: false,
  liveSunReyExchange: false,
  liveSunReyChain: false,
  note: 'Simulation marketplace foundation only. Not a legal-compliance claim.',
});

export function canTransitionContribution(from: ContributionState, to: ContributionState): boolean {
  return CONTRIBUTION_TRANSITIONS[from].includes(to);
}
