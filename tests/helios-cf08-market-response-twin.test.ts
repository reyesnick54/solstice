/**
 * HELIOS CF08 — market response and execution counterfactual twin.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  COUNTERFACTUAL_SIMULATION_FIDELITY_LEVELS,
  evaluateCf08MarketResponseTwinQualification,
  HELIOS_CF08_MARKET_RESPONSE_TWIN_QUALIFIED,
  HELIOS_CF08_DETERMINISTIC_MARKET_MODEL_ID,
  runCounterfactualTriple,
  deepLevel2Snapshot,
  OS03_FIXTURE_NOW,
} from '../packages/platform/src/helios/execution-twin/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS CF08 — market response execution counterfactual twin', () => {
  it('architecture guard: new CF08 files stay inside helios boundary', () => {
    const findings = lintHeliosBoundary(process.cwd()).filter(
      (row) => row.file.includes('helios/execution-twin') && row.file.includes('counterfactual'),
    );
    assert.equal(findings.length, 0, JSON.stringify(findings));
  });

  it('defines three fidelity levels with expected identifiers', () => {
    assert.deepEqual(COUNTERFACTUAL_SIMULATION_FIDELITY_LEVELS, [
      'LEVEL_1_PASSIVE_REPLAY',
      'LEVEL_2_EXECUTION_TWIN',
      'LEVEL_3_RESPONSIVE_MARKET_MODEL',
    ]);
  });

  it('separates passive trajectory from Level 2 and Level 3 fill fingerprints', () => {
    const t0 = OS03_FIXTURE_NOW;
    const t1 = asUtcInstant('2026-11-03T06:00:00.100Z');
    const triple = runCounterfactualTriple({
      calibrationPeriodId: 'cal_2025Q4_fixture',
      uncertaintySummary: 'research baseline; not a live forecast',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      trajectorySnapshots: [deepLevel2Snapshot(t0), deepLevel2Snapshot(t1)],
      hypotheticalOrder: {
        clientOrderId: 'cf08-hypo',
        instrumentId: 'CRYPTO:BTC:USD:SIM',
        side: 'BUY',
        orderType: 'MARKET',
        timeInForce: 'GTC',
        quantityUnits: 12n,
        currency: 'USD',
      },
    });

    assert.equal(triple.passiveReplay.kind, 'PASSIVE_REPLAY');
    assert.equal(triple.passiveReplay.marketImpactAssumed, false);
    assert.equal(triple.passiveReplay.provenance.simulationFidelity, 'LEVEL_1_PASSIVE_REPLAY');
    assert.equal(triple.passiveReplay.observedTrajectory.length, 2);

    assert.equal(triple.executionTwin.kind, 'EXECUTION_TWIN');
    assert.equal(triple.executionTwin.usesNativeExecutionTwin, true);
    assert.equal(triple.executionTwin.provenance.simulationFidelity, 'LEVEL_2_EXECUTION_TWIN');

    assert.equal(triple.responsiveMarket.kind, 'RESPONSIVE_MARKET_MODEL');
    assert.equal(triple.responsiveMarket.provenance.simulationFidelity, 'LEVEL_3_RESPONSIVE_MARKET_MODEL');
    assert.equal(triple.responsiveMarket.provenance.modelId, HELIOS_CF08_DETERMINISTIC_MARKET_MODEL_ID);

    assert.notEqual(
      triple.executionTwin.fillFingerprint,
      triple.responsiveMarket.fillFingerprint,
      'responsive book should change simulated fills vs passive path twin',
    );

    for (const row of [
      triple.passiveReplay.provenance,
      triple.executionTwin.provenance,
      triple.responsiveMarket.provenance,
    ]) {
      assert.equal(row.nonFactual, true);
      assert.ok(row.modelVersion.length > 0);
      assert.ok(row.calibrationPeriodId.length > 0);
      assert.ok(row.uncertaintySummary.length > 0);
    }

    const scores = triple.validation.scores;
    assert.ok(scores.realismScore >= 0 && scores.realismScore <= 100);
    assert.ok(scores.counterfactualValidityScore >= 0 && scores.counterfactualValidityScore <= 100);
    assert.ok(scores.responseSensitivityScore >= 0 && scores.responseSensitivityScore <= 100);
    assert.ok(scores.stylizedFactsScore >= 0 && scores.stylizedFactsScore <= 100);
    assert.ok(scores.impactCurveScore >= 0 && scores.impactCurveScore <= 100);
    assert.ok(scores.postTradeReversionScore >= 0 && scores.postTradeReversionScore <= 100);
  });

  it('HELIOS_CF08_MARKET_RESPONSE_TWIN_QUALIFIED when qualification checks pass', () => {
    const triple = runCounterfactualTriple({
      calibrationPeriodId: 'cal_q',
      uncertaintySummary: 'fixture',
      instrumentId: 'CRYPTO:BTC:USD:SIM',
      trajectorySnapshots: [deepLevel2Snapshot(OS03_FIXTURE_NOW)],
      hypotheticalOrder: {
        clientOrderId: 'q',
        instrumentId: 'CRYPTO:BTC:USD:SIM',
        side: 'BUY',
        orderType: 'MARKET',
        timeInForce: 'GTC',
        quantityUnits: 5n,
        currency: 'USD',
      },
    });

    const result = evaluateCf08MarketResponseTwinQualification({
      threeFidelityLevelsDefined: COUNTERFACTUAL_SIMULATION_FIDELITY_LEVELS.length === 3,
      passiveReplayNoMarketImpactAssumption: triple.passiveReplay.marketImpactAssumed === false,
      executionTwinUsesNativeSimulator: triple.executionTwin.usesNativeExecutionTwin === true,
      responsiveSimulatorInterfacePresent: true,
      deterministicBaselineImplemented: triple.responsiveMarket.provenance.modelId === HELIOS_CF08_DETERMINISTIC_MARKET_MODEL_ID,
      counterfactualProvenanceComplete:
        triple.passiveReplay.provenance.simulationFidelity === 'LEVEL_1_PASSIVE_REPLAY' &&
        triple.executionTwin.provenance.simulationFidelity === 'LEVEL_2_EXECUTION_TWIN' &&
        triple.responsiveMarket.provenance.simulationFidelity === 'LEVEL_3_RESPONSIVE_MARKET_MODEL' &&
        triple.passiveReplay.provenance.modelVersion.length > 0 &&
        triple.passiveReplay.provenance.calibrationPeriodId.length > 0 &&
        triple.passiveReplay.provenance.uncertaintySummary.length > 0,
      validationDimensionsRecorded: true,
      levelThreeMarkedNonFactual: triple.responsiveMarket.provenance.nonFactual === true,
      learnedAdaptersNotFactualByPolicy: true,
    });

    assert.equal(result.marker, HELIOS_CF08_MARKET_RESPONSE_TWIN_QUALIFIED, result.blockers.join('; '));
  });
});
