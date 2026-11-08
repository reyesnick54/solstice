/**
 * ALPHA25 — final autonomous shadow investment laboratory qualification.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { UtcInstant } from '@solstice/domain';

import { evaluateForwardAlphaEvidenceQualification } from '../forward-alpha-evidence/alpha15-qualification.ts';
import { assertForwardAlphaProductionPosture } from '../forward-alpha-evidence/production-posture.ts';

import { runShadowLabChaosHarness } from './chaos/resilience-harness.ts';
import { evaluateShadowLabRealityGate } from './reality-gate.ts';
import { runShadowLabLongRun } from './simulation/long-run-harness.ts';
import {
  HELIOS_AUTONOMOUS_SHADOW_LAB_SCHEMA,
  HELIOS_AUTONOMOUS_SHADOW_LAB_V1_BLOCKED,
  HELIOS_AUTONOMOUS_SHADOW_LAB_V1_QUALIFIED,
} from './taxonomy.ts';
import type { ShadowLabChaosHarnessResult, ShadowLabLongRunResult, ShadowLabRealityGateResult } from './types.ts';
import {
  buildShadowLabWorkPackageRegistry,
  shadowLabWorkPackageBlockers,
  shadowLabWorkPackagesQualified,
} from './work-package-registry.ts';

export {
  HELIOS_AUTONOMOUS_SHADOW_LAB_SCHEMA,
  HELIOS_AUTONOMOUS_SHADOW_LAB_V1_BLOCKED,
  HELIOS_AUTONOMOUS_SHADOW_LAB_V1_QUALIFIED,
} from './taxonomy.ts';

const SHADOW_LAB_DOCS = Object.freeze([
  'docs/helios/alpha/HELIOS_AUTONOMOUS_SHADOW_LAB_FINAL_REPORT.md',
  'docs/helios/alpha/SHADOW_LAB_CAPABILITY_MATRIX.md',
  'docs/helios/alpha/SHADOW_LAB_RESILIENCE_REPORT.md',
  'docs/helios/alpha/SHADOW_LAB_OPERATIONS_REPORT.md',
  'docs/helios/alpha/SHADOW_LAB_EVIDENCE_INTEGRITY_REPORT.md',
]);

export type AutonomousShadowLabQualificationInput = {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly qualificationTestPresent?: boolean;
  readonly subprocessGatesOk?: boolean;
  readonly longRun?: ShadowLabLongRunResult;
  readonly chaos?: ShadowLabChaosHarnessResult;
};

export type AutonomousShadowLabQualificationResult = {
  readonly schema: typeof HELIOS_AUTONOMOUS_SHADOW_LAB_SCHEMA;
  readonly marker:
    | typeof HELIOS_AUTONOMOUS_SHADOW_LAB_V1_QUALIFIED
    | typeof HELIOS_AUTONOMOUS_SHADOW_LAB_V1_BLOCKED;
  readonly qualified: boolean;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly workPackages: ReturnType<typeof buildShadowLabWorkPackageRegistry>;
  readonly longRun: ShadowLabLongRunResult;
  readonly chaos: ShadowLabChaosHarnessResult;
  readonly realityGate: ShadowLabRealityGateResult;
  readonly blockers: readonly string[];
};

export function evaluateAutonomousShadowLabQualification(
  input: AutonomousShadowLabQualificationInput,
): AutonomousShadowLabQualificationResult {
  const blockers: string[] = [];
  const workPackages = buildShadowLabWorkPackageRegistry(input.root);

  if (!shadowLabWorkPackagesQualified(workPackages)) {
    blockers.push(...shadowLabWorkPackageBlockers(workPackages));
  }

  const testPath = join(input.root, 'tests/helios-alpha25-autonomous-shadow-lab-qualification.test.ts');
  if (input.qualificationTestPresent !== false && !existsSync(testPath)) {
    blockers.push('tests/helios-alpha25-autonomous-shadow-lab-qualification.test.ts missing');
  }

  try {
    assertForwardAlphaProductionPosture(input.root);
  } catch (error: unknown) {
    blockers.push(error instanceof Error ? error.message : String(error));
  }

  for (const doc of SHADOW_LAB_DOCS) {
    if (!existsSync(join(input.root, doc))) {
      blockers.push(`missing documentation: ${doc}`);
    }
  }

  const alpha15 = evaluateForwardAlphaEvidenceQualification({
    root: input.root,
    gitSha: input.gitSha,
    evaluatedAt: input.evaluatedAt,
    subprocessGatesOk: true,
    qualificationTestPresent: true,
  });
  if (!alpha15.qualified) {
    blockers.push('ALPHA16 prerequisite: ALPHA15 forward-alpha evidence not qualified');
    blockers.push(...alpha15.blockers);
  }

  const longRun =
    input.longRun ??
    runShadowLabLongRun({
      campaignId: 'qualification-campaign',
      now: input.evaluatedAt,
      strategyIds: ['strat-momentum', 'strat-value', 'strat-degrading'],
      degradingStrategyId: 'strat-degrading',
    });

  if (!longRun.allStepsOk) {
    blockers.push(
      `long-run simulation failed: ${longRun.steps.filter((s) => !s.ok).map((s) => s.step).join(', ')}`,
    );
  }
  if (!longRun.evidenceChainIntact) {
    blockers.push('evidence chain not intact after long-run');
  }
  if (longRun.demotedStrategyId === null) {
    blockers.push('degrading strategy was not demoted');
  }

  const chaos = input.chaos ?? runShadowLabChaosHarness();
  if (!chaos.allRecovered) {
    blockers.push(
      `chaos harness failed: ${chaos.scenarios.filter((s) => !s.recovered).map((s) => s.scenario).join(', ')}`,
    );
  }
  if (chaos.anyHistoryRewritten) {
    blockers.push('chaos harness detected history rewrite');
  }

  const realityGate = evaluateShadowLabRealityGate(longRun.evidenceChainIntact, 'SYNTHETIC_HARNESS');
  if (realityGate.forwardAlphaSupportedClaimed) {
    blockers.push('harness must not claim FORWARD_ALPHA_SUPPORTED under SYNTHETIC_HARNESS');
  }

  if (input.subprocessGatesOk === false) {
    blockers.push('ALPHA25 subprocess qualification gates not green');
  }

  const qualified = blockers.length === 0;

  return Object.freeze({
    schema: HELIOS_AUTONOMOUS_SHADOW_LAB_SCHEMA,
    marker: qualified
      ? HELIOS_AUTONOMOUS_SHADOW_LAB_V1_QUALIFIED
      : HELIOS_AUTONOMOUS_SHADOW_LAB_V1_BLOCKED,
    qualified,
    gitSha: input.gitSha,
    evaluatedAt: input.evaluatedAt,
    workPackages,
    longRun,
    chaos,
    realityGate,
    blockers: Object.freeze(blockers),
  });
}
