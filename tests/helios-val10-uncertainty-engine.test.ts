/**
 * HELIOS VAL10 — valuation uncertainty, fragility, and model-risk engine.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_VAL10_SEED,
  evaluateVal10UncertaintyQualification,
  fixtureVal10UncertaintyInput,
  HELIOS_VAL10_UNCERTAINTY_ENGINE_QUALIFIED,
  runVal10UncertaintyEngine,
  severityFromShare,
  VAL10_UNCERTAINTY_ENGINE_SCHEMA,
} from '../packages/platform/src/helios/valuation-intelligence/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS VAL10 uncertainty engine', () => {
  it('passes HELIOS boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd());
    assert.equal(findings.length, 0, findings.map((f) => f.message).join('; '));
  });

  it('runs Monte Carlo attribution with deterministic seed', () => {
    const input = fixtureVal10UncertaintyInput();
    const first = runVal10UncertaintyEngine(input);
    const second = runVal10UncertaintyEngine(input);

    assert.equal(first.schema, VAL10_UNCERTAINTY_ENGINE_SCHEMA);
    assert.equal(first.grantsExecutionAuthority, false);
    assert.equal(first.researchOnly, true);
    assert.equal(first.seed, DEFAULT_VAL10_SEED);
    assert.equal(first.qualificationMarker, HELIOS_VAL10_UNCERTAINTY_ENGINE_QUALIFIED);
    assert.deepEqual(first.uncertainty.enterpriseValueStdDev, second.uncertainty.enterpriseValueStdDev);
    assert.equal(first.uncertainty.varianceContributions.length, 6);
    assert.equal(first.uncertainty.assumptionSensitivities.length, 6);

    const shareSum = first.uncertainty.varianceContributions.reduce(
      (s, c) => s + c.fractionOfExplainedVariance,
      0,
    );
    assert.ok(Math.abs(shareSum - 1) < 1e-6);

    assert.ok(first.fragility.fragility.dimensions.length >= 7);
    assert.ok(first.fragility.fragility.index >= 0);
    assert.ok(first.terminalDependence.terminalValueShareOfEnterpriseValue >= 0);
    assert.ok(first.terminalDependence.terminalValueShareOfEnterpriseValue <= 1);
    assert.ok(first.modelRisk.crossModel !== null);
    assert.ok(first.modelRisk.accountingSpread !== null);
    assert.ok(first.confidence.highConfidenceResearchBlocked);
    assert.notEqual(first.confidence.level, 'INSUFFICIENT_DATA');
  });

  it('classifies terminal value dependence severity', () => {
    assert.equal(severityFromShare(0.3), 'LOW');
    assert.equal(severityFromShare(0.55), 'MODERATE');
    assert.equal(severityFromShare(0.75), 'HIGH');
    assert.equal(severityFromShare(0.92), 'EXTREME');
  });

  it('qualifies HELIOS_VAL10_UNCERTAINTY_ENGINE_QUALIFIED when checks pass', () => {
    const result = runVal10UncertaintyEngine(fixtureVal10UncertaintyInput());
    const qualification = evaluateVal10UncertaintyQualification(result);
    assert.equal(qualification.qualified, true, qualification.blockers.join('; '));
    assert.equal(qualification.marker, HELIOS_VAL10_UNCERTAINTY_ENGINE_QUALIFIED);
  });
});
