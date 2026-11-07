import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { LIVE_TRADING_ENABLED } from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';

import { runAllAlt14AdversarialScenarios } from './adversarial-qualification.ts';
import {
  HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_SCHEMA,
  HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_BLOCKED,
  HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_QUALIFIED,
} from './taxonomy.ts';
import { listAltWorkPackages } from './work-package-registry.ts';
import { HELIOS_ALT14_AGENTIC_COMMITTEE } from './alt14-agent-committee.ts';

export {
  HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_SCHEMA,
  HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_BLOCKED,
  HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_QUALIFIED,
} from './taxonomy.ts';
export { listAltWorkPackages, type AltWorkPackageRow } from './work-package-registry.ts';

const DOCS = Object.freeze([
  'docs/helios/alternative-data/HELIOS_ALTERNATIVE_DATA_FINAL_REPORT.md',
  'docs/helios/alternative-data/ALTERNATIVE_DATA_CAPABILITY_MATRIX.md',
  'docs/helios/alternative-data/ALTERNATIVE_DATA_SIGNAL_VALIDATION.md',
  'docs/helios/alternative-data/ALTERNATIVE_DATA_PROVIDER_RISK.md',
  'docs/helios/alternative-data/ALTERNATIVE_DATA_ENTITY_MAPPING_AUDIT.md',
]);

export type AlternativeDataIntelligenceQualificationInput = {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly qualificationTestPresent?: boolean;
  readonly adversarialHarnessPresent?: boolean;
};

export type AlternativeDataIntelligenceQualificationResult = {
  readonly schema: typeof HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_SCHEMA;
  readonly marker:
    | typeof HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_QUALIFIED
    | typeof HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_BLOCKED;
  readonly qualified: boolean;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly workPackages: ReturnType<typeof listAltWorkPackages>;
  readonly adversarialScenariosPassed: number;
  readonly adversarialScenariosTotal: number;
  readonly blockers: readonly string[];
};

export function evaluateAlternativeDataIntelligenceQualification(
  input: AlternativeDataIntelligenceQualificationInput,
): AlternativeDataIntelligenceQualificationResult {
  const workPackages = listAltWorkPackages(input.root);
  const blockers: string[] = [];

  if (!workPackages.every((row) => row.status === 'IMPLEMENTED')) {
    blockers.push(
      ...workPackages
        .filter((row) => row.status === 'BLOCKED')
        .map((row) => `${row.packageId}:${row.moduleRef}`),
    );
  }

  const committeeIndex = join(input.root, 'packages/agentic-capital-mesh/src/alternative-data-research-alt14/index.ts');
  if (!existsSync(committeeIndex)) {
    blockers.push('agentic-capital-mesh alternative-data-research-alt14 module missing');
  }
  if (!existsSync(join(input.root, HELIOS_ALT14_AGENTIC_COMMITTEE))) {
    blockers.push(`ALT14 agentic committee hook missing: ${HELIOS_ALT14_AGENTIC_COMMITTEE}`);
  }

  const testPath = join(input.root, 'tests/helios-alt14-alternative-data-qualification.test.ts');
  if (input.qualificationTestPresent !== false && !existsSync(testPath)) {
    blockers.push('tests/helios-alt14-alternative-data-qualification.test.ts missing');
  }

  const meshTestPath = join(input.root, 'tests/helios-alt14-alternative-data-research-mesh.test.ts');
  if (input.adversarialHarnessPresent !== false && !existsSync(meshTestPath)) {
    blockers.push('tests/helios-alt14-alternative-data-research-mesh.test.ts missing');
  }

  if (LIVE_TRADING_ENABLED) {
    blockers.push('LIVE_TRADING_ENABLED must remain false for alternative-data qualification');
  }

  for (const doc of DOCS) {
    if (!existsSync(join(input.root, doc))) {
      blockers.push(`missing documentation: ${doc}`);
    }
  }

  const adversarial = runAllAlt14AdversarialScenarios();
  const passed = adversarial.filter((row) => row.passed).length;
  if (passed !== adversarial.length) {
    for (const row of adversarial.filter((r) => !r.passed)) {
      blockers.push(`adversarial scenario failed: ${row.scenarioId} — ${row.detail}`);
    }
  }

  const qualified = blockers.length === 0;

  return Object.freeze({
    schema: HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_SCHEMA,
    marker: qualified
      ? HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_QUALIFIED
      : HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_BLOCKED,
    qualified,
    gitSha: input.gitSha,
    evaluatedAt: input.evaluatedAt,
    workPackages,
    adversarialScenariosPassed: passed,
    adversarialScenariosTotal: adversarial.length,
    blockers: Object.freeze(blockers),
  });
}
