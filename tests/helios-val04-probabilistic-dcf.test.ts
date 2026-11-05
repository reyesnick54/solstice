/**
 * HELIOS VAL04 — probabilistic FCFF / FCFE DCF engine.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  evaluateVal04ProbabilisticDcfQualification,
  fixtureExitMultipleDcfInput,
  fixtureFadeToMaturityDcfInput,
  fixtureTerminalGrowthDcfInput,
  HELIOS_VAL04_PROBABILISTIC_DCF_QUALIFIED,
  runProbabilisticDcfEngine,
  VAL04_PROBABILISTIC_DCF_SCHEMA,
} from '../packages/platform/src/helios/valuation-intelligence/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS VAL04 probabilistic DCF engine', () => {
  it('passes HELIOS boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd());
    assert.equal(findings.length, 0, findings.map((f) => f.message).join('; '));
  });

  it('runs terminal-growth Monte Carlo with reproducible seed', () => {
    const input = fixtureTerminalGrowthDcfInput();
    const first = runProbabilisticDcfEngine(input);
    const second = runProbabilisticDcfEngine(input);

    assert.equal(first.schema, VAL04_PROBABILISTIC_DCF_SCHEMA);
    assert.equal(first.grantsExecutionAuthority, false);
    assert.equal(first.researchOnly, true);
    assert.equal(first.qualificationMarker, HELIOS_VAL04_PROBABILISTIC_DCF_QUALIFIED);
    assert.equal(first.pathCount, 128);
    assert.deepEqual(first.enterpriseValue, second.enterpriseValue);
    assert.deepEqual(first.valuePerShare, second.valuePerShare);

    const rep = first.representativePath;
    assert.ok(rep.yearly.length === input.forecastYears);
    assert.ok(rep.yearly[0]!.nopat > 0);
    assert.ok(rep.yearly[0]!.fcff <= rep.yearly[0]!.nopat);
    assert.ok(rep.yearly[0]!.fcfe !== undefined);
    assert.ok(first.enterpriseValue.median > 0);
    assert.ok(first.enterpriseValue.p05 <= first.enterpriseValue.p95);
    assert.ok(first.fcffTerminalYear.median !== 0);
  });

  it('supports exit-multiple and fade-to-maturity terminals', () => {
    const exit = runProbabilisticDcfEngine(fixtureExitMultipleDcfInput());
    assert.equal(exit.terminalMethod, 'EXIT_MULTIPLE');
    assert.ok(exit.enterpriseValue.median > 0);

    const fade = runProbabilisticDcfEngine(fixtureFadeToMaturityDcfInput());
    assert.equal(fade.terminalMethod, 'FADE_TO_MATURITY');
    assert.ok(fade.representativePath.terminalValue > 0);
  });

  it('builds three sensitivity surfaces', () => {
    const result = runProbabilisticDcfEngine(fixtureTerminalGrowthDcfInput());
    assert.equal(result.sensitivitySurfaces.length, 3);
    const ids = result.sensitivitySurfaces.map((s) => s.id).sort();
    assert.deepEqual(ids, ['growth_x_margin', 'reinvestment_x_roic', 'wacc_x_terminal_growth']);
    for (const surface of result.sensitivitySurfaces) {
      assert.equal(surface.yValues.length, surface.values.length);
      for (const row of surface.values) {
        assert.equal(row.length, surface.xValues.length);
      }
    }
  });

  it('emits full percentile ladder', () => {
    const { enterpriseValue } = runProbabilisticDcfEngine(fixtureTerminalGrowthDcfInput());
    assert.ok(enterpriseValue.p05 <= enterpriseValue.p10);
    assert.ok(enterpriseValue.p10 <= enterpriseValue.p25);
    assert.ok(enterpriseValue.p25 <= enterpriseValue.median);
    assert.ok(enterpriseValue.median <= enterpriseValue.p75);
    assert.ok(enterpriseValue.p75 <= enterpriseValue.p90);
    assert.ok(enterpriseValue.p90 <= enterpriseValue.p95);
  });

  it('HELIOS_VAL04_PROBABILISTIC_DCF_QUALIFIED when engineering checks pass', () => {
    const result = runProbabilisticDcfEngine(fixtureTerminalGrowthDcfInput());
    const qualification = evaluateVal04ProbabilisticDcfQualification({
      fcffAndFcfePaths: result.representativePath.yearly.every((y) => y.fcff !== undefined && y.fcfe !== undefined),
      explicitForecastSupport: true,
      terminalGrowthMethod: true,
      exitMultipleMethod: true,
      fadeToMaturityMethod: true,
      monteCarloCorrelatedAssumptions: true,
      deterministicSeed: result.seed === fixtureTerminalGrowthDcfInput().seed,
      percentileOutputs: result.enterpriseValue.p05 !== result.enterpriseValue.p95,
      sensitivitySurfaces: result.sensitivitySurfaces.length === 3,
      economicGrowthCap: true,
      roicReinvestmentCoherence: true,
      noExecutionAuthority: result.grantsExecutionAuthority === false,
      researchOnly: result.researchOnly === true,
    });
    assert.equal(qualification.marker, HELIOS_VAL04_PROBABILISTIC_DCF_QUALIFIED);
    assert.equal(qualification.qualified, true);
    assert.equal(qualification.blockers.length, 0);
  });
});
