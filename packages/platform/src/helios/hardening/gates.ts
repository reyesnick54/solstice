import type { EngineeringBaselineGateId, EngineeringBaselineScorecardDimension } from './taxonomy.ts';

export type EngineeringBaselineGateResult = Readonly<{
  gateId: EngineeringBaselineGateId;
  pass: boolean;
  detail: string;
  durationMs?: number;
}>;

export type EngineeringBaselineScorecardRow = Readonly<{
  dimension: EngineeringBaselineScorecardDimension;
  status: 'PASS' | 'FAIL' | 'PENDING';
  contributingGates: readonly EngineeringBaselineGateId[];
  detail: string;
}>;

const GATE_TO_DIMENSION: Record<EngineeringBaselineGateId, EngineeringBaselineScorecardDimension> =
  Object.freeze({
    normal_ci: 'test_coverage',
    helios_release_candidate: 'release_reproducibility',
    helios_strict_scoped_typecheck: 'type_safety',
    architecture_lint: 'architecture_integrity',
    production_safety: 'architecture_integrity',
    aaf_v2_qualification: 'test_coverage',
    earn01_earn12_qualification: 'test_coverage',
    native_assimilation_qualification: 'test_coverage',
    strategy_lab: 'test_coverage',
    execution_twin: 'determinism',
    agent_permissions: 'architecture_integrity',
    provider_conformance: 'test_coverage',
    database_migrations: 'release_reproducibility',
    fuzz_extended: 'determinism',
    formal_extended: 'formal_assurance',
    bench_nightly: 'memory_stability',
    memory_soak: 'memory_stability',
    restart_recovery: 'restart_safety',
    live_trading_disabled: 'architecture_integrity',
    production_authorized_disabled: 'architecture_integrity',
  });

export function buildEngineeringBaselineScorecard(
  gates: readonly EngineeringBaselineGateResult[],
): readonly EngineeringBaselineScorecardRow[] {
  const byDimension = new Map<
    EngineeringBaselineScorecardDimension,
    { gates: EngineeringBaselineGateId[]; failures: string[] }
  >();

  for (const dimension of [
    'type_safety',
    'architecture_integrity',
    'formal_assurance',
    'memory_stability',
    'determinism',
    'restart_safety',
    'test_coverage',
    'release_reproducibility',
  ] as const) {
    byDimension.set(dimension, { gates: [], failures: [] });
  }

  for (const gate of gates) {
    const dimension = GATE_TO_DIMENSION[gate.gateId];
    const bucket = byDimension.get(dimension)!;
    bucket.gates.push(gate.gateId);
    if (!gate.pass) {
      bucket.failures.push(`${gate.gateId}: ${gate.detail}`);
    }
  }

  return Object.freeze(
    [...byDimension.entries()].map(([dimension, bucket]) => {
      const status = bucket.gates.length === 0 ? 'PENDING' : bucket.failures.length === 0 ? 'PASS' : 'FAIL';
      return Object.freeze({
        dimension,
        status,
        contributingGates: Object.freeze([...bucket.gates]),
        detail:
          status === 'PASS'
            ? 'All contributing gates passed'
            : status === 'PENDING'
              ? 'No gates recorded for this dimension'
              : bucket.failures.slice(0, 4).join('; '),
      });
    }),
  );
}
