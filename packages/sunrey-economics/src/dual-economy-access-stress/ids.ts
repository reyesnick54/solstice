/**
 * ACCESS-22 Dual-Economy Access Stress Laboratory identifiers.
 *
 * Engineering simulation classifications only. Not production activation,
 * not legal advice, and not a macroeconomic forecast.
 */

export const ACCESS_22_SCHEMA_VERSION = 1 as const;
export const ACCESS_22_TOOL_VERSION = 'sunrey-dual-economy-access-stress/1' as const;
export const ACCESS_22_LABEL = 'ENGINEERING_SIMULATION' as const;

/**
 * Engineering qualification flag. Set only when every ACCESS-22 engineering
 * test passes. Does not change PRODUCTION_READY, PRODUCTION_ACTIVE, or
 * LIVE_CONNECTIVITY_ENABLED.
 */
export const ACCESS_DUAL_ECONOMY_ENGINEERING_QUALIFIED = 'ACCESS_DUAL_ECONOMY_ENGINEERING_QUALIFIED' as const;
export const ACCESS_DUAL_ECONOMY_NOT_QUALIFIED = 'ACCESS_DUAL_ECONOMY_NOT_QUALIFIED' as const;

/** Participant scale tiers for qualification runs. */
export const ACCESS_22_SCALE_LEVELS = [
  'SCALE_1K',
  'SCALE_100K',
  'SCALE_1M',
  'SCALE_10M_SAMPLED',
  'SCALE_100M_AGGREGATE',
] as const;
export type Access22ScaleLevel = (typeof ACCESS_22_SCALE_LEVELS)[number];

/** CI-safe default scales; heavy scales run via separate command. */
export const ACCESS_22_CI_SCALE_LEVELS: readonly Access22ScaleLevel[] = Object.freeze(['SCALE_1K']);

/** Heavy qualification scales (not in default CI). */
export const ACCESS_22_HEAVY_SCALE_LEVELS: readonly Access22ScaleLevel[] = Object.freeze([
  'SCALE_100K',
  'SCALE_1M',
  'SCALE_10M_SAMPLED',
  'SCALE_100M_AGGREGATE',
]);

/**
 * Formal property invariants for ACCESS-22. Additive only — later chunks may
 * add invariants, never remove or loosen them.
 */
export const ACCESS_22_INVARIANT_IDS = [
  'SUM_ACCESS_ALLOCATIONS_LTE_ALLOCATABLE_CAPACITY',
  'CONFIRMED_EXTERNAL_LIABILITY_LTE_FUNDED_RESERVE',
  'NO_NATIVE_ASSET_SUPPLY_CREATED_BY_ACCESS',
  'NO_FIXED_SR_MR_RATIO',
  'NO_FIXED_TOKEN_GOODS_REDEMPTION',
  'NO_HUMAN_WORTH_SCORE',
  'NO_DATA_TO_ACCESS_DIRECT_MULTIPLIER',
  'NO_PRODUCTIVE_DOUBLE_COUNT',
  'NO_DOUBLE_REDEMPTION',
  'NO_DOUBLE_SETTLEMENT',
  'NO_DOUBLE_ENTITLEMENT_CONSUMPTION',
  'NO_PROVIDER_CAPACITY_OVERSELL',
  'NO_AI_SELF_APPROVAL',
  'NO_SIMULATION_ACTIVATES_PRODUCTION',
  'NO_PRICE_FEEDBACK_TO_ISSUANCE',
  'NO_ACCESS_FEEDBACK_TO_NATIVE_MINT',
  'EVERY_CONSEQUENTIAL_STATE_RECONSTRUCTABLE',
] as const;
export type Access22InvariantId = (typeof ACCESS_22_INVARIANT_IDS)[number];

