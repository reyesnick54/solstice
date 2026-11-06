/**
 * HELIOS EVOL10 — regime robustness and generalization engine qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HELIOS_EVOL10_REGIME_GENERALIZATION_QUALIFIED,
  evaluateEvol10GenomeRegimeReport,
  evaluateEvol10RegimeGeneralizationQualification,
  labelEvol10RegimeDimensions,
  mapMacroObservationToEvol10,
} from '../packages/strategy-lab/src/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS EVOL10 regime generalization', () => {
  it('passes HELIOS boundary guard', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
  });

  it('labels EVOL10 dimensions from M13 + macro without future regime leaks', () => {
    const tags = labelEvol10RegimeDimensions({
      m13Dimensions: ['TRENDING_UP', 'HIGH_VOLATILITY', 'RISK_ON', 'NORMAL_LIQUIDITY'],
      macro: {
        asOf: '2024-01-15T12:00:00.000Z',
        headlineInflationYoYBps: 350,
        policyRateChangeBps: 50,
      },
    });
    assert.equal(tags.includes('bull'), true);
    assert.equal(tags.includes('high_volatility'), true);
    assert.equal(tags.includes('risk_on'), true);
    assert.equal(tags.includes('liquidity_expansion'), true);
    assert.equal(tags.includes('inflationary'), true);
    assert.equal(tags.includes('rising_rates'), true);
    const macroOnly = mapMacroObservationToEvol10({
      asOf: '2024-02-01T00:00:00.000Z',
      headlineInflationYoYBps: 120,
      policyRateChangeBps: -30,
    });
    assert.equal(macroOnly.includes('disinflationary'), true);
    assert.equal(macroOnly.includes('falling_rates'), true);
  });

  it('builds matrix, LORO, stress, temporal, and generalization score', () => {
    const matrix = Object.freeze({
      methodologyVersion: 'helios-evol10-regime-matrix-v1' as const,
      cells: Object.freeze([
        {
          genomeId: 'g1',
          regimeDimension: 'bull' as const,
          observationCount: 10,
          totalReturnMinor: 1_200_000n,
        },
        {
          genomeId: 'g1',
          regimeDimension: 'bear' as const,
          observationCount: 10,
          totalReturnMinor: 400_000n,
        },
        {
          genomeId: 'g1',
          regimeDimension: 'high_volatility' as const,
          observationCount: 8,
          totalReturnMinor: -100_000n,
        },
        {
          genomeId: 'g1',
          regimeDimension: 'risk_off' as const,
          observationCount: 6,
          totalReturnMinor: 50_000n,
        },
      ]),
    });
    const report = evaluateEvol10GenomeRegimeReport({
      matrix,
      genomeId: 'g1',
      temporal: { firstHalfReturnMinor: 500_000n, secondHalfReturnMinor: 900_000n },
      transition: { transitionCount: 3, transitionReturnMinor: 120_000n },
      meanReturnScaleMinor: 1_000_000n,
    });
    assert.equal(report.worstRegimePerformance.regime, 'high_volatility');
    assert.ok(report.crossRegimeRobustness.crossRegimeStdevMinor >= 0n);
    assert.equal(report.leaveOneRegimeOut.folds.length, 4);
    assert.equal(report.temporalTransfer.temporalGapMinor, 400_000n);
    assert.equal(report.stressRegime.stressRegimesPresent.includes('high_volatility'), true);
    assert.equal(report.regimeTransitionPerformance.transitionCount, 3);
    assert.ok(typeof report.generalizationScoreBps === 'bigint');
    const q = evaluateEvol10RegimeGeneralizationQualification({
      report,
      minGeneralizationScoreBps: -1_000_000n,
      minWorstRegimeReturnMinor: -500_000n,
    });
    assert.equal(q.qualified, true);
    assert.equal(q.token, HELIOS_EVOL10_REGIME_GENERALIZATION_QUALIFIED);
  });

  it('applies niche exception for gated regime specialists', () => {
    const matrix = Object.freeze({
      methodologyVersion: 'helios-evol10-regime-matrix-v1' as const,
      cells: Object.freeze([
        {
          genomeId: 'niche',
          regimeDimension: 'bull' as const,
          observationCount: 20,
          totalReturnMinor: 5_000_000n,
        },
        {
          genomeId: 'niche',
          regimeDimension: 'bear' as const,
          observationCount: 2,
          totalReturnMinor: -4_000_000n,
        },
      ]),
    });
    const report = evaluateEvol10GenomeRegimeReport({
      matrix,
      genomeId: 'niche',
      regimeSpecialistDeclared: true,
      regimeSpecialistGated: true,
      meanReturnScaleMinor: 1_000_000n,
    });
    assert.equal(report.nicheExceptionApplied, true);
    const q = evaluateEvol10RegimeGeneralizationQualification({
      report,
      minGeneralizationScoreBps: 0n,
      minWorstRegimeReturnMinor: -5_000_000n,
    });
    assert.equal(q.qualified, true);
  });
});
