/**
 * Chunk 75 identifiers and integer scales.
 *
 * Simulation laboratory only. Not a ticker assignment, not a peg,
 * and not a production monetary-policy activation.
 */

export const DUAL_ECONOMY_SCHEMA_VERSION = 1 as const;
export const DUAL_ECONOMY_TOOL_VERSION = 'sunrey-economics/1' as const;
export const DUAL_ECONOMY_POLICY_CLASS = 'ENGINEERING_SIMULATION_PARAMETERS' as const;
export const SIMULATION_LABEL = 'SIMULATION' as const;
export const PRICE_DISCOVERY_LABEL = 'SIMULATION_ORDER_FLOW_ONLY' as const;
export const OUTPUT_INDEX_LABEL = 'SYNTHETIC_PRODUCTIVE_OUTPUT_INDEX' as const;
export const HUMAN_INDEX_LABEL = 'SYNTHETIC_HUMAN_ECONOMIC_PARTICIPATION_INDEX' as const;
export const AUTOMATION_INDEX_LABEL = 'SYNTHETIC_AUTOMATION_INTENSITY_INDEX' as const;
export const SYNTHETIC_GDP_LABEL = 'SYNTHETIC_GDP_STYLE_METRIC' as const;

/** Index and ratio scale. 1_000_000 = 100%. Never a yield or APY. */
export const INDEX_SCALE = 1_000_000n;
export const BASIS_POINTS = 10_000n;
export const WEIGHT_SCALE = 1_000_000n;

export const SUNREY_MONETARY_POLICY_VERSION = 'sunrey.monetary.constitution.v1' as const;
export const MOONREY_PRODUCTIVE_POLICY_VERSION = 'moonrey.issuance.formula.v1' as const;
export const FEE_POLICY_VERSION = 'sunrey.fees.v2' as const;
export const VALIDATOR_ECONOMICS_VERSION = 'sunrey.validator-economics.v1' as const;
export const BRIDGE_POLICY_VERSION = 'sunrey.economic-bridge.simulation.v1' as const;
export const EXCHANGE_MARKET_ID = 'market:sunrey-coin-moonrey-coin-native' as const;

export const FORBIDDEN_PRICE_LABELS = [
  'guaranteed value',
  'expected guaranteed return',
  'certain appreciation',
] as const;

export const ACTOR_CLASSES = [
  'HOUSEHOLD',
  'HUMAN_CREATOR',
  'HUMAN_ENTREPRENEUR',
  'COMMUNITY',
  'AI_OPERATOR',
  'ROBOT_OPERATOR',
  'ENERGY_PRODUCER',
  'COMPUTE_PROVIDER',
  'MANUFACTURER',
  'AUTONOMOUS_SERVICE_PROVIDER',
  'TREASURY_SIMULATION_ACTOR',
  'MARKET_MAKER_SIMULATION_ACTOR',
] as const;
export type ActorClass = (typeof ACTOR_CLASSES)[number];

export const BRIDGE_FLOW_KINDS = [
  'HUMAN_DEMAND_PURCHASE',
  'PRODUCTIVE_CAPACITY_CONTRACT',
  'COMPUTE_CONSUMPTION',
  'MACHINE_COMMERCE',
  'HUMAN_INFORMATION_RIGHT',
  'EXCHANGE_CONVERSION',
] as const;
export type BridgeFlowKind = (typeof BRIDGE_FLOW_KINDS)[number];

export const STABILITY_SIGNALS = [
  'HEALTHY_SIMULATION',
  'LIQUIDITY_STRESS',
  'ISSUANCE_CONCENTRATION',
  'PRODUCTIVE_CONCENTRATION',
  'ORACLE_DEPENDENCY',
  'FEE_PRESSURE',
  'DEMAND_IMBALANCE',
  'SUPPLY_GROWTH_WARNING',
] as const;
export type StabilitySignal = (typeof STABILITY_SIGNALS)[number];

export const SCENARIO_IDS = [
  'baseline',
  'rapid-automation',
  'energy-scarcity',
  'compute-abundance',
  'manufacturing-shock',
  'human-demand-shock',
  'oracle-degradation',
  'market-volatility',
  'high-concentration',
  'decentralized-productive',
  'network-congestion',
  'validator-low-fee',
  'validator-high-fee',
  'validator-unavailability',
  'validator-penalty',
  'policy-experiment',
] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

export const HUMAN_ACTIVITY_CHANNELS = [
  'participation',
  'community',
  'informationRights',
  'consumerDemand',
  'creativeContribution',
  'entrepreneurialContribution',
  'governedDistributions',
  'productiveServiceUse',
] as const;
export type HumanActivityChannel = (typeof HUMAN_ACTIVITY_CHANNELS)[number];

export const PRODUCTIVE_SIM_CATEGORIES = [
  'ENERGY',
  'COMPUTE',
  'AI_COMPUTE',
  'AUTOMATED_MACHINE_OUTPUT',
  'MANUFACTURING',
  'FOOD_AGRICULTURE',
  'WATER',
  'STORAGE',
  'LOGISTICS_TRANSPORTATION',
  'BANDWIDTH_COMMUNICATIONS',
  'MINERALS_RAW_MATERIALS',
  'REAL_ESTATE_USE',
  'SERVICES',
] as const;
export type ProductiveSimCategory = (typeof PRODUCTIVE_SIM_CATEGORIES)[number];

export const ADVERSARIAL_RANGE_IDS = [
  'ORACLE-STALE-REPLAY',
  'MOONREY-DUPLICATE-CLAIM',
  'EXCH-SELF-TRADE',
  'MACHINE-OVERSPEND',
  'COMPOUND-ORACLE-VALIDATOR-EXCHANGE',
] as const;

export const READINESS_TRACKS = [
  'simulatorImplemented',
  'baselineRun',
  'stressScenarios',
  'policyComparison',
  'economicReview',
  'humanApproval',
] as const;
export type ReadinessTrack = (typeof READINESS_TRACKS)[number];
