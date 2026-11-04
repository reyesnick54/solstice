import { evaluateLiveSafetyAssertions } from '../open-source/live-safety.ts';
import {
  buildEngineeringBaselineScorecard,
  type EngineeringBaselineGateResult,
  type EngineeringBaselineScorecardRow,
} from './gates.ts';
import {
  HELIOS_ENGINEERING_BASELINE_SCHEMA,
  HELIOS_ENGINEERING_BASELINE_V2_BLOCKED,
  HELIOS_ENGINEERING_BASELINE_V2_QUALIFIED,
  HEALTH06_PROGRAM,
  type EngineeringBaselineGateId,
} from './taxonomy.ts';

export type EngineeringBaselineQualificationInput = Readonly<{
  root: string;
  gitSha: string;
  evaluatedAt: string;
  gates: readonly EngineeringBaselineGateResult[];
}>;

export type EngineeringBaselineQualificationResult = Readonly<{
  schema: typeof HELIOS_ENGINEERING_BASELINE_SCHEMA;
  program: typeof HEALTH06_PROGRAM;
  marker:
    | typeof HELIOS_ENGINEERING_BASELINE_V2_QUALIFIED
    | typeof HELIOS_ENGINEERING_BASELINE_V2_BLOCKED;
  qualified: boolean;
  gitSha: string;
  evaluatedAt: string;
  gates: readonly EngineeringBaselineGateResult[];
  scorecard: readonly EngineeringBaselineScorecardRow[];
  liveSafetyPass: boolean;
  blockers: readonly string[];
}>;

const MANDATORY_GATE_IDS: readonly EngineeringBaselineGateId[] = Object.freeze([
  'normal_ci',
  'helios_release_candidate',
  'helios_strict_scoped_typecheck',
  'architecture_lint',
  'production_safety',
  'aaf_v2_qualification',
  'earn01_earn12_qualification',
  'native_assimilation_qualification',
  'strategy_lab',
  'execution_twin',
  'agent_permissions',
  'provider_conformance',
  'database_migrations',
  'fuzz_extended',
  'formal_extended',
  'bench_nightly',
  'memory_soak',
  'restart_recovery',
  'live_trading_disabled',
  'production_authorized_disabled',
]);

export function evaluateEngineeringBaselineQualification(
  input: EngineeringBaselineQualificationInput,
): EngineeringBaselineQualificationResult {
  const liveSafety = evaluateLiveSafetyAssertions(input.root);
  const gateMap = new Map(input.gates.map((row) => [row.gateId, row]));
  const blockers: string[] = [];

  for (const gateId of MANDATORY_GATE_IDS) {
    const row = gateMap.get(gateId);
    if (!row) {
      blockers.push(`missing gate result: ${gateId}`);
      continue;
    }
    if (!row.pass) {
      blockers.push(`${gateId}: ${row.detail}`);
    }
  }

  if (!liveSafety.pass) {
    for (const assertion of liveSafety.assertions) {
      if (!assertion.pass) {
        blockers.push(`live safety: ${assertion.name} expected ${String(assertion.expected)} got ${String(assertion.actual)}`);
      }
    }
  }

  const trading = liveSafety.assertions.find((row) => row.name === 'LIVE_TRADING_ENABLED');
  const productionAuthorized = liveSafety.assertions.find(
    (row) => row.name === 'production_authorized (authority map)',
  );
  if (trading && !trading.pass) {
    blockers.push('LIVE_TRADING_ENABLED must remain false');
  }
  if (productionAuthorized && !productionAuthorized.pass) {
    blockers.push('production_authorized must remain false');
  }

  const qualified = blockers.length === 0;
  const scorecard = buildEngineeringBaselineScorecard(input.gates);

  return Object.freeze({
    schema: HELIOS_ENGINEERING_BASELINE_SCHEMA,
    program: HEALTH06_PROGRAM,
    marker: qualified
      ? HELIOS_ENGINEERING_BASELINE_V2_QUALIFIED
      : HELIOS_ENGINEERING_BASELINE_V2_BLOCKED,
    qualified,
    gitSha: input.gitSha,
    evaluatedAt: input.evaluatedAt,
    gates: input.gates,
    scorecard,
    liveSafetyPass: liveSafety.pass,
    blockers: Object.freeze(blockers),
  });
}
