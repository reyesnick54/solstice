/**
 * HELIOS FORWARD ALPHA — ALPHA12 strategy capacity and scalability engine.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ALPHA12_CAPITAL_SCALE_MULTIPLIERS,
  ALPHA12_CAPACITY_ENGINE_SCHEMA,
  evaluateAlpha12CapacityQualification,
  fixtureAlpha12MicroCapacityInput,
  fixtureAlpha12MidCapacityInput,
  HELIOS_ALPHA12_CAPACITY_ENGINE_QUALIFIED,
  runAlpha12CapacityEngine,
} from '../packages/platform/src/helios/forward-alpha/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS FORWARD ALPHA ALPHA12 capacity engine', () => {
  it('passes HELIOS boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd());
    assert.equal(findings.length, 0, findings.map((f) => f.message).join('; '));
  });

  it('evaluates mandated capital scale ladder with non-linear gross alpha', () => {
    const result = runAlpha12CapacityEngine(fixtureAlpha12MidCapacityInput());
    assert.equal(result.schema, ALPHA12_CAPACITY_ENGINE_SCHEMA);
    assert.equal(result.grantsExecutionAuthority, false);
    assert.equal(result.researchOnly, true);
    assert.deepEqual([...result.scaleMultipliersRequested], [...ALPHA12_CAPITAL_SCALE_MULTIPLIERS]);

    const { curve } = result;
    assert.equal(curve.nonLinearReturnsEnforced, true);
    assert.equal(curve.scenarios.length, 6);

    const s1 = curve.scenarios.find((row) => row.scaleMultiplier === 1 && row.liquidityPermitted);
    const s2 = curve.scenarios.find((row) => row.scaleMultiplier === 2 && row.liquidityPermitted);
    assert.ok(s1 && s2);
    assert.ok(s2.grossAlphaBps < s1.grossAlphaBps, 'gross alpha bps must decay with scale');

    for (const row of curve.scenarios) {
      if (!row.liquidityPermitted) {
        continue;
      }
      const gross = BigInt(row.grossAlphaMinor);
      const costs = BigInt(row.estimatedTradingCostMinor) + BigInt(row.estimatedImpactMinor);
      const net = BigInt(row.netAlphaMinor);
      assert.equal(net, gross - costs);
      const adjusted = curve.impactAdjusted.find((a) => a.scaleMultiplier === row.scaleMultiplier);
      assert.ok(adjusted);
      assert.equal(adjusted.netAlphaBps, row.netAlphaBps);
    }
  });

  it('classifies micro strategies that fail at institutional scale', () => {
    const result = runAlpha12CapacityEngine(fixtureAlpha12MicroCapacityInput());
    const { curve } = result;
    const at1 = curve.scenarios.find((row) => row.scaleMultiplier === 1);
    const at10 = curve.scenarios.find((row) => row.scaleMultiplier === 10);
    assert.ok(at1 && at1.netAlphaBps > 0, 'profitable at shadow capital');
    assert.ok(!at10?.liquidityPermitted || (at10.netAlphaBps ?? 0) <= 0, 'not viable at 10x');
    assert.equal(curve.classification, 'ECONOMICALLY_IMPOSSIBLE_AT_SCALE');
    assert.ok(curve.liquidity.singleNameCapacityMinor !== '0');
    assert.ok(curve.breakEven.netAlphaCrossesZero || curve.ceiling.netEdgeApproachesZero);
  });

  it('exposes capacity ceiling with uncertainty and break-even band', () => {
    const result = runAlpha12CapacityEngine(fixtureAlpha12MidCapacityInput());
    const { ceiling, breakEven } = result.curve;
    assert.ok(ceiling.uncertaintyBps >= 0);
    assert.ok(breakEven.uncertaintyBps >= 0);
    assert.equal(breakEven.method, 'INTERPOLATED_SCALE_CURVE');
    assert.ok(BigInt(breakEven.breakEvenCapitalMinorLow) <= BigInt(breakEven.breakEvenCapitalMinorHigh));
  });

  it('qualifies HELIOS_ALPHA12_CAPACITY_ENGINE_QUALIFIED when checks pass', () => {
    const result = runAlpha12CapacityEngine(fixtureAlpha12MidCapacityInput());
    const qualification = evaluateAlpha12CapacityQualification(result);
    assert.equal(qualification.qualified, true, qualification.blockers.join('; '));
    assert.equal(qualification.marker, HELIOS_ALPHA12_CAPACITY_ENGINE_QUALIFIED);
    assert.equal(result.qualificationMarker, HELIOS_ALPHA12_CAPACITY_ENGINE_QUALIFIED);
  });
});
