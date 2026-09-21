/**
 * HELIOS Multi-Asset Expansion M28 — release candidate qualification tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_MULTI_ASSET_PAPER_RC_QUALIFIED,
  HELIOS_MULTI_ASSET_RELEASE_SEQUENCE,
  M28_FORWARD_PAPER_SCENARIO_IDS,
  M28_TARGET_MARKETS,
  buildM28EconomicSummary,
  buildM28MilestoneRegistry,
  buildM28ReleaseManifest,
  evaluateM28ReleaseGates,
  evaluateM28ReleaseQualification,
  measureM28Performance,
  runM28ForwardPaperScenarios,
} from '../packages/platform/src/helios/multi-asset/release-candidate/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-21T14:30:00.000Z');

describe('HELIOS Multi-Asset M28 release candidate qualification', () => {
  it('passes HELIOS boundary guard for release-candidate module', () => {
    const findings = lintHeliosBoundary(process.cwd()).filter((row) =>
      row.file.includes('release-candidate'),
    );
    assert.equal(findings.length, 0, findings.map((f) => f.message).join('; '));
  });

  it('defines M01-M28 sequence and six target markets', () => {
    assert.equal(HELIOS_MULTI_ASSET_RELEASE_SEQUENCE, 'M01-M28');
    assert.equal(M28_TARGET_MARKETS.length, 6);
    assert.ok(M28_TARGET_MARKETS.includes('SPY'));
    assert.ok(M28_TARGET_MARKETS.includes('WTI/Oil'));
  });

  it('runs 40 forward-paper scenarios', async () => {
    const result = await runM28ForwardPaperScenarios(NOW);
    assert.equal(result.scenarios.length, 40);
    assert.equal(result.scenarios.length, M28_FORWARD_PAPER_SCENARIO_IDS.length);
    assert.equal(result.qualified, true, result.scenarios.filter((s) => s.outcome === 'FAIL').map((s) => s.scenarioId).join(', '));
    assert.equal(result.failedCount, 0);
  });

  it('measures sandbox performance without institutional claims', () => {
    const perf = measureM28Performance(NOW);
    assert.ok(perf.observationIngestionThroughputPerSec > 0);
    assert.ok(perf.opportunityEvaluationLatencyMs >= 0);
    assert.ok(perf.notes.some((n) => n.includes('not production capacity')));
  });

  it('builds economic summary with small-sample disclaimer', () => {
    const economic = buildM28EconomicSummary();
    assert.equal(economic.statisticallyMeaningful, false);
    assert.ok(economic.disclaimer.includes('Does not predict'));
    assert.equal(economic.sharpeRatio, null);
  });

  it('evaluates release gates with live financial authorization OFF', async () => {
    const forwardPaper = await runM28ForwardPaperScenarios(NOW);
    const gates = evaluateM28ReleaseGates({
      architecturePass: true,
      typecheckPass: true,
      testSuitePass: true,
      databaseMigrationsPass: true,
      persistencePass: true,
      restartSafetyPass: true,
      customerIsolationPass: true,
      securityPass: true,
      portfolioRiskPass: true,
      reconciliationPass: true,
      growContractPass: true,
      resiliencePass: true,
      forwardPaper,
      nowUtc: NOW,
    });

    const liveGate = gates.gates.find((g) => g.gateId === 'LIVE_FINANCIAL_AUTHORIZATION');
    assert.equal(liveGate?.status, 'OFF');
    assert.equal(
      gates.gates.find((g) => g.gateId === 'EXTERNAL_PROVIDER_GATES')?.status,
      'CLOSED',
    );
  });

  it('emits HELIOS_MULTI_ASSET_PAPER_RC_QUALIFIED when mandatory gates pass', async () => {
    const forwardPaper = await runM28ForwardPaperScenarios(NOW);
    const testResults = Object.fromEntries(
      [
        'tests/helios-m04-multi-asset-market-state.test.ts',
        'tests/helios-multi-asset-m20-portfolio-risk-controls.test.ts',
        'tests/helios-h27-grow-operational-controls.test.ts',
      ].map((f) => [f, true]),
    );

    const milestoneRegistry = buildM28MilestoneRegistry({ testResults });
    const gateEvaluation = evaluateM28ReleaseGates({
      architecturePass: true,
      typecheckPass: true,
      testSuitePass: true,
      databaseMigrationsPass: true,
      persistencePass: true,
      restartSafetyPass: true,
      customerIsolationPass: true,
      securityPass: true,
      portfolioRiskPass: true,
      reconciliationPass: true,
      growContractPass: true,
      resiliencePass: true,
      forwardPaper,
      nowUtc: NOW,
    });

    const manifest = buildM28ReleaseManifest({
      repoRoot: process.cwd(),
      gitSha: 'a'.repeat(40),
      buildTimestampUtc: NOW,
      milestoneRegistry,
      gateEvaluation,
      forwardPaper,
      performance: measureM28Performance(NOW),
      economic: buildM28EconomicSummary(),
      testResults,
      marker: HELIOS_MULTI_ASSET_PAPER_RC_QUALIFIED,
      qualified: true,
      blockers: [],
    });

    const qualification = evaluateM28ReleaseQualification(manifest);
    assert.equal(qualification.qualified, true, qualification.blockers.join('; '));
    assert.equal(qualification.marker, HELIOS_MULTI_ASSET_PAPER_RC_QUALIFIED);
    assert.equal(qualification.manifest.liveFinancialFlag, false);
  });
});
