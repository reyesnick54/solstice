import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { LIVE_TRADING_ENABLED } from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';
import type { EvidenceVault } from '@solstice/evidence';

import {
  HELIOS_VALUATION_INTELLIGENCE_SCHEMA,
  HELIOS_VALUATION_INTELLIGENCE_V1_BLOCKED,
  HELIOS_VALUATION_INTELLIGENCE_V1_QUALIFIED,
} from '../taxonomy.ts';
import { listValWorkPackages } from '../work-package-registry.ts';
import { valuationArchitectureImpliesAlpha } from './reality-gate.ts';
import { runValuationIntelligencePipeline, type ValuationExternalIntegrationGates } from './pipeline.ts';

export type ValuationIntelligenceQualificationInput = {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly evidenceVault?: EvidenceVault | null;
  readonly qualificationTestPresent?: boolean;
  readonly externalGates?: ValuationExternalIntegrationGates;
};

export type ValuationIntelligenceQualificationResult = {
  readonly schema: typeof HELIOS_VALUATION_INTELLIGENCE_SCHEMA;
  readonly marker:
    | typeof HELIOS_VALUATION_INTELLIGENCE_V1_QUALIFIED
    | typeof HELIOS_VALUATION_INTELLIGENCE_V1_BLOCKED;
  readonly qualified: boolean;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly workPackages: ReturnType<typeof listValWorkPackages>;
  readonly pipelineOk: boolean;
  readonly validationReport: ReturnType<typeof runValuationIntelligencePipeline>['validationReport'];
  readonly evidenceRef: string | null;
  readonly blockers: readonly string[];
};

export function evaluateValuationIntelligenceQualification(
  input: ValuationIntelligenceQualificationInput,
): ValuationIntelligenceQualificationResult {
  const workPackages = listValWorkPackages(input.root);
  const blockers: string[] = [];

  if (!workPackages.every((row) => row.status === 'IMPLEMENTED')) {
    blockers.push(
      ...workPackages.filter((row) => row.status === 'BLOCKED').map((row) => `${row.packageId}:${row.moduleRef}`),
    );
  }

  const testPath = join(input.root, 'tests/helios-val12-valuation-intelligence-qualification.test.ts');
  if (input.qualificationTestPresent !== false && !existsSync(testPath)) {
    blockers.push('tests/helios-val12-valuation-intelligence-qualification.test.ts missing');
  }

  if (LIVE_TRADING_ENABLED) {
    blockers.push('LIVE_TRADING_ENABLED must remain false for valuation qualification');
  }

  const pipeline = runValuationIntelligencePipeline(
    {
      qualifiedAt: input.evaluatedAt,
      gitSha: input.gitSha,
      evidenceVault: input.evidenceVault ?? null,
      root: input.root,
    },
    input.externalGates ?? Object.freeze({
      aafV2Qualified: false,
      earningsQualified: false,
      healthBaselineQualified: false,
    }),
  );

  if (!pipeline.ok) {
    blockers.push('valuation intelligence pipeline stage failure');
    for (const row of pipeline.stages.filter((stage) => !stage.ok)) {
      blockers.push(`${row.stage}: ${row.detail}`);
    }
  }

  if (pipeline.validationReport && pipeline.validationReport.knowableAtViolations > 0) {
    blockers.push('historical knowable-at leakage detected');
  }

  if (
    pipeline.validationReport &&
    valuationArchitectureImpliesAlpha(pipeline.validationReport.valuationQualityGate)
  ) {
    blockers.push('reality gate must not claim investment alpha from valuation architecture alone');
  }

  if (pipeline.state && pipeline.state.autoPromoteStrategyCandidates) {
    blockers.push('valuation must not auto-promote strategy candidates');
  }

  const docs = [
    'docs/helios/valuation/HELIOS_VALUATION_INTELLIGENCE_FINAL_REPORT.md',
    'docs/helios/valuation/VALUATION_CAPABILITY_MATRIX.md',
    'docs/helios/valuation/VALUATION_MODEL_VALIDATION_REPORT.md',
    'docs/helios/valuation/VALUATION_MODEL_RISK_REPORT.md',
  ];
  for (const doc of docs) {
    if (!existsSync(join(input.root, doc))) {
      blockers.push(`missing documentation: ${doc}`);
    }
  }

  const qualified = blockers.length === 0;

  return Object.freeze({
    schema: HELIOS_VALUATION_INTELLIGENCE_SCHEMA,
    marker: qualified
      ? HELIOS_VALUATION_INTELLIGENCE_V1_QUALIFIED
      : HELIOS_VALUATION_INTELLIGENCE_V1_BLOCKED,
    qualified,
    gitSha: input.gitSha,
    evaluatedAt: input.evaluatedAt,
    workPackages,
    pipelineOk: pipeline.ok,
    validationReport: pipeline.validationReport,
    evidenceRef: pipeline.evidenceRef,
    blockers: Object.freeze(blockers),
  });
}
