/**
 * ACCESS-13 Access Economy simulation identifiers.
 *
 * Engineering simulation classifications only. Nothing here is a legal
 * eligibility determination, a production activation, or a monetary unit.
 */

export const ACCESS_ECONOMY_SCHEMA_VERSION = 1 as const;
export const ACCESS_ECONOMY_TOOL_VERSION = 'sunrey-access-economy/1' as const;
export const ACCESS_ECONOMY_LABEL = 'ENGINEERING_SIMULATION' as const;

/**
 * Engineering completion candidate for the Access Fabric code base.
 * Deliberately distinct from PRODUCTION_READY, LIVE_CONNECTIVITY_ENABLED,
 * and PRODUCTION_ACTIVE, which only humans and external gates may set.
 */
export const ACCESS_FABRIC_QUALIFICATION_STATE = 'ACCESS_FABRIC_CODE_COMPLETE_CANDIDATE' as const;

export const ACCESS_SIM_SCENARIO_IDS = [
  'ACCESS-SIM-01-abundance',
  'ACCESS-SIM-02-demand-surge',
  'ACCESS-SIM-03-productive-shock',
  'ACCESS-SIM-04-geographic-scarcity',
  'ACCESS-SIM-05-temporal-scarcity',
  'ACCESS-SIM-06-provider-failure',
  'ACCESS-SIM-07-oracle-stale',
  'ACCESS-SIM-08-exchange-unavailable',
  'ACCESS-SIM-09-settlement-failure',
  'ACCESS-SIM-10-policy-change-during-reservation',
  'ACCESS-SIM-11-mass-reservation-concurrency',
  'ACCESS-SIM-12-abundant-vehicle-class',
  'ACCESS-SIM-13-premium-scarce-vehicle',
  'ACCESS-SIM-14-japan-composite-travel',
  'ACCESS-SIM-15-household-food-access',
  'ACCESS-SIM-16-compute-capacity',
  'ACCESS-SIM-17-robot-capacity',
  'ACCESS-SIM-18-energy-access',
] as const;
export type AccessSimScenarioId = (typeof ACCESS_SIM_SCENARIO_IDS)[number];

/**
 * Permanent Access Economy invariants. These are additive only: a later
 * chunk may add an invariant, never remove or loosen one.
 */
export const ACCESS_ECONOMY_INVARIANT_IDS = [
  'NO_OVERSOLD_PRODUCTIVE_CAPACITY',
  'NO_AI_SELF_APPROVAL',
  'ACCESS_IS_NOT_A_COIN',
  'NO_NEW_MONETARY_AUTHORITY',
  'NO_HUMAN_WORTH_SCORING',
  'NO_SOCIAL_CREDIT_SCORING',
  'NO_RAW_SENSITIVE_PERSONAL_INFORMATION_ON_CHAIN',
  'NO_RESERVATION_WITHOUT_REQUIRED_AUTHORITY',
  'NO_SILENT_LEGAL_ELIGIBILITY_INFERENCE',
  'NO_SECOND_LEDGER',
  'NO_SECOND_EXCHANGE',
  'NO_SECOND_CUSTODY_SYSTEM',
  'NO_AUTOMATIC_SUNREY_ISSUANCE',
  'NO_AUTOMATIC_MOONREY_ISSUANCE',
  'NO_FIXED_SUNREY_MOONREY_PEG',
  'NO_ACCESS_RIGHT_IMPLIES_OWNERSHIP',
  'NO_CAPACITY_CREATED_BY_QUERY',
  'NO_PROVIDER_SELF_REPORT_TRUSTED_WHERE_INDEPENDENT_PROOF_REQUIRED',
  'EVERY_CONSEQUENTIAL_TRANSITION_RECONSTRUCTABLE',
  'SIMULATION_CANNOT_ACTIVATE_PRODUCTION',
  'BFF_CANNOT_INVENT_CAPACITY_OR_PRICING',
  'ENTITLEMENT_IS_NOT_TRANSFERABLE_MONEY',
  'MANDATE_CANNOT_EXPAND_ITS_OWN_AUTHORITY',
] as const;
export type AccessEconomyInvariantId = (typeof ACCESS_ECONOMY_INVARIANT_IDS)[number];

export const ACCESS_SCARCITY_MODES = [
  'ABUNDANT',
  'CONSTRAINED',
  'SCARCE',
  'UNAVAILABLE',
] as const;
export type AccessScarcityMode = (typeof ACCESS_SCARCITY_MODES)[number];

