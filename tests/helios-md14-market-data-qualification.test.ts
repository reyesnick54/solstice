/**
 * HELIOS MD14 — production-shaped market-data fabric qualification.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  ENVIRONMENT,
  LIVE_TRADING_ENABLED,
  MARKET_DATA_LIVE_SHADOW_ENABLED,
} from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  AAF_FEATURE_CERTIFICATION_BLOCK_STATES,
  HELIOS_PRODUCTION_MARKET_DATA_V1_QUALIFIED,
  MD14_ADVERSARIAL_SCENARIO_IDS,
  MD14_E2E_PIPELINE_STAGES,
  MD_WORK_PACKAGES,
  evaluateMarketDataFabricQualification,
  listMdWorkPackages,
  mayAafCertifyMarketDataFeature,
  runAllMd14AdversarialScenarios,
  runMd14SyntheticE2ePipeline,
  decideProviderMarketDataStatus,
  fixtureSandboxProviderEvidence,
  describeMarketDataLiveShadowPosture,
} from '../packages/platform/src/helios/market-data/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-11-07T12:00:00.000Z');
const ROOT = process.cwd();

describe('HELIOS MD14 — market-data fabric qualification', () => {
  it('architecture guard: market-data package stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(ROOT).filter((row) => row.file.includes('helios/market-data'));
    assert.equal(findings.length, 0, JSON.stringify(findings));
  });

  it('production safety: simulation only; live shadow off; no live trading', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
    assert.equal(MARKET_DATA_LIVE_SHADOW_ENABLED, false);
    const mapPath = join(ROOT, 'docs/productization/sunrey-authority-map.json');
    const freezePath = join(ROOT, 'docs/productization/sunrey-architecture-freeze.json');
    assert.ok(existsSync(mapPath));
    assert.ok(existsSync(freezePath));
    const map = JSON.parse(readFileSync(mapPath, 'utf8')) as {
      productionPosture?: { production_authorized?: boolean };
    };
    const freeze = JSON.parse(readFileSync(freezePath, 'utf8')) as {
      productionPosture?: { production_authorized?: boolean };
    };
    assert.equal(map.productionPosture?.production_authorized, false);
    assert.equal(freeze.productionPosture?.production_authorized, false);
  });

  it('lists MD01–MD14 as IMPLEMENTED', () => {
    const workPackages = listMdWorkPackages(ROOT);
    assert.equal(workPackages.length, MD_WORK_PACKAGES.length);
    assert.ok(workPackages.every((row) => row.status === 'IMPLEMENTED'), workPackages.filter((r) => r.status !== 'IMPLEMENTED').map((r) => r.packageId).join(', '));
  });

  it('required market-data docs exist', () => {
    const docs = [
      'docs/helios/market-data/HELIOS_MARKET_DATA_FINAL_REPORT.md',
      'docs/helios/market-data/MARKET_DATA_CAPABILITY_MATRIX.md',
      'docs/helios/market-data/MARKET_DATA_PROVIDER_QUALIFICATION.md',
      'docs/helios/market-data/MARKET_DATA_RESILIENCE_REPORT.md',
      'docs/helios/market-data/MARKET_DATA_TIME_INTEGRITY_REPORT.md',
    ];
    for (const doc of docs) {
      assert.ok(existsSync(join(ROOT, doc)), doc);
    }
  });

  it('blocks AAF certification for DESYNCHRONIZED, UNTRUSTED, ENTITLEMENT_BLOCKED', () => {
    assert.equal(AAF_FEATURE_CERTIFICATION_BLOCK_STATES.length, 3);
    for (const syncState of AAF_FEATURE_CERTIFICATION_BLOCK_STATES) {
      const env = Object.freeze({
        eventTime: '2026-01-02T15:00:00.000Z' as const,
        knowableAt: '2026-01-02T15:00:01.000Z' as const,
        providerLineageRef: 'prov:fixture',
        sequenceIntegrity:
          syncState === 'DESYNCHRONIZED' ? ('DESYNCHRONIZED' as const) : ('INTACT' as const),
        qualityState: syncState === 'UNTRUSTED' ? 'UNTRUSTED' : 'VALID',
        entitlementState: syncState === 'ENTITLEMENT_BLOCKED' ? 'ENTITLEMENT_BLOCKED' : 'USABLE',
        syncState,
      });
      assert.equal(mayAafCertifyMarketDataFeature(env), false, syncState);
    }
  });

  it('runs twelve-stage synthetic E2E pipeline', () => {
    const result = runMd14SyntheticE2ePipeline({
      nowUtc: NOW,
      eventTime: '2026-06-01T14:30:00.000Z',
      knowableAt: '2026-06-01T14:30:00.500Z',
      providerLineageRef: 'prov:fixture:e2e',
      sequence: 10,
      priorSequence: 9,
    });
    assert.equal(result.stages.length, MD14_E2E_PIPELINE_STAGES.length);
    assert.equal(result.ok, true);
    assert.equal(result.grantsExecutionAuthority, false);
    assert.ok(result.featureEnvelope);
  });

  it('does not claim providers live-qualified without external connectivity evidence', () => {
    const sandbox = decideProviderMarketDataStatus(fixtureSandboxProviderEvidence('finnhub_fixture'));
    assert.equal(sandbox.status, 'SANDBOX_QUALIFIED');
    assert.equal(sandbox.liveShadowEligible, false);
    assert.notEqual(sandbox.status, 'READONLY_LIVE_QUALIFIED');
    assert.notEqual(sandbox.status, 'PRODUCTION_RESEARCH_QUALIFIED');
  });

  it('live-shadow posture forbids execution surfaces', () => {
    const posture = describeMarketDataLiveShadowPosture();
    assert.equal(posture.liveTradingEnabled, false);
    assert.equal(posture.permitsBrokerOrders, false);
    assert.equal(posture.permitsVenueOrders, false);
    assert.equal(posture.permitsCustodyMovement, false);
    assert.equal(posture.permitsCustomerCapitalDeployment, false);
  });

  it('passes all MD14 adversarial scenarios', () => {
    const rows = runAllMd14AdversarialScenarios();
    assert.equal(rows.length, MD14_ADVERSARIAL_SCENARIO_IDS.length);
    assert.ok(rows.every((row) => row.passed), rows.filter((r) => !r.passed).map((r) => r.scenarioId).join(', '));
  });

  it('qualifies MD14 with marker HELIOS_PRODUCTION_MARKET_DATA_V1_QUALIFIED', () => {
    const result = evaluateMarketDataFabricQualification({
      root: ROOT,
      gitSha: 'test-sha',
      evaluatedAt: NOW,
    });
    assert.equal(result.marker, HELIOS_PRODUCTION_MARKET_DATA_V1_QUALIFIED, result.blockers.join('; '));
    assert.equal(result.qualified, true);
    assert.equal(result.e2ePipelineOk, true);
    assert.equal(result.adversarialScenariosPassed, result.adversarialScenariosTotal);
  });
});
