/**
 * HELIOS Forward Alpha — ALPHA09 risk-adjusted return and tail evidence.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  evaluateForwardAlpha09Qualification,
  fixtureAlpha09ConcentratedInput,
  fixtureAlpha09DiversifiedInput,
  HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_QUALIFIED,
  HELIOS_ALPHA09_SCHEMA,
  runForwardAlpha09RiskAdjustedEvidence,
} from '../packages/platform/src/helios/forward-alpha/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS Forward Alpha ALPHA09', () => {
  it('passes HELIOS boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd());
    assert.equal(findings.length, 0, findings.map((f) => f.message).join('; '));
  });

  it('materializes ForwardPerformanceState, ForwardRiskState, and ForwardTailState', () => {
    const evidence = runForwardAlpha09RiskAdjustedEvidence(fixtureAlpha09DiversifiedInput());
    assert.equal(evidence.schema, HELIOS_ALPHA09_SCHEMA);
    assert.equal(evidence.grantsExecutionAuthority, false);
    assert.equal(evidence.performance.schema, 'sunrey.helios.forward-alpha.forward-performance-state.v1');
    assert.equal(evidence.risk.schema, 'sunrey.helios.forward-alpha.forward-risk-state.v1');
    assert.equal(evidence.tail.schema, 'sunrey.helios.forward-alpha.forward-tail-state.v1');
  });

  it('computes core performance and risk metrics', () => {
    const evidence = runForwardAlpha09RiskAdjustedEvidence(fixtureAlpha09DiversifiedInput());
    assert.ok(evidence.performance.totalReturn.units > 0n);
    assert.notEqual(evidence.performance.annualizedReturn, null);
    assert.notEqual(evidence.risk.volatility, null);
    assert.notEqual(evidence.risk.sharpe, null);
    assert.notEqual(evidence.risk.sortino, null);
    assert.notEqual(evidence.risk.informationRatio, null);
    assert.notEqual(evidence.risk.calmar, null);
    assert.ok(evidence.risk.maximumDrawdown.units >= 0n);
    assert.ok(evidence.risk.drawdownDurationPeriods >= 0);
    assert.notEqual(evidence.tail.expectedShortfall, null);
    assert.notEqual(evidence.tail.skew, null);
    assert.notEqual(evidence.tail.kurtosisExcess, null);
    assert.notEqual(evidence.performance.winRate, null);
    assert.notEqual(evidence.performance.profitFactor, null);
  });

  it('blocks repeatability when performance is single-event dominated', () => {
    const evidence = runForwardAlpha09RiskAdjustedEvidence(fixtureAlpha09ConcentratedInput());
    assert.equal(evidence.concentration.repeatabilityClaimBlocked, true);
    const qualification = evaluateForwardAlpha09Qualification(evidence);
    assert.equal(qualification.qualified, false);
    assert.ok(qualification.blockers.includes('no_single_slice_dominance'));
  });

  it('qualifies diversified evidence with HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_QUALIFIED', () => {
    const evidence = runForwardAlpha09RiskAdjustedEvidence(fixtureAlpha09DiversifiedInput());
    const qualification = evaluateForwardAlpha09Qualification(evidence);
    assert.equal(qualification.qualified, true, qualification.blockers.join('; '));
    assert.equal(qualification.marker, HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_QUALIFIED);
    assert.equal(evidence.qualificationMarker, HELIOS_ALPHA09_RISK_ADJUSTED_EVIDENCE_QUALIFIED);
  });
});
