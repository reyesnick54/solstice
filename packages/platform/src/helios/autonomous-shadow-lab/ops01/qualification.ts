import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { UtcInstant } from '@solstice/domain';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '@solstice/config';

import { evaluateAutonomousShadowLabQualification } from '../alpha25-qualification.ts';
import {
  HELIOS_DURABLE_SHADOW_LAB_RUNTIME_SCHEMA,
  HELIOS_DURABLE_SHADOW_LAB_RUNTIME_V1_BLOCKED,
  HELIOS_DURABLE_SHADOW_LAB_RUNTIME_V1_QUALIFIED,
} from './taxonomy.ts';
import { runAllRestartCrashPoints } from './restart-harness.ts';
import type { ShadowLabRestartHarnessResult } from './types.ts';

export type DurableShadowLabRuntimeQualificationInput = {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly restartResults?: readonly ShadowLabRestartHarnessResult[];
};

export type DurableShadowLabRuntimeQualificationResult = {
  readonly schema: typeof HELIOS_DURABLE_SHADOW_LAB_RUNTIME_SCHEMA;
  readonly marker:
    | typeof HELIOS_DURABLE_SHADOW_LAB_RUNTIME_V1_QUALIFIED
    | typeof HELIOS_DURABLE_SHADOW_LAB_RUNTIME_V1_BLOCKED;
  readonly qualified: boolean;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly blockers: readonly string[];
  readonly restartResults: readonly ShadowLabRestartHarnessResult[];
};

const REQUIRED_PATHS = Object.freeze([
  'db/customer/migrations/V072__helios_autonomous_shadow_lab_runtime.sql',
  'packages/platform/src/helios/autonomous-shadow-lab/ops01/service.ts',
  'packages/persistence/src/growth/pg-helios-shadow-lab-runtime-store.ts',
  'docs/helios/ops/HELIOS_SHADOW_LAB_RUNTIME_RUNBOOK.md',
  'deploy/helios-shadow-lab-runtime.json',
  'tests/helios-ops01-durable-shadow-lab-runtime.test.ts',
]);

export async function evaluateDurableShadowLabRuntimeQualification(
  input: DurableShadowLabRuntimeQualificationInput,
): Promise<DurableShadowLabRuntimeQualificationResult> {
  const blockers: string[] = [];

  for (const rel of REQUIRED_PATHS) {
    if (!existsSync(join(input.root, rel))) {
      blockers.push(`missing: ${rel}`);
    }
  }

  if (ENVIRONMENT !== 'simulation') {
    blockers.push('ENVIRONMENT must be simulation');
  }
  if (LIVE_TRADING_ENABLED) {
    blockers.push('LIVE_TRADING_ENABLED must be false');
  }

  const alpha25 = evaluateAutonomousShadowLabQualification({
    root: input.root,
    gitSha: input.gitSha,
    evaluatedAt: input.evaluatedAt,
    subprocessGatesOk: true,
  });
  if (!alpha25.qualified) {
    blockers.push('ALPHA25 prerequisite not qualified');
    blockers.push(...alpha25.blockers);
  }

  const restartResults =
    input.restartResults ??
    (await runAllRestartCrashPoints({
      campaignId: 'camp_qual_restart',
      now: input.evaluatedAt,
      strategyIds: Object.freeze(['strat-a', 'strat-b']),
    }));

  for (const result of restartResults) {
    if (!result.passed) {
      blockers.push(`restart harness failed at ${result.crashPoint}`);
    }
  }

  const qualified = blockers.length === 0;

  return Object.freeze({
    schema: HELIOS_DURABLE_SHADOW_LAB_RUNTIME_SCHEMA,
    marker: qualified
      ? HELIOS_DURABLE_SHADOW_LAB_RUNTIME_V1_QUALIFIED
      : HELIOS_DURABLE_SHADOW_LAB_RUNTIME_V1_BLOCKED,
    qualified,
    gitSha: input.gitSha,
    evaluatedAt: input.evaluatedAt,
    blockers: Object.freeze(blockers),
    restartResults: Object.freeze(restartResults),
  });
}
