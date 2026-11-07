/**
 * HELIOS EXEC07 — transaction cost analysis and execution quality intelligence.
 * Measurement only. Does not issue Execution Authority or change live routing.
 */

export const HELIOS_EXEC07_TCA_SCHEMA = 'sunrey.helios.execution_connectivity.exec07.v1' as const;

export const EXECUTION_BENCHMARK_KINDS = [
  'DECISION_PRICE',
  'ARRIVAL_PRICE',
  'MID_AT_ARRIVAL',
  'NBBO',
  'BBO',
  'VWAP',
  'CLOSE',
  'IMPLEMENTATION_SHORTFALL',
] as const;

export type ExecutionBenchmarkKind = (typeof EXECUTION_BENCHMARK_KINDS)[number];

export const EXECUTION_ALGORITHM_KINDS = [
  'MARKET',
  'LIMIT',
  'PASSIVE_LIMIT',
  'TWAP',
  'VWAP_SLICE',
  'ICEBERG',
  'SMART_ROUTER',
  'OTHER',
] as const;

export type ExecutionAlgorithmKind = (typeof EXECUTION_ALGORITHM_KINDS)[number];

export const EXEC07_EVIDENCE_KINDS = [
  'HELIOS_EXEC07_EXECUTION_QUALITY',
  'HELIOS_EXEC07_ROUTER_LEARNING_HINT',
  'HELIOS_EXEC07_EXECUTION_POLICY_NICHE',
] as const;

export type Exec07EvidenceKind = (typeof EXEC07_EVIDENCE_KINDS)[number];

export const HELIOS_EXEC07_TCA_QUALIFIED = 'HELIOS_EXEC07_TCA_QUALIFIED' as const;
export const HELIOS_EXEC07_TCA_BLOCKED = 'HELIOS_EXEC07_TCA_BLOCKED' as const;

export const EXEC07_RULE_FLAGS = Object.freeze({
  SEPARATES_STRATEGY_ALPHA_FROM_EXECUTION: true,
  BENCHMARK_INCOMPLETE_SUPPRESSES_STRATEGY_CREDIT: true,
  EXECUTION_LEARNING_SEPARATE_FROM_SIGNAL_EVOLUTION: true,
  GRANTS_EXECUTION_AUTHORITY: false as const,
  SIMULATION_ONLY: true as const,
});