export const ACCESS_SCARCITY_DIMENSIONS = [
  'AGGREGATE',
  'GEOGRAPHIC',
  'TEMPORAL',
  'PROVIDER',
] as const;
export type AccessScarcityDimension = (typeof ACCESS_SCARCITY_DIMENSIONS)[number];

/**
 * Terminal outcome of one simulated access request. REFUSED outcomes are
 * first-class correct results, not errors to be worked around.
 */
export const ACCESS_DECISION_OUTCOMES = [
  'QUOTED',
  'RESERVED',
  'CONFIRMED',
  'HELD_FOR_POLICY_REVIEW',
  'REFUSED_CAPACITY_EXHAUSTED',
  'REFUSED_NO_EXECUTION_AUTHORITY',
  'REFUSED_NOT_ELIGIBLE',
  'REFUSED_ELIGIBILITY_UNDETERMINED',
  'REFUSED_STALE_EVIDENCE',
  'REFUSED_PROVIDER_UNAVAILABLE',
  'REFUSED_PRICING_UNAVAILABLE',
  'REFUSED_SETTLEMENT_FAILED',
  'REFUSED_AI_SELF_APPROVAL',
] as const;
export type AccessDecisionOutcome = (typeof ACCESS_DECISION_OUTCOMES)[number];

export const ACCESS_REFUSAL_OUTCOMES: readonly AccessDecisionOutcome[] = Object.freeze(
  ACCESS_DECISION_OUTCOMES.filter((outcome) => outcome.startsWith('REFUSED_')),
);

/**
 * Shocks the Access Economy simulator can apply. Named separately from the
 * Chunk 76 protocol shock vocabulary because they act on access capacity,
 * not on chain accounting.
 */
export const ACCESS_SHOCK_KINDS = [
  'ACCESS_ABUNDANCE_EXPANSION',
  'ACCESS_DEMAND_SURGE',
  'ACCESS_PRODUCTIVE_CAPACITY_FALL',
  'ACCESS_GEOGRAPHIC_CONCENTRATION',
  'ACCESS_TEMPORAL_PEAK',
  'ACCESS_PROVIDER_OUTAGE',
  'ACCESS_ORACLE_STALE',
  'ACCESS_EXCHANGE_UNAVAILABLE',
  'ACCESS_SETTLEMENT_FAILURE',
  'ACCESS_POLICY_CHANGE_MID_RESERVATION',
  'ACCESS_MASS_CONCURRENCY',
  'ACCESS_AGENT_SELF_APPROVAL_ATTEMPT',
  'ACCESS_AUTHORITY_WITHHELD',
] as const;
export type AccessShockKind = (typeof ACCESS_SHOCK_KINDS)[number];

/**
 * Canonical owners the Access Economy simulation consumes. The simulation
 * never implements any of these planes itself.
 */
export const ACCESS_CANONICAL_INTEGRATIONS = Object.freeze({
  entitlements: 'packages/access-fabric',
  ledger: 'packages/ledger',
  exchange: 'packages/sunrey-exchange',
  custody: 'packages/custody',
  kernel: 'packages/kernel',
  executionAuthority: 'packages/permissions',
  evidence: 'packages/evidence',
  productiveOracle: 'packages/sunrey-chain',
  monetaryConstitution: 'packages/sunrey-chain',
  simulationOwner: 'packages/sunrey-economics',
});

/**
 * Asset-like names that must never appear in Access Economy state. There is
 * no access-denominated currency, credit balance, or transferable unit.
 */
export const FORBIDDEN_ACCESS_ASSET_TOKENS = [
  'accesscoin',
  'access-coin',
  'access_coin',
  'accesscurrency',
  'access_currency',
  'accessdollar',
  'access_dollar',
  'accessmoney',
  'access_money',
  'accesscredits',
  'access_credits',
] as const;

/** Sensitive payload keys that must never be sealed into simulated evidence. */
export const FORBIDDEN_ACCESS_EVIDENCE_KEYS = [
  'rawPdvContent',
  'rawPdv',
  'raw_pdv',
  'passportNumber',
  'nationalIdNumber',
  'medicalRecord',
  'biometricTemplate',
  'creditBureauRaw',
  'humanWorthScore',
  'socialCreditScore',
] as const;

export const ACCESS_ECONOMY_EVIDENCE_KINDS = [
  'access.scenario.opened',
  'access.capacity.published',
  'access.envelope.evaluated',
  'access.request.decided',
  'access.reservation.expired',
  'access.policy.changed',
  'access.scenario.sealed',
] as const;
export type AccessEconomyEvidenceKind = (typeof ACCESS_ECONOMY_EVIDENCE_KINDS)[number];
