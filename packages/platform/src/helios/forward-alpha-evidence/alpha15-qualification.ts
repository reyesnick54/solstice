/**
 * ALPHA15 — final forward-alpha evidence qualification (architecture vs reality).
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { UtcInstant } from '@solstice/domain';

import {
  HELIOS_FORWARD_ALPHA_EVIDENCE_SCHEMA,
  HELIOS_FORWARD_ALPHA_EVIDENCE_V1_BLOCKED,
  HELIOS_FORWARD_ALPHA_EVIDENCE_V1_QUALIFIED,
} from './taxonomy.ts';
import {
  architectureMarkerImpliesAlphaProven,
  defaultSimulationRealityGateInput,
  resolveAlphaRealityGate,
} from './reality-gate.ts';
import { assertForwardAlphaProductionPosture } from './production-posture.ts';
import {
  alphaWorkPackageBlockers,
  alphaWorkPackagesQualified,
  buildAlphaWorkPackageRegistry,
} from './work-package-registry.ts';
import { runCanonicalAlphaStackQualification } from './canonical-stack-qualification.ts';
import type { CanonicalAlphaQualificationRow } from './canonical-stack-qualification.ts';
import type { ForwardAlphaRealityGateResult } from './types.ts';

export {
  HELIOS_FORWARD_ALPHA_EVIDENCE_SCHEMA,
  HELIOS_FORWARD_ALPHA_EVIDENCE_V1_BLOCKED,
  HELIOS_FORWARD_ALPHA_EVIDENCE_V1_QUALIFIED,
} from './taxonomy.ts';

export type ForwardAlphaEvidenceQualificationInput = {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly qualificationTestPresent?: boolean;
  readonly subprocessGatesOk?: boolean;
  readonly realityGateInput?: ReturnType<typeof defaultSimulationRealityGateInput>;
};

export type ForwardAlphaEvidenceQualificationResult = {
  readonly schema: typeof HELIOS_FORWARD_ALPHA_EVIDENCE_SCHEMA;
  readonly marker:
    | typeof HELIOS_FORWARD_ALPHA_EVIDENCE_V1_QUALIFIED
    | typeof HELIOS_FORWARD_ALPHA_EVIDENCE_V1_BLOCKED;
  readonly qualified: boolean;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly workPackages: ReturnType<typeof buildAlphaWorkPackageRegistry>;
  readonly canonicalQualifications: readonly CanonicalAlphaQualificationRow[];
  readonly realityGate: ForwardAlphaRealityGateResult;
  readonly blockers: readonly string[];
};

const DOCS = Object.freeze([
  'docs/helios/alpha/HELIOS_FORWARD_ALPHA_FINAL_REPORT.md',
  'docs/helios/alpha/FORWARD_ALPHA_CAPABILITY_MATRIX.md',
  'docs/helios/alpha/FORWARD_ALPHA_STATISTICAL_VALIDATION.md',
  'docs/helios/alpha/FORWARD_ALPHA_EXECUTION_REPORT.md',
  'docs/helios/alpha/FORWARD_ALPHA_REGIME_REPORT.md',
  'docs/helios/alpha/FORWARD_ALPHA_CAPACITY_REPORT.md',
  'docs/helios/alpha/FORWARD_ALPHA_REALITY_GATE.md',
]);

export function evaluateForwardAlphaEvidenceQualification(
  input: ForwardAlphaEvidenceQualificationInput,
): ForwardAlphaEvidenceQualificationResult {
  const workPackages = buildAlphaWorkPackageRegistry(input.root);
  const blockers: string[] = [];

  if (!alphaWorkPackagesQualified(workPackages)) {
    blockers.push(...alphaWorkPackageBlockers(workPackages));
  }

  const canonicalQualifications = runCanonicalAlphaStackQualification({
    root: input.root,
    gitSha: input.gitSha,
    evaluatedAt: input.evaluatedAt,
  });
  for (const row of canonicalQualifications) {
    if (!row.qualified) {
      blockers.push(`${row.packageId}:${row.marker}:${row.blockers.join(',')}`);
    }
  }

  const testPath = join(input.root, 'tests/helios-alpha15-forward-alpha-qualification.test.ts');
  if (input.qualificationTestPresent !== false && !existsSync(testPath)) {
    blockers.push('tests/helios-alpha15-forward-alpha-qualification.test.ts missing');
  }

  try {
    assertForwardAlphaProductionPosture(input.root);
  } catch (error: unknown) {
    blockers.push(error instanceof Error ? error.message : String(error));
  }

  for (const doc of DOCS) {
    if (!existsSync(join(input.root, doc))) {
      blockers.push(`missing documentation: ${doc}`);
    }
  }

  const realityGate = resolveAlphaRealityGate(
    input.realityGateInput ?? defaultSimulationRealityGateInput(),
  );

  if (architectureMarkerImpliesAlphaProven(realityGate.status)) {
    blockers.push('reality gate must not claim investment-performance proof in simulation qualification');
  }

  if (input.subprocessGatesOk === false) {
    blockers.push('ALPHA15 subprocess qualification gates not green');
  }

  const qualified = blockers.length === 0;

  return Object.freeze({
    schema: HELIOS_FORWARD_ALPHA_EVIDENCE_SCHEMA,
    marker: qualified
      ? HELIOS_FORWARD_ALPHA_EVIDENCE_V1_QUALIFIED
      : HELIOS_FORWARD_ALPHA_EVIDENCE_V1_BLOCKED,
    qualified,
    gitSha: input.gitSha,
    evaluatedAt: input.evaluatedAt,
    workPackages,
    canonicalQualifications,
    realityGate,
    blockers: Object.freeze(blockers),
  });
}