/** Engineering stability diagnostics — not forecasts. */
export const ACCESS_22_STABILITY_CLASSIFICATIONS = [
  'HEALTHY_SIMULATION',
  'CAPACITY_STRESS',
  'ACCESS_ALLOCATION_STRESS',
  'PROVIDER_CONCENTRATION',
  'TOKEN_CONCENTRATION',
  'LIQUIDITY_STRESS',
  'SOLVENCY_STRESS',
  'ORACLE_DEPENDENCY',
  'RESERVE_STRESS',
  'DEMAND_IMBALANCE',
  'PRODUCTIVE_CONCENTRATION',
  'ACCESS_VOLATILITY',
  'SYSTEMIC_PROVIDER_FAILURE',
] as const;
export type Access22StabilityClassification = (typeof ACCESS_22_STABILITY_CLASSIFICATIONS)[number];

/** Required ACCESS-22 stress scenario IDs (45 scenarios). */
export const ACCESS_22_SCENARIO_IDS = [
  'ACCESS22-01-baseline-balanced-economy',
  'ACCESS22-02-rapid-human-adoption',
  'ACCESS22-03-rapid-productive-automation',
  'ACCESS22-04-extreme-compute-abundance',
  'ACCESS22-05-energy-scarcity',
  'ACCESS22-06-vehicle-shortage',
  'ACCESS22-07-hotel-shortage',
  'ACCESS22-08-food-shortage',
  'ACCESS22-09-mass-access-redemption',
  'ACCESS22-10-sr-price-plus-500pct',
  'ACCESS22-11-sr-price-minus-80pct',
  'ACCESS22-12-mr-price-plus-500pct',
  'ACCESS22-13-mr-price-minus-80pct',
  'ACCESS22-14-both-tokens-crash',
  'ACCESS22-15-both-tokens-rapid-appreciation',
  'ACCESS22-16-mass-fiat-to-sr-purchase',
  'ACCESS22-17-mass-fiat-to-mr-purchase',
  'ACCESS22-18-mass-token-sell-off',
  'ACCESS22-19-whale-concentration',
  'ACCESS22-20-sybil-splitting',
  'ACCESS22-21-snapshot-manipulation-attack',
  'ACCESS22-22-provider-collapse',
  'ACCESS22-23-top-provider-outage',
  'ACCESS22-24-exchange-illiquidity',
  'ACCESS22-25-exchange-halt',
  'ACCESS22-26-custody-outage',
  'ACCESS22-27-ledger-failure',
  'ACCESS22-28-fx-shock',
  'ACCESS22-29-access-reserve-depletion',
  'ACCESS22-30-refund-wave',
  'ACCESS22-31-oracle-degradation',
  'ACCESS22-32-oracle-collusion',
  'ACCESS22-33-phantom-capacity-attack',
  'ACCESS22-34-double-productive-claim',
  'ACCESS22-35-human-data-contribution-surge',
  'ACCESS22-36-low-quality-data-surge',
  'ACCESS22-37-mass-consent-revocation',
  'ACCESS22-38-productive-contribution-surge',
  'ACCESS22-39-autonomous-vehicle-abundance',
  'ACCESS22-40-post-scarcity-multi-category',
  'ACCESS22-41-multi-provider-japan-trip-failure',
  'ACCESS22-42-global-demand-spike',
  'ACCESS22-43-geographic-capacity-imbalance',
  'ACCESS22-44-policy-change-between-epochs',
  'ACCESS22-45-policy-change-during-open-reservation',
] as const;
export type Access22ScenarioId = (typeof ACCESS_22_SCENARIO_IDS)[number];

/** Permanent benchmark participant identifier. */
export const ACCESS_22_BENCHMARK_PARTICIPANT_ID = 'benchmark-100sr-100mr' as const;

/** Policy versions referenced by scenarios. */
export const ACCESS_22_POLICY_VERSIONS = Object.freeze({
  allocation: 'access-allocation/v1',
  solvency: 'access-solvency/v1',
  entitlement: 'access-entitlement/v1',
  productiveBridge: 'productive-bridge/v1',
  hinParticipation: 'hin-participation/v1',
  agentMandate: 'agent-mandate/v1',
  providerSandbox: 'provider-sandbox/v1',
});
