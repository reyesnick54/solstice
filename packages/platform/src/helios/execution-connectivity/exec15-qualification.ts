import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { UtcInstant } from '@solstice/domain';

import { runAllExec15AdversarialScenarios, assertExecutionSurfacesDisabledInAdversarialSuite } from './adversarial-qualification.ts';
import { runExec15SyntheticE2ePipeline } from './e2e-pipeline.ts';
import { assertExecutionConnectivityRealitySafe } from './reality-gate.ts';
import {
  HELIOS_BROKER_CUSTODY_EXECUTION_V1_BLOCKED,
  HELIOS_BROKER_CUSTODY_EXECUTION_V1_QUALIFIED,
  HELIOS_EXECUTION_CONNECTIVITY_SCHEMA,
} from './taxonomy.ts';
import { listExecWorkPackages } from './work-package-registry.ts';

export type ExecutionConnectivityQualificationInput = {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly qualificationTestPresent?: boolean;
  readonly subprocessGatesOk?: boolean;
};

export type ExecutionConnectivityQualificationResult = {
  readonly schema: typeof HELIOS_EXECUTION_CONNECTIVITY_SCHEMA;
  readonly marker:
    | typeof HELIOS_BROKER_CUSTODY_EXECUTION_V1_QUALIFIED
    | typeof HELIOS_BROKER_CUSTODY_EXECUTION_V1_BLOCKED;
  readonly qualified: boolean;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly workPackages: ReturnType<typeof listExecWorkPackages>;
  readonly e2ePipelineOk: boolean;
  readonly adversarialScenariosPassed: number;
  readonly adversarialScenariosTotal: number;
  readonly blockers: readonly string[];
};

const DOCS = Object.freeze([
  'docs/helios/execution/HELIOS_EXECUTION_CONNECTIVITY_FINAL_REPORT.md',
  'docs/helios/execution/EXECUTION_CAPABILITY_MATRIX.md',
  'docs/helios/execution/BROKER_CONFORMANCE_REPORT.md',
  'docs/helios/execution/CUSTODY_RECONCILIATION_REPORT.md',
  'docs/helios/execution/EXECUTION_CHAOS_REPORT.md',
  'docs/helios/execution/BEST_EXECUTION_ENGINEERING_EVIDENCE.md',
]);

export function evaluateExecutionConnectivityQualification(
  input: ExecutionConnectivityQualificationInput,
): ExecutionConnectivityQualificationResult {
  const workPackages = listExecWorkPackages(input.root);
  const blockers: string[] = [];

  if (!workPackages.every((row) => row.status === 'IMPLEMENTED')) {
    blockers.push(
      ...workPackages.filter((row) => row.status === 'BLOCKED').map((row) => `${row.packageId}:${row.moduleRef}`),
    );
  }

  const testPath = join(input.root, 'tests/helios-exec15-execution-connectivity-qualification.test.ts');
  if (input.qualificationTestPresent !== false && !existsSync(testPath)) {
    blockers.push('tests/helios-exec15-execution-connectivity-qualification.test.ts missing');
  }

  try {
    assertExecutionConnectivityRealitySafe(input.root);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    blockers.push(message);
  }

  if (!assertExecutionSurfacesDisabledInAdversarialSuite()) {
    blockers.push('LIVE_TRADING_ENABLED or LIVE_INVESTMENT_EXECUTION must remain false');
  }

  for (const doc of DOCS) {
    if (!existsSync(join(input.root, doc))) {
      blockers.push(`missing documentation: ${doc}`);
    }
  }

  const e2e = runExec15SyntheticE2ePipeline({
    nowUtc: input.evaluatedAt,
    eventTime: '2026-06-01T14:30:00.000Z',
    knowableAt: '2026-06-01T14:30:00.500Z',
    mandateMaxNotionalMinor: 1_000_000n,
    proposedNotionalMinor: 500_000n,
    kernelAllowed: true,
  });
  if (!e2e.ok) {
    blockers.push('synthetic E2E execution pipeline failed');
    for (const row of e2e.stages.filter((stage) => !stage.ok)) {
      blockers.push(`e2e:${row.stage}:${row.detail}`);
    }
  }
  if (e2e.grantsExecutionAuthority !== false || e2e.grantsLiveBrokerSubmit !== false) {
    blockers.push('E2E pipeline must not grant execution authority or live broker submit');
  }

  const adversarial = runAllExec15AdversarialScenarios();
  const passed = adversarial.filter((row) => row.passed).length;
  if (passed !== adversarial.length) {
    for (const row of adversarial.filter((r) => !r.passed)) {
      blockers.push(`adversarial scenario failed: ${row.scenarioId} — ${row.detail}`);
    }
  }

  if (input.subprocessGatesOk === false) {
    blockers.push('EXEC15 subprocess qualification gates not green');
  }

  const qualified = blockers.length === 0;

  return Object.freeze({
    schema: HELIOS_EXECUTION_CONNECTIVITY_SCHEMA,
    marker: qualified
      ? HELIOS_BROKER_CUSTODY_EXECUTION_V1_QUALIFIED
      : HELIOS_BROKER_CUSTODY_EXECUTION_V1_BLOCKED,
    qualified,
    gitSha: input.gitSha,
    evaluatedAt: input.evaluatedAt,
    workPackages,
    e2ePipelineOk: e2e.ok,
    adversarialScenariosPassed: passed,
    adversarialScenariosTotal: adversarial.length,
    blockers: Object.freeze(blockers),
  });
}
