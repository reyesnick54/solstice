/**
 * HELIOS VAL02 — business driver and cash-flow forecast engine.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  createHeliosEarningsStateEstimatorService,
  FIXTURE_EARNINGS_AS_OF,
  FIXTURE_EARNINGS_GATING,
  fixtureEarningsExpertSignals,
} from '../packages/platform/src/helios/earnings-intelligence/state-estimator/index.ts';
import {
  createHeliosVal02DriverForecastService,
  evaluateVal02DriverForecastQualification,
  evaluateDriverTree,
  HELIOS_VAL02_DRIVER_FORECAST_QUALIFIED,
  qualificationChecksFromForecast,
  FIXTURE_VAL02_ANALYST_REVENUE,
  FIXTURE_VAL02_AS_OF,
  fixtureVal02DriverModel,
  fixtureVal02Fundamentals,
} from '../packages/platform/src/helios/valuation-intelligence/driver-forecast/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS VAL02 driver and cash-flow forecast engine', () => {
  it('passes HELIOS boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd());
    assert.equal(findings.length, 0, findings.map((f) => f.message).join('; '));
  });

  it('builds volume × price and segment rollup driver trees', () => {
    const model = fixtureVal02DriverModel();
    const tree = evaluateDriverTree(model.revenueDriverTree, {
      revenueGrowth: 0.02,
      grossMargin: 0,
      operatingMargin: 0,
      capexIntensity: 0,
      workingCapitalIntensity: 0,
      reinvestment: 0,
    }, 1);
    assert.equal(tree.nodeKind, 'CAPACITY_BIND');
    assert.ok(tree.value > 0);
    const segmentSum = tree.children[0];
    assert.equal(segmentSum?.nodeKind, 'SUM');
    const product = segmentSum?.children.find((row) => row.nodeKind === 'PRODUCT');
    assert.ok(product);
    assert.equal(product?.children.length, 2);
  });

  it('produces probabilistic cash-flow distributions with three horizons', () => {
    const earnService = createHeliosEarningsStateEstimatorService();
    const nearTerm = earnService.estimate({
      instrumentId: 'eq:AAPL',
      fiscalPeriodKey: '2026Q4',
      asOf: FIXTURE_EARNINGS_AS_OF,
      gating: FIXTURE_EARNINGS_GATING,
      expertSignals: fixtureEarningsExpertSignals(),
    });

    const service = createHeliosVal02DriverForecastService();
    const forecast = service.forecast({
      instrumentId: 'eq:AAPL',
      asOf: FIXTURE_VAL02_AS_OF,
      fundamentals: fixtureVal02Fundamentals(),
      driverModel: fixtureVal02DriverModel(),
      nearTermEarnings: nearTerm,
      analystRevenueExpectations: FIXTURE_VAL02_ANALYST_REVENUE,
      sampleCount: 48,
      randomSeed: 1662,
    });

    assert.equal(forecast.schema, 'sunrey.helios.valuation-intelligence.driver-forecast.v1');
    assert.equal(forecast.grantsExecutionAuthority, false);
    assert.equal(forecast.epsExtrapolationOnly, false);
    assert.equal(forecast.driverTreesUsed, true);
    assert.deepEqual(forecast.horizonBands, ['NEAR', 'MEDIUM', 'LONG']);
    assert.ok(forecast.periods.length >= 3);
    assert.ok(forecast.nearTermEarn09Anchored);

    assert.ok(forecast.periods.some((period) => period.horizonBand === 'NEAR'));
    assert.ok(forecast.periods.some((period) => period.horizonBand === 'LONG'));
    const y1 = forecast.periods.find((period) => period.horizonBand === 'NEAR')!;
    assert.ok(y1.lineItems.revenue.p50 > 0);
    assert.ok(y1.lineItems.fcff.p50 !== 0);
    assert.ok(y1.lineItems.fcfe.p50 !== 0);
    assert.ok(y1.lineItems.grossMargin.p50 > 0 && y1.lineItems.grossMargin.p50 < 1);
    assert.ok(y1.lineItems.operatingMargin.p50 <= y1.lineItems.grossMargin.p90);
    assert.ok(y1.feasiblePathCount > 0);
  });

  it('qualifies HELIOS_VAL02_DRIVER_FORECAST_QUALIFIED', () => {
    const service = createHeliosVal02DriverForecastService();
    const forecast = service.forecast({
      instrumentId: 'eq:AAPL',
      asOf: asUtcInstant('2026-11-01T00:00:00.000Z'),
      fundamentals: fixtureVal02Fundamentals(),
      driverModel: fixtureVal02DriverModel(),
      sampleCount: 64,
      randomSeed: 42,
    });

    const checks = qualificationChecksFromForecast(forecast, true);
    const result = evaluateVal02DriverForecastQualification(checks);
    assert.equal(result.marker, HELIOS_VAL02_DRIVER_FORECAST_QUALIFIED);
    assert.equal(result.qualified, true);
    assert.equal(result.blockers.length, 0);
  });
});
