/**
 * HELIOS EARN12 — earnings intelligence final qualification and anti-overfitting gate.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  HELIOS_EARNINGS_INTELLIGENCE_V1_QUALIFIED,
  architectureImpliesAlpha,
  assertTrialRegistryAppendOnly,
  buildEarnWorkPackageRegistry,
  createEarningsTrialRegistry,
  evaluateEarningsIntelligenceQualification,
  runEarningsIntelligencePipeline,
  trialIdFromConfig,
} from '../packages/platform/src/helios/earnings-intelligence/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-11-04T07:00:00.000Z');
const ROOT = process.cwd();

const EXTERNAL_GATES = Object.freeze({
  aafV2Qualified: true,
  strategyLabQualified: true,
  executionTwinQualified: true,
});

describe('HELIOS EARN12 — earnings intelligence qualification', () => {
  it('architecture guard: earnings-intelligence stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(ROOT).filter((row) =>
      row.file.includes('helios/earnings-intelligence'),
    );
    assert.equal(findings.length, 0, JSON.stringify(findings));
  });

  it('production safety: simulation only', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('registers every trial including failures and forbids deletion', () => {
    const registry = createEarningsTrialRegistry();
    const before = registry.listTrials().length;
    registry.recordTrial({
      recordedAt: NOW,
      outcome: 'FAILURE',
      featureCombination: Object.freeze(['TRANSCRIPT_ONLY']),
      thresholds: Object.freeze({ entryThresholdBps: 6_000 }),
      genomeRef: null,
      modelRef: 'trial-failure-fixture',
      hyperparameters: Object.freeze({}),
      failureReason: 'Brier above gate',
    });
    registry.recordTrial({
      recordedAt: NOW,
      outcome: 'SUCCESS',
      featureCombination: Object.freeze(['FULL_ENSEMBLE']),
      thresholds: Object.freeze({ entryThresholdBps: 5_500 }),
      genomeRef: 'earn.genome.v1@1.0.0',
      modelRef: 'helios-earn09-estimator',
      hyperparameters: Object.freeze({ committeeAgents: 3 }),
      failureReason: null,
    });
    assert.ok(assertTrialRegistryAppendOnly(before, registry.listTrials().length));
    assert.equal(registry.listTrials().length, before + 2);
    assert.ok(registry.listTrials().some((row) => row.outcome === 'FAILURE'));
    assert.ok(trialIdFromConfig({ model: 'a', features: ['x'] }) !== trialIdFromConfig({ model: 'b', features: ['x'] }));
  });

  it('runs core earnings pipeline and seals evidence', () => {
    const vault = new EvidenceVault(new FrozenClock(NOW));
    const pipeline = runEarningsIntelligencePipeline(
      {
        qualifiedAt: NOW,
        gitSha: 'earn12_test_sha',
        evidenceVault: vault,
        root: ROOT,
      },
      EXTERNAL_GATES,
    );
    assert.equal(pipeline.ok, true, JSON.stringify(pipeline.stages.filter((row) => !row.ok)));
    assert.ok(pipeline.forecast);
    assert.ok(pipeline.validationReport);
    assert.ok(pipeline.evidenceRef);
    assert.equal(pipeline.validationReport!.chronology.embargoViolations, 0);
    assert.equal(pipeline.validationReport!.chronology.issuerLeakageViolations, 0);
    assert.equal(architectureImpliesAlpha(pipeline.validationReport!.realityGate), false);
    assert.equal(pipeline.validationReport!.insignificantAlphaNotPromoted, true);
  });

  it('qualifies EARN01–EARN12 with anti-overfitting gate', () => {
    const workPackages = buildEarnWorkPackageRegistry(ROOT);
    assert.ok(workPackages.every((row) => row.status === 'QUALIFIED'));

    const qualification = evaluateEarningsIntelligenceQualification({
      root: ROOT,
      gitSha: 'earn12_qualify_sha',
      evaluatedAt: NOW,
      evidenceVault: new EvidenceVault(new FrozenClock(NOW)),
      externalGates: EXTERNAL_GATES,
    });
    assert.equal(qualification.marker, HELIOS_EARNINGS_INTELLIGENCE_V1_QUALIFIED, qualification.blockers.join('; '));
    assert.equal(qualification.qualified, true);
    assert.ok(qualification.validationReport);
    assert.ok(qualification.validationReport!.benchmarks.length >= 8);
    assert.ok(qualification.validationReport!.regimeSlices.length > 0);
  });
});
