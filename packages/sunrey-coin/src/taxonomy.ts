export const SUNREY_COIN_DISPLAY_NAME = 'SunRey Coin';

export const TICKER_STATUS = 'NOT_ASSIGNED' as const;
export type TickerStatus = typeof TICKER_STATUS;

export const ASSET_LEGAL_CLASSIFICATION = 'UNCLASSIFIED_SIMULATION' as const;

export const SUPPLY_POLICY_LEGAL_STATE = 'ENGINEERING_SIMULATION' as const;

export const ELIGIBILITY_STATES = [
  'ELIGIBLE_SIMULATION',
  'REVIEW_REQUIRED',
  'INELIGIBLE',
  'DUPLICATE',
  'INSUFFICIENT_EVIDENCE',
  'POLICY_DISABLED',
] as const;
export type EligibilityState = (typeof ELIGIBILITY_STATES)[number];

export const UTILITY_CONCEPTS = [
  'NETWORK_FEES',
  'COMPUTE_INTELLIGENCE',
  'DEVELOPER_SERVICES',
  'MARKETPLACE_SETTLEMENT',
  'USER_REWARDS',
  'NETWORK_SECURITY',
  'GOVERNANCE',
] as const;
export type UtilityConcept = (typeof UTILITY_CONCEPTS)[number];

export const UTILITY_STATUSES = [
  'SIMULATION_SUPPORTED',
  'PLANNED',
  'DISABLED_PENDING_REVIEW',
] as const;
export type UtilityStatus = (typeof UTILITY_STATUSES)[number];

export const HOLD_STATES = ['ACTIVE', 'CAPTURED', 'RELEASED', 'EXPIRED'] as const;
export type CoinHoldState = (typeof HOLD_STATES)[number];

export const RECONCILIATION_OUTCOMES = [
  'MATCHED',
  'PENDING',
  'SUPPLY_MISMATCH',
  'POSITION_MISMATCH',
  'DUPLICATE_ISSUANCE',
  'INVESTIGATION_REQUIRED',
] as const;
export type ReconciliationOutcome = (typeof RECONCILIATION_OUTCOMES)[number];

export const GROWTH_CLASSIFICATION = {
  kind: 'DIGITAL_ASSET_SIMULATION',
  marketPrice: 'UNAVAILABLE',
  marketPriceImplementation: 'NOT_IMPLEMENTED',
  uncertainty: 'HIGH_UNCERTAINTY',
  returnGuarantee: 'NO_GUARANTEED_RETURN',
} as const;

export const EVIDENCE_KIND_SUNREY_COIN = 'SUNREY_COIN' as const;

export const SUNREY_COIN_LEGAL_STATUS = 'RESEARCH_REQUIRED' as const;

export const PROTECTED_TRAITS = [
  'race',
  'religion',
  'ethnicity',
  'political belief',
  'political_belief',
  'sexual orientation',
  'sexual_orientation',
  'disability',
  'genetic status',
  'genetic_status',
  'medical condition',
  'medical_condition',
] as const;

export const UTILITY_REGISTRY: readonly {
  readonly concept: UtilityConcept;
  readonly status: UtilityStatus;
}[] = [
  { concept: 'NETWORK_FEES', status: 'SIMULATION_SUPPORTED' },
  { concept: 'COMPUTE_INTELLIGENCE', status: 'PLANNED' },
  { concept: 'DEVELOPER_SERVICES', status: 'PLANNED' },
  { concept: 'MARKETPLACE_SETTLEMENT', status: 'DISABLED_PENDING_REVIEW' },
  { concept: 'USER_REWARDS', status: 'SIMULATION_SUPPORTED' },
  { concept: 'NETWORK_SECURITY', status: 'PLANNED' },
  { concept: 'GOVERNANCE', status: 'DISABLED_PENDING_REVIEW' },
];
