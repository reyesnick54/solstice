import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { LIVE_TRADING_ENABLED, MARKET_DATA_LIVE_SHADOW_ENABLED } from '@solstice/config';
import type { UtcInstant } from '@solstice/domain';

import { runAllMd14AdversarialScenarios } from './adversarial-qualification.ts';
import { runMd14SyntheticE2ePipeline } from './e2e-pipeline.ts';
import { assertMarketDataLiveShadowSafe } from './live-shadow.ts';
import { fixtureSandboxProviderEvidence, decideProviderMarketDataStatus } from './provider-qualification.ts';
import {
  HELIOS_MARKET_DATA_FABRIC_SCHEMA,
  HELIOS_PRODUCTION_MARKET_DATA_V1_BLOCKED,
  HELIOS_PRODUCTION_MARKET_DATA_V1_QUALIFIED,
} from './taxonomy.ts';
import { listMdWorkPackages } from './work-package-registry.ts';

export type MarketDataFabricQualificationInput = {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly qualificationTestPresent?: boolean;
  readonly subprocessGatesOk?: boolean;
};

export type MarketDataFabricQualificationResult = {
  readonly schema: typeof HELIOS_MARKET_DATA_FABRIC_SCHEMA;
  readonly marker:
    | typeof HELIOS_PRODUCTION_MARKET_DATA_V1_QUALIFIED
    | typeof HELIOS_PRODUCTION_MARKET_DATA_V1_BLOCKED;
  readonly qualified: boolean;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
  readonly workPackages: ReturnType<typeof listMdWorkPackages>;
  readonly e2ePipelineOk: boolean;
  readonly adversarialScenariosPassed: number;
  readonly adversarialScenariosTotal: number;
  readonly blockers: readonly string[];
};

const DOCS = Object.freeze([
  'docs/helios/market-data/HELIOS_MARKET_DATA_FINAL_REPORT.md',
  'docs/helios/market-data/MARKET_DATA_CAPABILITY_MATRIX.md',
  'docs/helios/market-data/MARKET_DATA_PROVIDER_QUALIFICATION.md',
  'docs/helios/market-data/MARKET_DATA_RESILIENCE_REPORT.md',
  'docs/helios/market-data/MARKET_DATA_TIME_INTEGRITY_REPORT.md',
]);

export function evaluateMarketDataFabricQualification(
  input: MarketDataFabricQualificationInput,
): MarketDataFabricQualificationResult {
  const workPackages = listMdWorkPackages(input.root);
  const blockers: string[] = [];

  if (!workPackages.every((row) => row.status === 'IMPLEMENTED')) {
    blockers.push(
      ...workPackages.filter((row) => row.status === 'BLOCKED').map((row) => `${row.packageId}:${row.moduleRef}`),
    );
  }

  const testPath = join(input.root, 'tests/helios-md14-market-data-qualification.test.ts');
  if (input.qualificationTestPresent !== false && !existsSync(testPath)) {
    blockers.push('tests/helios-md14-market-data-qualification.test.ts missing');
  }

  const modulePath = join(input.root, 'packages/platform/src/helios/market-data/live-shadow.ts');
  if (!existsSync(modulePath)) {
    blockers.push('MARKET_DATA_LIVE_SHADOW policy module missing');
  }

  if (LIVE_TRADING_ENABLED !== false) {
    blockers.push('LIVE_TRADING_ENABLED must remain false for market-data qualification');
  }

  if (MARKET_DATA_LIVE_SHADOW_ENABLED !== true && MARKET_DATA_LIVE_SHADOW_ENABLED !== false) {
    blockers.push('MARKET_DATA_LIVE_SHADOW_ENABLED must be a compile-time boolean');
  }

  try {
    assertMarketDataLiveShadowSafe();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    blockers.push(message);
  }

  const fixtureDecision = decideProviderMarketDataStatus(fixtureSandboxProviderEvidence('aaf07_fixture_catalog'));
  if (fixtureDecision.status !== 'SANDBOX_QUALIFIED') {
    blockers.push('fixture provider must reach SANDBOX_QUALIFIED without claiming live connectivity');
  }
  if (fixtureDecision.liveShadowEligible) {
    blockers.push('fixture provider must not be live-shadow eligible without verified external connectivity');
  }

  for (const doc of DOCS) {
    if (!existsSync(join(input.root, doc))) {
      blockers.push(`missing documentation: ${doc}`);
    }
  }

  const e2e = runMd14SyntheticE2ePipeline({
    nowUtc: input.evaluatedAt,
    eventTime: '2026-06-01T14:30:00.000Z',
    knowableAt: '2026-06-01T14:30:00.500Z',
    providerLineageRef: 'prov:fixture:e2e',
    sequence: 42,
    priorSequence: 41,
  });
  if (!e2e.ok) {
    blockers.push('synthetic E2E pipeline failed');
    for (const row of e2e.stages.filter((stage) => !stage.ok)) {
      blockers.push(`e2e:${row.stage}:${row.detail}`);
    }
  }

  const adversarial = runAllMd14AdversarialScenarios();
  const passed = adversarial.filter((row) => row.passed).length;
  if (passed !== adversarial.length) {
    for (const row of adversarial.filter((r) => !r.passed)) {
      blockers.push(`adversarial scenario failed: ${row.scenarioId} — ${row.detail}`);
    }
  }

  if (input.subprocessGatesOk === false) {
    blockers.push('MD14 subprocess qualification gates not green');
  }

  const qualified = blockers.length === 0;

  return Object.freeze({
    schema: HELIOS_MARKET_DATA_FABRIC_SCHEMA,
    marker: qualified ? HELIOS_PRODUCTION_MARKET_DATA_V1_QUALIFIED : HELIOS_PRODUCTION_MARKET_DATA_V1_BLOCKED,
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
