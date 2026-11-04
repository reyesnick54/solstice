/**
 * EARN12 — final earnings intelligence qualification and anti-overfitting gate.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { LIVE_TRADING_ENABLED } from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';
import type { EvidenceVault } from '@solstice/evidence';
import {
  HELIOS_EARNINGS_INTELLIGENCE_SCHEMA,
  HELIOS_EARNINGS_INTELLIGENCE_V1_BLOCKED,
  HELIOS_EARNINGS_INTELLIGENCE_V1_QUALIFIED,
} from './taxonomy.ts';
import { runEarningsIntelligencePipeline, type EarningsExternalIntegrationGates } from './pipeline.ts';
import {
  buildEarnWorkPackageRegistry,
  earnWorkPackageBlockers,
  earnWorkPackagesQualified,
} from './work-package-registry.ts';
import { architectureImpliesAlpha } from './reality-gate.ts';
import type { EarningsValidationReport } from './types.ts';

export type EarningsIntelligenceQualificationInput = {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly evidenceVault?: EvidenceVault | null;
  readonly qualificationTestPresent?: boolean;
  readonly externalGates?: EarningsExternalIntegrationGates;
};

export type EarningsIntelligenceQualificationResult = {
  readonly schema: typeof HELIOS_EARNINGS_INTELLIGENCE_SCHEMA;
  readonly marker:
    | typeof HELIOS_EARNINGS_INTELLIGENCE_V1_QUALIFIED
    | typeof HELIOS_EARNINGS_INTELLIGENCE_V1_BLOCKED;
  readonly qualified: boolean;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly workPackages: ReturnType<typeof buildEarnWorkPackageRegistry>;
  readonly pipelineOk: boolean;
  readonly validationReport: EarningsValidationReport | null;
  readonly evidenceRef: string | null;
  readonly blockers: readonly string[];
};

export function evaluateEarningsIntelligenceQualification(
  input: EarningsIntelligenceQualificationInput,
): EarningsIntelligenceQualificationResult {
  const workPackages = buildEarnWorkPackageRegistry(input.root);
  const blockers: string[] = [];

  if (!earnWorkPackagesQualified(workPackages)) {
    blockers.push(...earnWorkPackageBlockers(workPackages));
  }

  const testPath = join(input.root, 'tests/helios-earn12-earnings-intelligence-qualification.test.ts');
  if (input.qualificationTestPresent !== false && !existsSync(testPath)) {
    blockers.push('tests/helios-earn12-earnings-intelligence-qualification.test.ts missing');
  }

  if (LIVE_TRADING_ENABLED) {
    blockers.push('LIVE_TRADING_ENABLED must remain false for earnings qualification');
  }

  const pipeline = runEarningsIntelligencePipeline(
    {
      qualifiedAt: input.evaluatedAt,
      gitSha: input.gitSha,
      evidenceVault: input.evidenceVault ?? null,
      root: input.root,
    },
    input.externalGates ?? Object.freeze({
      aafV2Qualified: false,
      strategyLabQualified: false,
      executionTwinQualified: false,
    }),
  );

  if (!pipeline.ok) {
    blockers.push('earnings intelligence pipeline stage failure');
    for (const row of pipeline.stages.filter((stage) => !stage.ok)) {
      blockers.push(`${row.stage}: ${row.detail}`);
    }
  }

  if (pipeline.validationReport && pipeline.validationReport.chronology.embargoViolations > 0) {
    blockers.push('event-time embargo violations detected');
  }
  if (pipeline.validationReport && pipeline.validationReport.chronology.issuerLeakageViolations > 0) {
    blockers.push('issuer-aware leakage violations detected');
  }

  if (pipeline.validationReport && architectureImpliesAlpha(pipeline.validationReport.realityGate)) {
    blockers.push('reality gate must not claim forward/live alpha in simulation qualification');
  }

  if (pipeline.validationReport && !pipeline.validationReport.insignificantAlphaNotPromoted) {
    blockers.push('statistically insignificant return predictability must not be promoted as alpha');
  }

  const docs = [
    'docs/helios/earnings/HELIOS_EARNINGS_INTELLIGENCE_FINAL_REPORT.md',
    'docs/helios/earnings/EARNINGS_CAPABILITY_MATRIX.md',
    'docs/helios/earnings/EARNINGS_MODEL_VALIDATION_REPORT.md',
  ];
  for (const doc of docs) {
    if (!existsSync(join(input.root, doc))) {
      blockers.push(`missing documentation: ${doc}`);
    }
  }

  const qualified = blockers.length === 0;

  return Object.freeze({
    schema: HELIOS_EARNINGS_INTELLIGENCE_SCHEMA,
    marker: qualified
      ? HELIOS_EARNINGS_INTELLIGENCE_V1_QUALIFIED
      : HELIOS_EARNINGS_INTELLIGENCE_V1_BLOCKED,
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
