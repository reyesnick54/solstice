/**
 * HELIOS FORWARD ALPHA — ALPHA10 forward regime robustness qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HELIOS_ALPHA10_FORWARD_GENERALIZATION_BLOCKED,
  HELIOS_ALPHA10_FORWARD_GENERALIZATION_QUALIFIED,
  EMPTY_FORWARD_REGIME_SCOPE,
  buildForwardRegimeMatrix,
  evaluateAlpha10ForwardGeneralizationQualification,
  evaluateAlpha10ForwardRegimeReport,
  labelEvol10RegimeDimensions,
  type ForwardRegimePerformanceObservation,
} from '../packages/strategy-lab/src/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const CAMPAIGN_START = '2024-06-01T00:00:00.000Z';

function obs(
  regime: 'bull' | 'bear' | 'high_volatility',
  ret: bigint,
  active = true,
  transition = false,
): ForwardRegimePerformanceObservation {
  return Object.freeze({
    strategyId: 'strat-a',
    decisionTime: '2024-06-15T12:00:00.000Z',
    forwardReturnMinor: ret,
    regimeDimensions: Object.freeze([regime]),
    scope: Object.freeze({
      ...EMPTY_FORWARD_REGIME_SCOPE,
      assetClass: 'EQUITY',
      sector: 'TECH',
      market: 'US',
      venue: 'SIM',
      geography: 'US',
    }),
    strategyActive: active,
    isRegimeTransitionBar: transition,
  });
}

describe('HELIOS ALPHA10 forward regime robustness', () => {
  it('passes HELIOS boundary guard', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
  });

  it('labels regimes from PIT M13 + macro via EVOL10 bridge', () => {
    const tags = labelEvol10RegimeDimensions({
      m13Dimensions: ['TRENDING_UP', 'LOW_VOLATILITY', 'RISK_ON'],
      macro: { asOf: '2024-01-01T00:00:00.000Z', policyRateChangeBps: -40 },
    });
    assert.equal(tags.includes('bull'), true);
    assert.equal(tags.includes('falling_rates'), true);
  });

  it('builds ForwardRegimeMatrix, RegimeConcentration, and RegimeTransitionPerformance', () => {
    const observations = Object.freeze([
      obs('bull', 800_000n),
      obs('bear', 300_000n),
      obs('high_volatility', 50_000n),
      obs('bull', 100_000n, true, true),
    ]);
    const report = evaluateAlpha10ForwardRegimeReport({
      strategyId: 'strat-a',
      observations,
      campaignStartedAt: CAMPAIGN_START,
      campaignDeclaration: Object.freeze({
        campaignId: 'cmp-1',
        strategyId: 'strat-a',
        declaredAt: '2024-05-01T00:00:00.000Z',
        regimeSpecialist: false,
        intendedRegimes: Object.freeze([]),
        mandateRegimes: Object.freeze(['bull', 'bear', 'high_volatility']),
      }),
    });
    assert.equal(report.matrix.methodologyVersion, 'helios-alpha10-forward-regime-matrix-v1');
    assert.equal(report.regimeConcentration.methodologyVersion, 'helios-alpha10-regime-concentration-v1');
    assert.equal(report.regimeTransitionPerformance.transitionCount, 1);
    assert.equal(report.regimeTransitionPerformance.transitionReturnMinor, 100_000n);
    assert.ok(report.crossScopeMatrices.length === 5);
    const matrixOnly = buildForwardRegimeMatrix(observations);
    assert.equal(matrixOnly.cells.length, 3);
    const q = evaluateAlpha10ForwardGeneralizationQualification({
      report,
      campaignDeclaration: Object.freeze({
        campaignId: 'cmp-1',
        strategyId: 'strat-a',
        declaredAt: '2024-05-01T00:00:00.000Z',
        regimeSpecialist: false,
        intendedRegimes: Object.freeze([]),
        mandateRegimes: Object.freeze(['bull', 'bear', 'high_volatility']),
      }),
      minGeneralizationScoreBps: -2_000_000n,
      minWorstRegimeReturnMinor: -500_000n,
    });
    assert.equal(q.qualified, true);
    assert.equal(q.token, HELIOS_ALPHA10_FORWARD_GENERALIZATION_QUALIFIED);
  });

  it('qualifies pre-declared regime specialists inactive outside intended regimes', () => {
    const observations = Object.freeze([
      obs('bull', 2_000_000n),
      Object.freeze({
        ...obs('bear', -50_000n),
        strategyActive: false,
      }),
    ]);
    const declaration = Object.freeze({
      campaignId: 'cmp-sp',
      strategyId: 'strat-a',
      declaredAt: '2024-05-10T00:00:00.000Z',
      regimeSpecialist: true,
      intendedRegimes: Object.freeze(['bull' as const]),
      mandateRegimes: Object.freeze(['bull' as const, 'bear' as const]),
    });
    const report = evaluateAlpha10ForwardRegimeReport({
      strategyId: 'strat-a',
      observations,
      campaignStartedAt: CAMPAIGN_START,
      campaignDeclaration: declaration,
    });
    assert.equal(report.nicheExceptionApplied, true);
    assert.equal(report.inactiveOutsideIntendedRegime, true);
    const q = evaluateAlpha10ForwardGeneralizationQualification({
      report,
      campaignDeclaration: declaration,
      minWorstRegimeReturnMinor: -100_000n,
    });
    assert.equal(q.qualified, true);
    assert.equal(q.token, HELIOS_ALPHA10_FORWARD_GENERALIZATION_QUALIFIED);
  });

  it('blocks retrospective regime-specialist claims', () => {
    const observations = Object.freeze([obs('bull', 500_000n)]);
    const declaration = Object.freeze({
      campaignId: 'cmp-late',
      strategyId: 'strat-a',
      declaredAt: '2024-07-01T00:00:00.000Z',
      regimeSpecialist: true,
      intendedRegimes: Object.freeze(['bull' as const]),
      mandateRegimes: Object.freeze([]),
    });
    const report = evaluateAlpha10ForwardRegimeReport({
      strategyId: 'strat-a',
      observations,
      campaignStartedAt: CAMPAIGN_START,
      campaignDeclaration: declaration,
    });
    assert.equal(report.retrospectiveSpecialistBlocked, true);
    const q = evaluateAlpha10ForwardGeneralizationQualification({
      report,
      campaignDeclaration: declaration,
    });
    assert.equal(q.qualified, false);
    assert.equal(q.token, HELIOS_ALPHA10_FORWARD_GENERALIZATION_BLOCKED);
    assert.equal(q.blockers.includes('RETROSPECTIVE_REGIME_SPECIALIST_CLAIM'), true);
  });

  it('blocks specialists active outside declared regimes', () => {
    const observations = Object.freeze([
      obs('bull', 1_000_000n),
      obs('bear', 200_000n),
    ]);
    const declaration = Object.freeze({
      campaignId: 'cmp-bad',
      strategyId: 'strat-a',
      declaredAt: '2024-05-01T00:00:00.000Z',
      regimeSpecialist: true,
      intendedRegimes: Object.freeze(['bull' as const]),
      mandateRegimes: Object.freeze(['bull' as const]),
    });
    const report = evaluateAlpha10ForwardRegimeReport({
      strategyId: 'strat-a',
      observations,
      campaignStartedAt: CAMPAIGN_START,
      campaignDeclaration: declaration,
    });
    assert.equal(report.inactiveOutsideIntendedRegime, false);
    const q = evaluateAlpha10ForwardGeneralizationQualification({
      report,
      campaignDeclaration: declaration,
    });
    assert.equal(q.qualified, false);
    assert.equal(q.blockers.includes('ACTIVE_OUTSIDE_DECLARED_REGIME'), true);
  });
});
