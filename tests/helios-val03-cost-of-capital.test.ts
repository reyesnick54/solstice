/**
 * HELIOS Valuation Intelligence VAL03 — Dynamic Cost of Capital Engine tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  BETA_ESTIMATOR_KINDS,
  HELIOS_VAL03_COST_OF_CAPITAL_QUALIFIED,
  assertCurrencyConsistency,
  blendBetaEstimates,
  buildBetaEstimates,
  buildCostOfCapitalSnapshot,
  evaluateVal03CostOfCapitalQualification,
  fixtureVal03CostOfCapitalInput,
  fixtureUsTreasuryYieldCurve,
  interpolateYieldBps,
  resolveCapitalStructure,
} from '../packages/platform/src/helios/valuation-intelligence/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS VAL03 — Dynamic Cost of Capital Engine', () => {
  it('interpolates risk-free rates from the government yield curve', () => {
    const curve = fixtureUsTreasuryYieldCurve();
    const y3 = interpolateYieldBps(curve, 3);
    assert.ok(y3 >= 410 && y3 <= 430);
    const y7 = interpolateYieldBps(curve, 7);
    assert.ok(y7 >= 410 && y7 <= 420);
  });

  it('builds five beta estimators and blends away from raw-only trust', () => {
    const input = fixtureVal03CostOfCapitalInput();
    const estimates = buildBetaEstimates(input);
    assert.equal(estimates.length, BETA_ESTIMATOR_KINDS.length);
    const kinds = new Set(estimates.map((e) => e.kind));
    for (const kind of BETA_ESTIMATOR_KINDS) {
      assert.ok(kinds.has(kind));
    }
    const blend = blendBetaEstimates(estimates);
    assert.notEqual(blend.blendedBetaBps, input.rawBetaBps);
    assert.ok(blend.disagreementBps > 0);
  });

  it('uses market-value capital structure when observable', () => {
    const input = fixtureVal03CostOfCapitalInput();
    const weights = resolveCapitalStructure(input);
    assert.equal(weights.basis, 'MARKET_VALUE');
    assert.equal(weights.equityWeightBps + weights.debtWeightBps, 10_000);
    assert.equal(weights.equityWeightBps, 8500);
  });

  it('constructs full cost-of-capital snapshot with uncertainty ranges', () => {
    const snapshot = buildCostOfCapitalSnapshot(fixtureVal03CostOfCapitalInput());
    assert.equal(snapshot.riskFree.simulationOnly, true);
    assert.ok(snapshot.riskFree.rate.lowBps <= snapshot.riskFree.rate.midBps);
    assert.ok(snapshot.riskFree.rate.midBps <= snapshot.riskFree.rate.highBps);
    assert.ok(snapshot.costOfEquity.capm.lowBps <= snapshot.costOfEquity.capm.highBps);
    assert.ok(snapshot.wacc.wacc.lowBps <= snapshot.wacc.wacc.highBps);
    assert.equal(snapshot.wacc.capitalStructureBasis, 'MARKET_VALUE');
    assert.equal(snapshot.costOfEquity.betaEstimates.length, 5);
  });

  it('provides year-specific term structure discount factors', () => {
    const snapshot = buildCostOfCapitalSnapshot(
      fixtureVal03CostOfCapitalInput({ projectionYears: 5 }),
    );
    assert.equal(snapshot.termStructure.years.length, 5);
    const y1 = snapshot.termStructure.years[0]!;
    const y5 = snapshot.termStructure.years[4]!;
    assert.ok(y1.cumulativeDiscountFactorMicro > y5.cumulativeDiscountFactorMicro);
    assert.notEqual(y1.waccBps, y5.waccBps);
  });

  it('rejects currency mismatch between cash flows and discount curve', () => {
    const input = fixtureVal03CostOfCapitalInput({
      cashFlowCurrency: 'EUR',
      discountCurrency: 'USD',
    });
    const check = assertCurrencyConsistency(input);
    assert.equal(check.ok, false);
    assert.throws(() => buildCostOfCapitalSnapshot(input), /must match discount currency/);
  });

  it('qualifies VAL03 when acceptance checks pass', () => {
    const snapshot = buildCostOfCapitalSnapshot(fixtureVal03CostOfCapitalInput());
    const blend = blendBetaEstimates(snapshot.costOfEquity.betaEstimates);
    const qualification = evaluateVal03CostOfCapitalQualification({
      dynamicRatesFromYieldCurve: snapshot.riskFree.curveInterpolation === 'LINEAR_TENOR',
      multiBetaEstimatorsPresent: snapshot.costOfEquity.betaEstimates.length >= 5,
      betaBlendNotRawOnly: blend.blendedBetaBps !== snapshot.costOfEquity.betaEstimates[0]!.betaBps,
      marketValueCapitalStructure: snapshot.wacc.capitalStructureBasis === 'MARKET_VALUE',
      uncertaintyRangesPresent:
        snapshot.wacc.wacc.highBps > snapshot.wacc.wacc.lowBps &&
        snapshot.costOfEquity.blendedBetaUncertainty.highBps >
          snapshot.costOfEquity.blendedBetaUncertainty.lowBps,
      currencyConsistencyEnforced: true,
      termStructureYearSpecific: snapshot.termStructure.years.length >= 2,
      noFlatWaccOnlyPath: snapshot.termStructure.years.some(
        (y, idx, arr) => idx > 0 && y.waccBps !== arr[0]!.waccBps,
      ),
      simulationOnly:
        snapshot.riskFree.simulationOnly &&
        snapshot.wacc.simulationOnly &&
        snapshot.termStructure.simulationOnly,
      noExecutionAuthority: true,
    });
    assert.equal(qualification.marker, HELIOS_VAL03_COST_OF_CAPITAL_QUALIFIED);
    assert.equal(qualification.qualified, true);
    assert.equal(qualification.blockers.length, 0);
  });

  it('passes HELIOS boundary lint for valuation-intelligence module', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const val03Findings = findings.filter((f) => f.file.includes('valuation-intelligence/val03'));
    assert.deepEqual(val03Findings, []);
  });

  it('uses point-in-time evaluation timestamp on snapshot states', () => {
    const asOf = asUtcInstant('2026-01-15T12:00:00.000Z');
    const snapshot = buildCostOfCapitalSnapshot(
      fixtureVal03CostOfCapitalInput({ evaluationTime: asOf }),
    );
    assert.equal(snapshot.wacc.evaluationTime, asOf);
    assert.equal(snapshot.termStructure.evaluationTime, asOf);
  });
});
