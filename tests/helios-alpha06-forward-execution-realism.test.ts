/**
 * HELIOS Forward Alpha — ALPHA06 execution realism qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import {
  HELIOS_ALPHA06_EXECUTION_REALISM_QUALIFIED,
  alpha06DecayScenario,
  alpha06PerpFundingScenario,
  alpha06SimulationPostureOk,
  alpha06SurvivingScenario,
  buildAlpha06QualificationChecks,
  evaluateAlpha06ExecutionRealismQualification,
  evaluateMd15MarketDataPosture,
  runAlpha06ForwardExecutionRealism,
} from '../packages/platform/src/helios/forward-alpha/index.ts';
import { midPriceMinor, marketBookFromLevel2 } from '../packages/platform/src/helios/execution-twin/simulation/market-book.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = new URL('..', import.meta.url).pathname;

describe('HELIOS Forward Alpha — ALPHA06 execution realism', () => {
  it('passes HELIOS boundary lint for forward-alpha owner', () => {
    const findings = lintHeliosBoundary(ROOT).filter((row) => row.file.includes('helios/forward-alpha'));
    assert.equal(findings.length, 0, findings.map((row) => row.message).join('; '));
  });

  it('preserves simulation posture', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
    assert.equal(LIVE_INVESTMENT_EXECUTION, false);
    assert.equal(alpha06SimulationPostureOk(), true);
  });

  it('exposes SIGNAL_ONLY_RETURN and IMPLEMENTABLE_RETURN lanes', () => {
    const surviving = runAlpha06ForwardExecutionRealism({ scenario: alpha06SurvivingScenario() });
    assert.equal(surviving.lanes.length, 2);
    const signal = surviving.lanes.find((row) => row.lane === 'SIGNAL_ONLY_RETURN')!;
    const implementable = surviving.lanes.find((row) => row.lane === 'IMPLEMENTABLE_RETURN')!;
    assert.ok(signal.netPnlMinor > 0n);
    assert.ok(implementable.netPnlMinor < signal.netPnlMinor);
    assert.ok(surviving.signalToImplementationDecayBps != null && surviving.signalToImplementationDecayBps > 0);
    assert.equal(surviving.promote, true);
    assert.equal(surviving.implementable.routing.grantsExecutionAuthority, false);
    assert.equal(surviving.implementable.entryFills.length > 0, true);
    for (const fill of surviving.implementable.entryFills) {
      const mid = midPriceMinor(marketBookFromLevel2(alpha06SurvivingScenario().entryBook));
      if (mid != null) {
        assert.notEqual(fill.priceMinorUnits, mid);
      }
    }
  });

  it('blocks promotion when alpha vanishes under realistic execution', () => {
    const decayed = runAlpha06ForwardExecutionRealism({ scenario: alpha06DecayScenario() });
    assert.equal(decayed.promote, false);
    assert.equal(decayed.promotionOutcome, 'REJECT_DECAY');
    assert.ok(decayed.implementable.unfilledEntryUnits > 0n || decayed.implementable.entryFills.length < 10);
  });

  it('applies perpetual funding costs when strategy requires them', () => {
    const perp = runAlpha06ForwardExecutionRealism({ scenario: alpha06PerpFundingScenario() });
    assert.ok(perp.implementable.fundingCostMinor > 0n);
    const spot = runAlpha06ForwardExecutionRealism({ scenario: alpha06SurvivingScenario() });
    assert.equal(spot.implementable.fundingCostMinor, 0n);
    assert.ok(perp.lanes.find((row) => row.lane === 'IMPLEMENTABLE_RETURN')!.netPnlMinor < spot.lanes.find((row) => row.lane === 'IMPLEMENTABLE_RETURN')!.netPnlMinor);
  });

  it('emits HELIOS_ALPHA06_EXECUTION_REALISM_QUALIFIED when engineering checks pass', () => {
    const surviving = runAlpha06ForwardExecutionRealism({ scenario: alpha06SurvivingScenario() });
    const decayed = runAlpha06ForwardExecutionRealism({ scenario: alpha06DecayScenario() });
    const md15 = evaluateMd15MarketDataPosture({ root: ROOT });
    const checks = buildAlpha06QualificationChecks({
      surviving,
      decayed,
      md15PostureOk: md15.ok,
    });
    const qualification = evaluateAlpha06ExecutionRealismQualification(checks);
    assert.equal(qualification.marker, HELIOS_ALPHA06_EXECUTION_REALISM_QUALIFIED, qualification.blockers.join('; '));
    assert.equal(qualification.qualified, true);
  });
});
