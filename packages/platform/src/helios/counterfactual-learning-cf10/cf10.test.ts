import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '@solstice/domain';

import {
  HELIOS_CF10_DECISION_ATTRIBUTION_QUALIFIED,
  buildHeliosCf10DecisionAttributionReport,
  type HeliosCf10GateDecisionObservation,
} from './index.ts';

const NOW = asUtcInstant('2026-11-06T12:00:00.000Z');
const LATER = asUtcInstant('2026-11-10T12:00:00.000Z');

function baseObservation(
  overrides: Partial<HeliosCf10GateDecisionObservation>,
): HeliosCf10GateDecisionObservation {
  return {
    observationId: `obs_${overrides.observationId ?? 'default'}`,
    gateFamily: 'STRATEGY',
    reasonCode: 'STRATEGY_CAPSULE_UNQUALIFIED',
    evaluatedAt: NOW,
    outcomeHorizonEndsAt: LATER,
    rejected: true,
    evaluationCount: 1n,
    rejectionCount: 1n,
    futureMarketPathResultMinor: '1000000',
    executionCounterfactualEstimateMinor: '1200000',
    opeEstimateMinor: '1150000',
    estimateConfidence: 0.6,
    estimateSupport: 2,
    regimeId: 'REGIME_HIGH_VOL',
    ...overrides,
  };
}

describe('HELIOS CF10 counterfactual decision attribution', () => {
  it('marks qualified reports with HELIOS_CF10_DECISION_ATTRIBUTION_QUALIFIED and ESTIMATED semantics', () => {
    const report = buildHeliosCf10DecisionAttributionReport({
      generatedAt: NOW,
      observations: [baseObservation({ observationId: 'one', gateFamily: 'VALUATION' })],
    });
    assert.equal(report.qualificationMarker, HELIOS_CF10_DECISION_ATTRIBUTION_QUALIFIED);
    assert.equal(report.semantics, 'ESTIMATED');
    assert.equal(report.perObservation[0]?.semantics, 'ESTIMATED');
  });

  it('classifies valuation reject with upside and no stress as potentially costly (ESTIMATED)', () => {
    const report = buildHeliosCf10DecisionAttributionReport({
      generatedAt: NOW,
      observations: [
        baseObservation({
          observationId: 'val',
          gateFamily: 'VALUATION',
          reasonCode: 'MARGIN_OF_SAFETY_INSUFFICIENT',
          rejected: true,
          observedDownsideStress: false,
          observedLiquidityStress: false,
          riskAdjustmentMinor: '0',
        }),
      ],
    });
    assert.equal(report.perObservation[0]?.rejectionInterpretation, 'REJECTION_APPEARS_COSTLY');
  });

  it('does not treat compliance or risk rejects as costly on price path alone', () => {
    const compliance = buildHeliosCf10DecisionAttributionReport({
      generatedAt: NOW,
      observations: [
        baseObservation({
          observationId: 'c',
          gateFamily: 'COMPLIANCE',
          reasonCode: 'JURISDICTION_CAPABILITY_DISABLED',
          rejected: true,
          observedDownsideStress: false,
          observedLiquidityStress: false,
        }),
      ],
    });
    assert.equal(compliance.perObservation[0]?.rejectionInterpretation, 'REJECTION_APPEARS_PROTECTIVE');

    const risk = buildHeliosCf10DecisionAttributionReport({
      generatedAt: NOW,
      observations: [
        baseObservation({
          observationId: 'r',
          gateFamily: 'RISK',
          reasonCode: 'RISK_REFUSED',
          rejected: true,
        }),
      ],
    });
    assert.equal(risk.perObservation[0]?.rejectionInterpretation, 'REJECTION_APPEARS_PROTECTIVE');
  });

  it('uses MIXED when stress coexists with positive risk-adjusted regret (non-policy gate)', () => {
    const report = buildHeliosCf10DecisionAttributionReport({
      generatedAt: NOW,
      observations: [
        baseObservation({
          observationId: 'mix',
          gateFamily: 'STRATEGY',
          observedDownsideStress: true,
          observedLiquidityStress: false,
        }),
      ],
    });
    assert.equal(report.perObservation[0]?.rejectionInterpretation, 'MIXED');
  });
});
