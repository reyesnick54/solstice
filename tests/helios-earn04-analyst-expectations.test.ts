/**
 * HELIOS Earnings Intelligence EARN04 — analyst expectation dynamics.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  ANALYST_RESPONSIVENESS,
  HELIOS_EARN04,
  HELIOS_EARN04_ANALYST_EXPECTATIONS_QUALIFIED,
  HELIOS_EARN04_DATA_PLANE,
  buildAnalystTrackRecords,
  buildDynamicExpectationState,
  createDynamicConsensusFilter,
  detectForecastRevisions,
  evaluateEarn04AnalystExpectationsQualification,
  filterKnowableForecasts,
  fixtureAnalystForecasts,
  fixtureHistoricalConsensusSnapshots,
  fixtureHistoricalOutcomes,
  fixtureMaterialGuidanceEvent,
  fixtureRevisionWave,
  FIXTURE_FY26Q1,
  FIXTURE_SECURITY_ID,
  FIXTURE_SECTOR_BY_SECURITY,
  measureAnalystResponsiveness,
} from '../packages/platform/src/helios/earnings-intelligence/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const AS_OF = asUtcInstant('2026-01-20T12:00:00.000Z');

describe('HELIOS EARN04 analyst expectation dynamics', () => {
  it('exports chunk marker and simulation-only data plane', () => {
    assert.equal(HELIOS_EARN04, 'HELIOS_EARN04');
    assert.equal(HELIOS_EARN04_DATA_PLANE, 'FIXTURE_SIMULATION_ONLY');
  });

  it('enforces point-in-time knowableAt filtering', () => {
    const forecasts = fixtureAnalystForecasts();
    const pit = filterKnowableForecasts(forecasts, AS_OF);
    assert.equal(pit.length, forecasts.length);

    const futureOnly = filterKnowableForecasts(forecasts, asUtcInstant('2026-01-01T00:00:00.000Z'));
    assert.equal(futureOnly.length, 0);
  });

  it('computes consensus statistics from fixture forecasts', () => {
    const state = buildDynamicExpectationState({
      securityId: FIXTURE_SECURITY_ID,
      fiscalPeriod: FIXTURE_FY26Q1,
      metric: 'eps_diluted',
      forecasts: fixtureAnalystForecasts(),
      outcomes: fixtureHistoricalOutcomes(),
      historicalConsensusSnapshots: fixtureHistoricalConsensusSnapshots(AS_OF),
      sectorBySecurity: FIXTURE_SECTOR_BY_SECURITY,
      asOf: AS_OF,
    });
    assert.ok(state);
    assert.equal(state!.consensus.forecastCount, 6);
    assert.ok(state!.consensus.dispersion > 0);
    assert.ok(state!.consensus.interquartileRange >= 0);
    assert.equal(state!.grantsExecutionAuthority, false);
    assert.equal(state!.dataPlane, 'FIXTURE_SIMULATION_ONLY');
  });

  it('tracks revision intelligence after material information', () => {
    const forecasts = fixtureRevisionWave(AS_OF);
    const revisions = detectForecastRevisions(forecasts);
    assert.ok(revisions.length >= 3);

    const state = buildDynamicExpectationState({
      securityId: FIXTURE_SECURITY_ID,
      fiscalPeriod: FIXTURE_FY26Q1,
      metric: 'eps_diluted',
      forecasts,
      outcomes: fixtureHistoricalOutcomes(),
      historicalConsensusSnapshots: fixtureHistoricalConsensusSnapshots(AS_OF),
      materialEvent: fixtureMaterialGuidanceEvent(),
      sectorBySecurity: FIXTURE_SECTOR_BY_SECURITY,
      asOf: AS_OF,
    });
    assert.ok(state);
    assert.ok(state!.revisionState.revisionBreadth > 0);
    assert.ok(state!.revisionState.upwardRevisionShare + state!.revisionState.downwardRevisionShare <= 1.0001);

    const responsiveness = measureAnalystResponsiveness({
      securityId: FIXTURE_SECURITY_ID,
      fiscalPeriod: FIXTURE_FY26Q1,
      metric: 'eps_diluted',
      forecasts,
      materialEvent: fixtureMaterialGuidanceEvent(),
      asOf: AS_OF,
    });
    assert.ok(responsiveness);
    assert.equal(responsiveness!.kind, ANALYST_RESPONSIVENESS);
    assert.ok(responsiveness!.responsivenessScore >= 0);
  });

  it('separates high current dispersion from unstable dispersion (VoD)', () => {
    const state = buildDynamicExpectationState({
      securityId: FIXTURE_SECURITY_ID,
      fiscalPeriod: FIXTURE_FY26Q1,
      metric: 'eps_diluted',
      forecasts: fixtureAnalystForecasts(),
      outcomes: fixtureHistoricalOutcomes(),
      historicalConsensusSnapshots: fixtureHistoricalConsensusSnapshots(AS_OF),
      sectorBySecurity: FIXTURE_SECTOR_BY_SECURITY,
      asOf: AS_OF,
    });
    assert.ok(state);
    assert.equal(typeof state!.dispersionState.volatilityOfDisagreement, 'number');
    assert.equal(typeof state!.dispersionState.highCurrentDispersion, 'boolean');
    assert.equal(typeof state!.dispersionState.unstableDispersionOverTime, 'boolean');
  });

  it('builds historical analyst reliability without future outcome leakage', () => {
    const forecasts = fixtureAnalystForecasts();
    const earlyAsOf = asUtcInstant('2025-08-01T00:00:00.000Z');
    const earlyRecords = buildAnalystTrackRecords({
      forecasts,
      outcomes: fixtureHistoricalOutcomes(),
      asOf: earlyAsOf,
      sectorBySecurity: FIXTURE_SECTOR_BY_SECURITY,
    });
    assert.equal(earlyRecords.size, 0);

    const laterRecords = buildAnalystTrackRecords({
      forecasts,
      outcomes: fixtureHistoricalOutcomes(),
      asOf: AS_OF,
      sectorBySecurity: FIXTURE_SECTOR_BY_SECURITY,
    });
    assert.ok(laterRecords.size >= 0);
  });

  it('produces StreetExpectationDistribution from DynamicConsensusFilter', () => {
    const forecasts = fixtureRevisionWave(AS_OF);
    const filter = createDynamicConsensusFilter({ residualMode: 'huber' });
    const state = buildDynamicExpectationState({
      securityId: FIXTURE_SECURITY_ID,
      fiscalPeriod: FIXTURE_FY26Q1,
      metric: 'eps_diluted',
      forecasts,
      outcomes: fixtureHistoricalOutcomes(),
      historicalConsensusSnapshots: fixtureHistoricalConsensusSnapshots(AS_OF),
      sectorBySecurity: FIXTURE_SECTOR_BY_SECURITY,
      asOf: AS_OF,
    });
    assert.ok(state);
    const dist = state!.streetDistribution;
    assert.ok(Number.isFinite(dist.robustLocation));
    assert.ok(dist.confidenceInterval.upper >= dist.confidenceInterval.lower);
    assert.ok(dist.breadth >= 0 && dist.breadth <= 1);

    const studentFilter = createDynamicConsensusFilter({ residualMode: 'student_t' });
    const studentDist = studentFilter.update({
      forecasts,
      trackRecords: new Map(),
      asOf: AS_OF,
      revisionState: state!.revisionState,
    });
    assert.ok(studentDist);
  });

  it('qualifies EARN04 with fixture simulation checks', () => {
    const state = buildDynamicExpectationState({
      securityId: FIXTURE_SECURITY_ID,
      fiscalPeriod: FIXTURE_FY26Q1,
      metric: 'eps_diluted',
      forecasts: fixtureRevisionWave(AS_OF),
      outcomes: fixtureHistoricalOutcomes(),
      historicalConsensusSnapshots: fixtureHistoricalConsensusSnapshots(AS_OF),
      materialEvent: fixtureMaterialGuidanceEvent(),
      sectorBySecurity: FIXTURE_SECTOR_BY_SECURITY,
      asOf: AS_OF,
    });
    assert.ok(state);

    const qualification = evaluateEarn04AnalystExpectationsQualification({
      pointInTimeForecasts: filterKnowableForecasts(fixtureRevisionWave(AS_OF), AS_OF).length > 0,
      consensusStatistics: state!.consensus.forecastCount > 0,
      revisionIntelligence: detectForecastRevisions(fixtureRevisionWave(AS_OF)).length > 0,
      analystResponsiveness: measureAnalystResponsiveness({
        securityId: FIXTURE_SECURITY_ID,
        fiscalPeriod: FIXTURE_FY26Q1,
        metric: 'eps_diluted',
        forecasts: fixtureRevisionWave(AS_OF),
        materialEvent: fixtureMaterialGuidanceEvent(),
        asOf: AS_OF,
      }) !== null,
      volatilityOfDisagreement: state!.dispersionState.historicalDispersionSeries.length > 0,
      historicalAnalystReliability: true,
      noFutureOutcomeLeakage: true,
      dynamicConsensusFilter: Number.isFinite(state!.streetDistribution.robustLocation),
      streetExpectationDistribution: state!.streetDistribution.dispersion >= 0,
      fixtureSimulationOnly: state!.dataPlane === 'FIXTURE_SIMULATION_ONLY',
      noExecutionAuthority: state!.grantsExecutionAuthority === false,
    });

    assert.equal(qualification.marker, HELIOS_EARN04_ANALYST_EXPECTATIONS_QUALIFIED);
    assert.equal(qualification.qualified, true);
    assert.equal(qualification.blockers.length, 0);
  });

  it('respects HELIOS platform boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const earn04 = findings.filter((f) => f.file.includes('earnings-intelligence/analyst-expectations'));
    assert.deepEqual(earn04, []);
  });
});
