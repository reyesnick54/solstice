/**
 * HELIOS CF03 — behavior policy snapshot, propensity masses, overlap, and OPE gate.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  buildDeterministicBehaviorPolicySnapshot,
  buildStochasticBehaviorPolicySnapshot,
  behaviorPolicyProbabilities,
  assessOverlapForOpe,
  evaluateCf03PolicyPropensityQualification,
  HELIOS_CF03_POLICY_PROPENSITY_QUALIFIED,
} from '../packages/platform/src/helios/counterfactual-learning/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-11-06T12:00:00.000Z');

describe('HELIOS CF03 policy propensity', () => {
  it('records deterministic policy without invented probabilities', () => {
    const snap = buildDeterministicBehaviorPolicySnapshot({
      snapshotId: 'bps_cf03_det',
      decisionAtUtc: NOW,
      contextRef: 'ctx_alpha',
      candidateActionIds: ['a1', 'a2'],
      chosenActionId: 'a1',
    });
    assert.equal(snap.policyKind, 'DETERMINISTIC_POLICY');
    assert.equal(snap.propensityMasses, null);
    assert.equal(snap.recordNote, 'DETERMINISTIC_POLICY');
    assert.equal(snap.support, 'SUPPORT_LIMITED');
    const p = behaviorPolicyProbabilities(snap);
    assert.equal(p.get('a1'), 'DETERMINISTIC_POLICY');
    assert.equal(p.get('a2'), 'DETERMINISTIC_POLICY');

    const { overlap, gate } = assessOverlapForOpe({
      decidedAtUtc: NOW,
      behavior: snap,
      evaluationPropensityMasses: new Map([
        ['a1', { numerator: '1', denominator: '2' }],
        ['a2', { numerator: '1', denominator: '2' }],
      ]),
    });
    assert.equal(overlap.supportState, 'NO_SUPPORT');
    assert.equal(gate.counterfactualOpeEstimationPermitted, false);
    assert.equal(gate.refusalReason, 'NO_OVERLAP_SUPPORT');
  });

  it('records stochastic research policy with P(action|context) per candidate', () => {
    const snap = buildStochasticBehaviorPolicySnapshot({
      snapshotId: 'bps_cf03_stoch',
      decisionAtUtc: NOW,
      contextRef: 'ctx_beta',
      candidateActionIds: ['x', 'y'],
      chosenActionId: 'x',
      evaluationEnvironment: 'RESEARCH_SIMULATION',
      propensityMasses: [
        { actionId: 'x', probabilityMass: { numerator: '3', denominator: '4' } },
        { actionId: 'y', probabilityMass: { numerator: '1', denominator: '4' } },
      ],
    });
    assert.equal(snap.policyKind, 'STOCHASTIC_POLICY');
    const p = behaviorPolicyProbabilities(snap);
    assert.equal(p.get('x')?.numerator, '3');
    assert.equal(p.get('x')?.denominator, '4');

    const evalMap = new Map([
      ['x', { numerator: '1', denominator: '2' }],
      ['y', { numerator: '1', denominator: '2' }],
    ]);

    const { overlap, gate } = assessOverlapForOpe({
      decidedAtUtc: NOW,
      behavior: snap,
      evaluationPropensityMasses: evalMap,
      thresholds: {
        supportedMinEss: 0,
        weakMinEss: 0,
        poorMinEss: 0,
        supportedMaxWeight: 10,
        weakMaxWeight: 10,
      },
    });
    assert.ok(overlap.effectiveSampleSize.sampleCount > 0);
    assert.ok(BigInt(overlap.effectiveSampleSize.essRational.numerator) > 0n);
    assert.equal(overlap.importanceWeightDiagnostics.propensityExtremes.minPropensityRational.numerator, '1');
    assert.equal(overlap.importanceWeightDiagnostics.propensityExtremes.maxPropensityRational.numerator, '3');
    assert.ok(gate.counterfactualOpeEstimationPermitted);
    assert.equal(gate.refusalReason, null);

    const qual = evaluateCf03PolicyPropensityQualification({
      decidedAtUtc: NOW,
      behavior: snap,
      evaluationPropensityMasses: evalMap,
    });
    assert.equal(qual.marker, HELIOS_CF03_POLICY_PROPENSITY_QUALIFIED);
  });

  it('does not violate HELIOS architectural boundary', () => {
    const findings = lintHeliosBoundary(new URL('..', import.meta.url).pathname);
    assert.equal(findings.length, 0, findings.map((f) => `${f.rule}:${f.file}:${f.line}`).join('; '));
  });
});
