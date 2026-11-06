/**
 * HELIOS VAL12 — valuation intelligence final qualification and strategy bridge.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  HELIOS_VALUATION_INTELLIGENCE_V1_QUALIFIED,
  buildHeliosValuationState,
  evaluateValuationIntelligenceQualification,
  listValWorkPackages,
  runValuationIntelligencePipeline,
  valuationArchitectureImpliesAlpha,
} from '../packages/platform/src/helios/valuation-intelligence/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-11-06T08:00:00.000Z');
const ROOT = process.cwd();

const EXTERNAL_GATES = Object.freeze({
  aafV2Qualified: true,
  earningsQualified: true,
  healthBaselineQualified: true,
});

describe('HELIOS VAL12 — valuation intelligence qualification', () => {
  it('architecture guard: valuation-intelligence stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(ROOT).filter((row) =>
      row.file.includes('helios/valuation-intelligence'),
    );
    assert.equal(findings.length, 0, JSON.stringify(findings));
  });

  it('production safety: simulation only', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('builds HeliosValuationState with gap and model-implied margin of safety', () => {
    const state = buildHeliosValuationState({});
    assert.ok(state.independentIntrinsicValueDistribution.p50Minor > 0n);
    assert.ok(state.valuationGap);
    assert.ok(state.modelImpliedMarginOfSafety);
    assert.equal(state.autoPromoteStrategyCandidates, false);
    assert.equal(state.valuationQualityNotInvestmentAlpha, true);
    assert.ok(state.extendedModelEvidence.val07ResidualIncomeRef.length > 0);
  });

  it('runs valuation pipeline and seals evidence', () => {
    const vault = new EvidenceVault(new FrozenClock(NOW));
    const pipeline = runValuationIntelligencePipeline(
      {
        qualifiedAt: NOW,
        gitSha: 'val12_test_sha',
        evidenceVault: vault,
        root: ROOT,
      },
      EXTERNAL_GATES,
    );
    assert.equal(pipeline.ok, true, JSON.stringify(pipeline.stages.filter((row) => !row.ok)));
    assert.ok(pipeline.state);
    assert.ok(pipeline.validationReport);
    assert.ok(pipeline.evidenceRef);
    assert.equal(pipeline.validationReport!.investmentAlphaClaimed, false);
    assert.equal(valuationArchitectureImpliesAlpha(pipeline.validationReport!.valuationQualityGate), false);
    assert.ok(pipeline.strategyGenomeFeatures.length >= 8);
  });

  it('qualifies VAL01–VAL12 with valuation quality gate', () => {
    const workPackages = listValWorkPackages(ROOT);
    assert.ok(workPackages.every((row) => row.status === 'IMPLEMENTED'));

    const qualification = evaluateValuationIntelligenceQualification({
      root: ROOT,
      gitSha: 'val12_qualify_sha',
      evaluatedAt: NOW,
      evidenceVault: new EvidenceVault(new FrozenClock(NOW)),
      externalGates: EXTERNAL_GATES,
    });
    assert.equal(
      qualification.marker,
      HELIOS_VALUATION_INTELLIGENCE_V1_QUALIFIED,
      qualification.blockers.join('; '),
    );
    assert.equal(qualification.qualified, true);
    assert.ok(qualification.validationReport);
    assert.ok(qualification.validationReport!.benchmarks.length >= 6);
  });
});
