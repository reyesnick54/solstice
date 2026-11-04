/**
 * HELIOS HEALTH06 — engineering baseline hardening taxonomy.
 * Qualification only; does not activate production or live trading.
 */

export const HELIOS_ENGINEERING_BASELINE_SCHEMA =
  'sunrey.helios.engineering-baseline.v2' as const;

export const HELIOS_ENGINEERING_BASELINE_V2_QUALIFIED =
  'HELIOS_ENGINEERING_BASELINE_V2_QUALIFIED' as const;

export const HELIOS_ENGINEERING_BASELINE_V2_BLOCKED =
  'HELIOS_ENGINEERING_BASELINE_V2_BLOCKED' as const;

export const HEALTH06_PROGRAM = 'HELIOS_HARDENING_HEALTH06' as const;

export const ENGINEERING_BASELINE_SCORECARD_DIMENSIONS = [
  'type_safety',
  'architecture_integrity',
  'formal_assurance',
  'memory_stability',
  'determinism',
  'restart_safety',
  'test_coverage',
  'release_reproducibility',
] as const;

export type EngineeringBaselineScorecardDimension =
  (typeof ENGINEERING_BASELINE_SCORECARD_DIMENSIONS)[number];

export type EngineeringBaselineGateId =
  | 'normal_ci'
  | 'helios_release_candidate'
  | 'helios_strict_scoped_typecheck'
  | 'architecture_lint'
  | 'production_safety'
  | 'aaf_v2_qualification'
  | 'earn01_earn12_qualification'
  | 'native_assimilation_qualification'
  | 'strategy_lab'
  | 'execution_twin'
  | 'agent_permissions'
  | 'provider_conformance'
  | 'database_migrations'
  | 'fuzz_extended'
  | 'formal_extended'
  | 'bench_nightly'
  | 'memory_soak'
  | 'restart_recovery'
  | 'live_trading_disabled'
  | 'production_authorized_disabled';
