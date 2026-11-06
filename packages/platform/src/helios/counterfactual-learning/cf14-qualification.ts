import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { LIVE_TRADING_ENABLED } from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';

import {
  HELIOS_COUNTERFACTUAL_LEARNING_PROGRAM_SCHEMA,
  HELIOS_COUNTERFACTUAL_LEARNING_V1_BLOCKED,
  HELIOS_COUNTERFACTUAL_LEARNING_V1_QUALIFIED,
} from './taxonomy.ts';
import { listCfWorkPackages } from './work-package-registry.ts';

export {
  HELIOS_COUNTERFACTUAL_LEARNING_PROGRAM_SCHEMA,
  HELIOS_COUNTERFACTUAL_LEARNING_V1_BLOCKED,
  HELIOS_COUNTERFACTUAL_LEARNING_V1_QUALIFIED,
} from './taxonomy.ts';
export { listCfWorkPackages, type CfWorkPackageRow } from './work-package-registry.ts';

export type CounterfactualLearningQualificationInput = {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly qualificationTestPresent?: boolean;
};

export type CounterfactualLearningQualificationResult = {
  readonly schema: typeof HELIOS_COUNTERFACTUAL_LEARNING_PROGRAM_SCHEMA;
  readonly marker:
    | typeof HELIOS_COUNTERFACTUAL_LEARNING_V1_QUALIFIED
    | typeof HELIOS_COUNTERFACTUAL_LEARNING_V1_BLOCKED;
  readonly qualified: boolean;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly workPackages: ReturnType<typeof listCfWorkPackages>;
  readonly blockers: readonly string[];
};

const DOCS = Object.freeze([
  'docs/helios/counterfactual/HELIOS_COUNTERFACTUAL_LEARNING_FINAL_REPORT.md',
  'docs/helios/counterfactual/COUNTERFACTUAL_CAPABILITY_MATRIX.md',
  'docs/helios/counterfactual/OFF_POLICY_VALIDATION_REPORT.md',
  'docs/helios/counterfactual/REJECTED_OPPORTUNITY_RESEARCH_REPORT.md',
  'docs/helios/counterfactual/COUNTERFACTUAL_MODEL_RISK_REPORT.md',
]);

export function evaluateCounterfactualLearningQualification(
  input: CounterfactualLearningQualificationInput,
): CounterfactualLearningQualificationResult {
  const workPackages = listCfWorkPackages(input.root);
  const blockers: string[] = [];

  if (!workPackages.every((row) => row.status === 'IMPLEMENTED')) {
    blockers.push(
      ...workPackages.filter((row) => row.status === 'BLOCKED').map((row) => `${row.packageId}:${row.moduleRef}`),
    );
  }

  const testPath = join(input.root, 'tests/helios-cf14-counterfactual-learning-qualification.test.ts');
  if (input.qualificationTestPresent !== false && !existsSync(testPath)) {
    blockers.push('tests/helios-cf14-counterfactual-learning-qualification.test.ts missing');
  }

  if (LIVE_TRADING_ENABLED) {
    blockers.push('LIVE_TRADING_ENABLED must remain false for counterfactual learning qualification');
  }

  for (const doc of DOCS) {
    if (!existsSync(join(input.root, doc))) {
      blockers.push(`missing documentation: ${doc}`);
    }
  }

  const qualified = blockers.length === 0;

  return Object.freeze({
    schema: HELIOS_COUNTERFACTUAL_LEARNING_PROGRAM_SCHEMA,
    marker: qualified
      ? HELIOS_COUNTERFACTUAL_LEARNING_V1_QUALIFIED
      : HELIOS_COUNTERFACTUAL_LEARNING_V1_BLOCKED,
    qualified,
    gitSha: input.gitSha,
    evaluatedAt: input.evaluatedAt,
    workPackages,
    blockers: Object.freeze(blockers),
  });
}
