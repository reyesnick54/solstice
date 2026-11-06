/**
 * HELIOS CF07 — sequential off-policy and trajectory evaluation (qualification).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HELIOS_CF07_SEQUENTIAL_OPE_QUALIFIED,
  evaluateCf07SequentialOpeQualification,
  evaluateSequentialOpe,
  HELIOS_CF07_SEQUENTIAL_OPE_SCHEMA_VERSION,
} from '../packages/platform/src/helios/counterfactual-learning/cf07-sequential-ope/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS CF07 sequential OPE', () => {
  it('qualifies only when FQE converges, weights stay bounded, and portfolio path is feasible', () => {
    const capital = 1_000_000n;
    const portfolioSlice = (cash: bigint, margin: bigint, positionUnits: bigint) =>
      Object.freeze({
        cashMinor: cash,
        marginUsedMinor: margin,
        positionEncoding: positionUnits.toString(),
        unrealizedPnlMinor: 0n,
      });

    const traj = Object.freeze({
      schema: HELIOS_CF07_SEQUENTIAL_OPE_SCHEMA_VERSION,
      trajectoryId: 'cf07_demo',
      steps: Object.freeze([
        Object.freeze({
          stepIndex: 0,
          stateKey: 's0|hist0',
          actionKey: 'hold',
          rewardMinor: 10n,
          behaviorPropensity: 0.5,
          evaluationPropensity: 0.5,
          history: Object.freeze({
            priorPositionsSummary: 'flat',
            regimeLabel: 'sim_low_vol',
          }),
        }),
        Object.freeze({
          stepIndex: 1,
          stateKey: 's1|hist1',
          actionKey: 'hold',
          rewardMinor: 5n,
          behaviorPropensity: 0.6,
          evaluationPropensity: 0.6,
        }),
      ]),
    });

    const path = Object.freeze({
      trajectory: traj,
      portfolioStates: Object.freeze([
        portfolioSlice(capital, 0n, 0n),
        portfolioSlice(capital, 0n, 0n),
        portfolioSlice(capital, 0n, 0n),
      ]),
    });

    const input = Object.freeze({
      trajectories: Object.freeze([path]),
      constraints: Object.freeze({
        capitalMinor: capital,
        maxLeverageNumerator: 2,
        maxLeverageDenominator: 1,
        maxPositionUnitsMinor: 10_000_000n,
        mandateRemainingMinor: capital,
        maxRiskNotionalMinor: capital,
      }),
      discountGamma: 1,
      propensityFloor: 0.01,
      maxImportanceWeight: 1000,
      minSupportVisits: 1,
      fqe: Object.freeze({
        maxIterations: 50,
        toleranceMean: 0.01,
        divergenceResidualRatio: 100,
      }),
      doublyRobust: Object.freeze({
        qHat: () => 0n,
        vHatPi: (s: string) => (s === 's0|hist0' ? 100n : 50n),
      }),
    });

    const out = evaluateSequentialOpe(input);
    assert.equal(out.qualified, true);
    assert.equal(out.qualificationMarker, HELIOS_CF07_SEQUENTIAL_OPE_QUALIFIED);
    assert.ok(out.estimates.fqe !== null);
    assert.ok(out.estimates.wis !== null);
    assert.ok(out.estimates.dr !== null);
    assert.ok(out.estimates.fqe!.diagnostics.fqe!.converged);
    assert.equal(out.estimates.fqe!.diagnostics.fqe!.diverged, false);

    const q = evaluateCf07SequentialOpeQualification(out);
    assert.equal(q.qualified, true);
    assert.equal(q.marker, HELIOS_CF07_SEQUENTIAL_OPE_QUALIFIED);
  });

  it('blocks when importance weights explode past cap or FQE diverges (test harness)', () => {
    const capital = 500_000n;
    const portfolioSlice = (cash: bigint) =>
      Object.freeze({
        cashMinor: cash,
        marginUsedMinor: 0n,
        positionEncoding: '0',
        unrealizedPnlMinor: 0n,
      });

    const mkStep = (
      idx: number,
      stateKey: string,
      b: number,
      e: number,
      reward: bigint,
    ) =>
      Object.freeze({
        stepIndex: idx,
        stateKey,
        actionKey: 'a',
        rewardMinor: reward,
        behaviorPropensity: b,
        evaluationPropensity: e,
      });

    const trajBoom = Object.freeze({
      schema: HELIOS_CF07_SEQUENTIAL_OPE_SCHEMA_VERSION,
      trajectoryId: 'cf07_boom',
      steps: Object.freeze([mkStep(0, 's0', 0.01, 0.9, 1n), mkStep(1, 's1', 0.01, 0.9, 1n)]),
    });

    const pathBoom = Object.freeze({
      trajectory: trajBoom,
      portfolioStates: Object.freeze([portfolioSlice(capital), portfolioSlice(capital), portfolioSlice(capital)]),
    });

    const blockedByWeight = evaluateSequentialOpe({
      trajectories: Object.freeze([pathBoom]),
      constraints: Object.freeze({ capitalMinor: capital }),
      discountGamma: 1,
      propensityFloor: 0.001,
      maxImportanceWeight: 10,
      minSupportVisits: 1,
      fqe: Object.freeze({ maxIterations: 30, toleranceMean: 1e-9, divergenceResidualRatio: 1000 }),
    });
    assert.equal(blockedByWeight.qualified, false);

    const trajShort = Object.freeze({
      schema: HELIOS_CF07_SEQUENTIAL_OPE_SCHEMA_VERSION,
      trajectoryId: 'cf07_fqe_block',
      steps: Object.freeze([mkStep(0, 's_only', 0.5, 0.5, 1n)]),
    });
    const pathShort = Object.freeze({
      trajectory: trajShort,
      portfolioStates: Object.freeze([portfolioSlice(capital), portfolioSlice(capital)]),
    });

    /** Single FQE iteration with unreachable tolerance forces `not converged` → estimate BLOCKED. */
    const blockedByFqe = evaluateSequentialOpe({
      trajectories: Object.freeze([pathShort]),
      constraints: Object.freeze({ capitalMinor: capital }),
      discountGamma: 1,
      propensityFloor: 0.01,
      maxImportanceWeight: 1e12,
      minSupportVisits: 1,
      fqe: Object.freeze({ maxIterations: 1, toleranceMean: 1e-30, divergenceResidualRatio: 1000 }),
    });
    assert.equal(blockedByFqe.estimates.fqe, null);
    assert.equal(blockedByFqe.qualified, false);
  });

  it('respects HELIOS architectural boundary (no competing packages)', () => {
    const findings = lintHeliosBoundary(process.cwd());
    assert.equal(
      findings.some((f) => f.rule === 'competing-helios-system'),
      false,
      findings.map((f) => f.message).join('; '),
    );
  });
});
